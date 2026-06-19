"use client";

import { ensureSupabaseUser } from "@/lib/inventory-repository";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";
import type { Book, CustomStatus } from "@/lib/types";

export const starterStatuses = [
  { name: "Inventory", color: "#E9E1D2" },
  { name: "Ready to Convert", color: "#F2A65A" },
  { name: "In Progress", color: "#8FB7E8" },
  { name: "Finished Journal", color: "#8CCB88" },
  { name: "Listed", color: "#76B7B2" },
  { name: "Sold", color: "#B7B7B7" }
];

const LOCAL_STATUS_KEY = "book-to-journal-statuses";

function normalizeStatus(status: Partial<CustomStatus>, index = 0): CustomStatus {
  return {
    id: status.id || crypto.randomUUID(),
    user_id: status.user_id ?? null,
    name: status.name || starterStatuses[index]?.name || "Status",
    color: status.color || starterStatuses[index]?.color || "#E9E1D2",
    sort_order: Number(status.sort_order ?? index),
    created_at: status.created_at || new Date().toISOString()
  };
}

function loadLocalStatuses() {
  if (typeof window === "undefined") return [];
  const stored = window.localStorage.getItem(LOCAL_STATUS_KEY);
  if (stored) {
    try {
      return (JSON.parse(stored) as Partial<CustomStatus>[]).map(normalizeStatus).sort((a, b) => a.sort_order - b.sort_order);
    } catch {
      // Rebuild defaults below.
    }
  }

  const starters = starterStatuses.map((status, index) => normalizeStatus({ ...status, sort_order: index }, index));
  window.localStorage.setItem(LOCAL_STATUS_KEY, JSON.stringify(starters));
  return starters;
}

function saveLocalStatuses(statuses: CustomStatus[]) {
  window.localStorage.setItem(LOCAL_STATUS_KEY, JSON.stringify(statuses));
}

export async function fetchStatuses(): Promise<CustomStatus[]> {
  if (!isSupabaseConfigured) return loadLocalStatuses();

  const supabase = getSupabaseBrowserClient();
  const user = await ensureSupabaseUser();
  if (!supabase || !user) return [];

  const { data, error } = await supabase
    .from("statuses")
    .select("*")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true });

  if (error) throw error;
  if ((data ?? []).length > 0) return data as CustomStatus[];

  const { error: insertError } = await supabase
    .from("statuses")
    .upsert(starterStatuses.map((status, index) => ({ ...status, sort_order: index, user_id: user.id })), {
      onConflict: "user_id,name",
      ignoreDuplicates: true
    });

  if (insertError) throw insertError;
  const { data: seeded, error: reloadError } = await supabase
    .from("statuses")
    .select("*")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true });
  if (reloadError) throw reloadError;
  return (seeded ?? []) as CustomStatus[];
}

export async function createStatus(name: string, color = "#E9E1D2", sortOrder?: number): Promise<CustomStatus> {
  const cleanName = name.trim();
  if (!cleanName) throw new Error("Status name is required.");

  if (!isSupabaseConfigured) {
    const statuses = loadLocalStatuses();
    const status = normalizeStatus({ name: cleanName, color, sort_order: sortOrder ?? statuses.length });
    saveLocalStatuses([...statuses, status].sort((a, b) => a.sort_order - b.sort_order));
    return status;
  }

  const supabase = getSupabaseBrowserClient();
  const user = await ensureSupabaseUser();
  if (!supabase || !user) throw new Error("Supabase is not available.");

  const { data, error } = await supabase
    .from("statuses")
    .insert({ user_id: user.id, name: cleanName, color, sort_order: sortOrder ?? 999 })
    .select()
    .single();

  if (error) throw error;
  return data as CustomStatus;
}

export async function updateStatus(id: string, updates: Pick<CustomStatus, "name" | "color" | "sort_order">): Promise<CustomStatus> {
  if (!isSupabaseConfigured) {
    const next = loadLocalStatuses().map((status) => status.id === id ? { ...status, ...updates } : status);
    saveLocalStatuses(next);
    const found = next.find((status) => status.id === id);
    if (!found) throw new Error("Status not found.");
    return found;
  }

  const supabase = getSupabaseBrowserClient();
  const user = await ensureSupabaseUser();
  if (!supabase || !user) throw new Error("Supabase is not available.");

  const { data, error } = await supabase
    .from("statuses")
    .update({ name: updates.name.trim(), color: updates.color, sort_order: updates.sort_order })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw error;
  return data as CustomStatus;
}

export async function deleteStatus(id: string) {
  if (!isSupabaseConfigured) {
    saveLocalStatuses(loadLocalStatuses().filter((status) => status.id !== id));
    return;
  }

  const supabase = getSupabaseBrowserClient();
  const user = await ensureSupabaseUser();
  if (!supabase || !user) throw new Error("Supabase is not available.");

  const { error } = await supabase.from("statuses").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw error;
}

export function displayStatus(book: Pick<Book, "status" | "status_color">) {
  return { name: book.status || "Inventory", color: book.status_color || "#E9E1D2" };
}
