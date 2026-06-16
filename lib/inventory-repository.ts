"use client";

import {
  createLocalBook,
  loadLocalBooks,
  updateLocalBook
} from "@/lib/books-store";
import {
  fetchPublicShareId,
  fetchPublicSupabaseBooks,
  fetchSupabaseBook,
  fetchSupabaseBooks,
  insertSupabaseBook,
  updateSupabaseBook
} from "@/lib/supabase-books";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import type { Book, BookDraft } from "@/lib/types";

export type PersistenceStatus = {
  mode: "supabase" | "local" | "error";
  message: string;
  userId?: string;
};

export async function ensureSupabaseUser() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const client = supabase;

  async function ensureProfile(userId: string) {
    const { error } = await client
      .from("profiles")
      .upsert({ id: userId }, { onConflict: "id" });
    if (error) throw error;
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;

  let user = sessionData.session?.user ?? null;

  if (!user) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) {
      throw new Error(
        "Supabase anonymous auth is not enabled. Enable Authentication > Sign In / Providers > Anonymous sign-ins, or replace ensureSupabaseUser with your preferred auth flow."
      );
    }

    user = data.user ?? data.session?.user ?? null;
  }

  if (!user) {
    const { data: refreshedSession, error: refreshedError } = await supabase.auth.getSession();
    if (refreshedError) throw refreshedError;
    user = refreshedSession.session?.user ?? null;
  }

  if (!user) throw new Error("Supabase did not return a signed-in user.");
  await ensureProfile(user.id);
  return user;
}

function localStatus(message = "Using local browser storage because Supabase is not configured.") {
  return { mode: "local", message } satisfies PersistenceStatus;
}

async function filesToDataUrls(files: File[]) {
  return Promise.all(
    files.map(
      (file) =>
        new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = reject;
          reader.readAsDataURL(file);
        })
    )
  );
}

export async function getPersistenceStatus(): Promise<PersistenceStatus> {
  if (!isSupabaseConfigured) return localStatus();

  try {
    const user = await ensureSupabaseUser();
    return {
      mode: "supabase",
      message: "Connected to Supabase. Books save to your database.",
      userId: user?.id
    };
  } catch (error) {
    return {
      mode: "error",
      message: error instanceof Error ? error.message : "Supabase connection failed."
    };
  }
}

export async function fetchBooks(): Promise<Book[]> {
  if (!isSupabaseConfigured) return loadLocalBooks();

  const user = await ensureSupabaseUser();
  if (!user) throw new Error("Supabase is configured, but no authenticated user is available.");
  const books = await fetchSupabaseBooks(user.id);
  if (!books) throw new Error("Supabase is configured, but the books query did not return data.");
  return books;
}

export async function fetchBook(id: string): Promise<Book | null> {
  if (!isSupabaseConfigured) {
    return loadLocalBooks().find((book) => book.id === id) ?? null;
  }

  const user = await ensureSupabaseUser();
  if (!user) throw new Error("Supabase is configured, but no authenticated user is available.");
  return fetchSupabaseBook(id, user.id);
}

export async function createBook(input: BookDraft, prefix: string, photoFiles: File[] = []): Promise<Book> {
  if (!isSupabaseConfigured) {
    const photoUrls = [...(input.photo_urls ?? []), ...(await filesToDataUrls(photoFiles))];
    return createLocalBook(
      {
        ...input,
        photo_urls: photoUrls,
        cover_url: input.cover_url || photoUrls[0] || ""
      },
      prefix
    );
  }

  const user = await ensureSupabaseUser();
  if (!user) throw new Error("Supabase is configured, but no authenticated user is available.");
  const inserted = await insertSupabaseBook(input, user.id, prefix, photoFiles);
  if (inserted) return inserted;

  throw new Error("Supabase is configured, but the book insert did not return data.");
}

export async function updateBook(id: string, updates: Partial<BookDraft>, photoFiles: File[] = []): Promise<Book | null> {
  if (!isSupabaseConfigured) {
    const photoUrls = [...(updates.photo_urls ?? []), ...(await filesToDataUrls(photoFiles))];
    return updateLocalBook(id, {
      ...(updates as Partial<Book>),
      photo_urls: photoUrls,
      cover_url: updates.cover_url || photoUrls[0] || ""
    });
  }

  const user = await ensureSupabaseUser();
  if (!user) throw new Error("Supabase is configured, but no authenticated user is available.");
  return updateSupabaseBook(id, updates, user.id, photoFiles);
}

export async function fetchPublicBooks(shareId: string): Promise<Book[]> {
  if (!isSupabaseConfigured) return loadLocalBooks().filter((book) => book.show_public);

  const books = await fetchPublicSupabaseBooks(shareId);
  return books ?? [];
}

export async function getPublicSharePath() {
  if (!isSupabaseConfigured) return "/share/demo";

  const user = await ensureSupabaseUser();
  if (!user) return "/share/demo";
  const shareId = await fetchPublicShareId(user.id);
  return `/share/${shareId}`;
}
