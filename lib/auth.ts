"use client";

import type { User } from "@supabase/supabase-js";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

export class AuthRequiredError extends Error {
  constructor(message = "Sign in to manage your inventory.") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

export function userDisplayName(user: User | null) {
  if (!user) return "";

  const metadataName =
    user.user_metadata?.name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.preferred_username ||
    "";
  const emailName = user.email?.split("@")[0] ?? "";
  const rawName = String(metadataName || emailName || "your account").trim();

  if (/^jess/i.test(rawName)) return "Jess";
  return rawName
    .split(/[._\-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export async function getCurrentUser() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  const session = data.session;
  if (!session) return null;

  const verified = await supabase.auth.getUser();
  if (!verified.error && verified.data.user) return verified.data.user;

  const refreshed = await supabase.auth.refreshSession();
  if (refreshed.error || !refreshed.data.session) {
    await supabase.auth.signOut({ scope: "local" });
    return null;
  }

  return refreshed.data.session.user;
}

export async function requireSignedInUser() {
  if (!isSupabaseConfigured) return null;

  const user = await getCurrentUser();
  if (!user) throw new AuthRequiredError();
  return user;
}

export async function ensureProfile(userId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId }, { onConflict: "id" });
  if (error) throw error;
}

export async function signOut() {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;
  await supabase.auth.signOut();
}
