"use client";

import { ensureSupabaseUser } from "@/lib/inventory-repository";
import { loadLocalBooks, saveLocalBooks } from "@/lib/books-store";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import type { Category } from "@/lib/types";

export const starterCategories = [
  { name: "Little Golden Books", color: "#F6C453" },
  { name: "Children's Books", color: "#7CC9A7" },
  { name: "Disney", color: "#8FB7E8" },
  { name: "Christmas", color: "#D95D5D" },
  { name: "Religious", color: "#B99BE8" },
  { name: "Vintage", color: "#D9A66A" },
  { name: "Ready to Convert", color: "#F2A65A" },
  { name: "Finished Journals", color: "#8CCB88" },
  { name: "Listed", color: "#76B7B2" },
  { name: "Sold", color: "#B7B7B7" }
];

const LOCAL_CATEGORY_KEY = "book-to-journal-categories";

function normalizeCategory(category: Partial<Category>, index = 0): Category {
  return {
    id: category.id || crypto.randomUUID(),
    user_id: category.user_id ?? null,
    name: category.name || starterCategories[index]?.name || "Category",
    color: category.color || starterCategories[index]?.color || "#7CC9A7",
    created_at: category.created_at || new Date().toISOString()
  };
}

function loadLocalCategories() {
  if (typeof window === "undefined") return [];
  const stored = window.localStorage.getItem(LOCAL_CATEGORY_KEY);
  if (stored) {
    try {
      return (JSON.parse(stored) as Partial<Category>[]).map(normalizeCategory);
    } catch {
      // Fall through and rebuild starter categories.
    }
  }

  const starters = starterCategories.map((category) => normalizeCategory(category));
  window.localStorage.setItem(LOCAL_CATEGORY_KEY, JSON.stringify(starters));
  return starters;
}

function saveLocalCategories(categories: Category[]) {
  window.localStorage.setItem(LOCAL_CATEGORY_KEY, JSON.stringify(categories));
}

export async function fetchCategories(): Promise<Category[]> {
  if (!isSupabaseConfigured) return loadLocalCategories();

  const supabase = getSupabaseBrowserClient();
  const user = await ensureSupabaseUser();
  if (!supabase || !user) return [];

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  if (error) throw error;
  if ((data ?? []).length > 0) return data as Category[];

  const { error: insertError } = await supabase
    .from("categories")
    .upsert(starterCategories.map((category) => ({ ...category, user_id: user.id })), {
      onConflict: "user_id,name",
      ignoreDuplicates: true
    });

  if (insertError) throw insertError;
  const { data: seeded, error: reloadError } = await supabase
    .from("categories")
    .select("*")
    .eq("user_id", user.id)
    .order("name", { ascending: true });
  if (reloadError) throw reloadError;
  return (seeded ?? []) as Category[];
}

export async function createCategory(name: string, color = "#7CC9A7"): Promise<Category> {
  const cleanName = name.trim();
  if (!cleanName) throw new Error("Category name is required.");

  if (!isSupabaseConfigured) {
    const categories = loadLocalCategories();
    const category = normalizeCategory({ name: cleanName, color });
    saveLocalCategories([...categories, category].sort((a, b) => a.name.localeCompare(b.name)));
    return category;
  }

  const supabase = getSupabaseBrowserClient();
  const user = await ensureSupabaseUser();
  if (!supabase || !user) throw new Error("Supabase is not available.");

  const { data, error } = await supabase
    .from("categories")
    .insert({ user_id: user.id, name: cleanName, color })
    .select()
    .single();

  if (error) throw error;
  return data as Category;
}

export async function updateCategory(id: string, updates: Pick<Category, "name" | "color">): Promise<Category> {
  if (!isSupabaseConfigured) {
    const categories = loadLocalCategories();
    const next = categories.map((category) => category.id === id ? { ...category, ...updates } : category);
    saveLocalCategories(next);
    const found = next.find((category) => category.id === id);
    if (!found) throw new Error("Category not found.");
    return found;
  }

  const supabase = getSupabaseBrowserClient();
  const user = await ensureSupabaseUser();
  if (!supabase || !user) throw new Error("Supabase is not available.");

  const { data, error } = await supabase
    .from("categories")
    .update({ name: updates.name.trim(), color: updates.color })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data as Category;
}

export async function deleteCategory(id: string) {
  if (!isSupabaseConfigured) {
    saveLocalCategories(loadLocalCategories().filter((category) => category.id !== id));
    saveLocalBooks(loadLocalBooks().map((book) => book.category_id === id ? {
      ...book,
      category_id: null,
      category: "Uncategorized",
      category_color: null
    } : book));
    return;
  }

  const supabase = getSupabaseBrowserClient();
  const user = await ensureSupabaseUser();
  if (!supabase || !user) throw new Error("Supabase is not available.");

  const { error: unassignError } = await supabase
    .from("books")
    .update({ category_id: null, category: "Uncategorized" })
    .eq("category_id", id)
    .eq("user_id", user.id);
  if (unassignError && !/category_id/i.test(unassignError.message)) throw unassignError;

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw error;
}

export function displayCategory(book: Pick<Category, "name" | "color"> | { category?: string; category_color?: string | null; category_names?: string[]; category_colors?: string[] }) {
  if ("name" in book) return { name: book.name || "Uncategorized", color: book.color || "#E9E1D2" };
  const names = book.category_names?.filter(Boolean) ?? [];
  const colors = book.category_colors?.filter(Boolean) ?? [];
  return {
    name: names[0] || book.category || "Uncategorized",
    color: colors[0] || book.category_color || "#E9E1D2"
  };
}

export function displayCategories(book: { category_names?: string[]; category_colors?: string[]; category?: string; category_color?: string | null }) {
  const names = (book.category_names ?? []).filter(Boolean);
  const colors = (book.category_colors ?? []).filter(Boolean);
  if (names.length > 0) {
    return names.map((name, index) => ({
      name,
      color: colors[index] || "#E9E1D2"
    }));
  }

  if (book.category && book.category !== "Uncategorized") {
    return [{ name: book.category, color: book.category_color || "#E9E1D2" }];
  }

  return [{ name: "Uncategorized", color: "#E9E1D2" }];
}
