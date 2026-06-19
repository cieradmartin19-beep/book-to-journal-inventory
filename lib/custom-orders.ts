"use client";

import { ensureSupabaseUser } from "@/lib/inventory-repository";
import { loadLocalBooks } from "@/lib/books-store";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

export const orderStatuses = [
  "New Request",
  "Quote Sent",
  "Accepted",
  "In Progress",
  "Completed",
  "Declined"
] as const;

export type CustomOrderStatus = (typeof orderStatuses)[number];

export type CustomOrder = {
  id: string;
  owner_user_id?: string;
  book_id: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  preferred_contact: "Phone" | "Email" | "Text";
  page_count: string;
  custom_page_count: number | null;
  customization_options: string[];
  customer_notes: string;
  quoted_price: number | null;
  internal_notes: string;
  status: CustomOrderStatus;
  created_at: string;
  updated_at: string;
  books?: { title?: string; author?: string; cover_url?: string } | null;
};

export type CustomOrderRequest = Pick<
  CustomOrder,
  | "book_id"
  | "customer_name"
  | "customer_phone"
  | "customer_email"
  | "preferred_contact"
  | "page_count"
  | "custom_page_count"
  | "customization_options"
  | "customer_notes"
> & { share_id: string };

const LOCAL_ORDERS_KEY = "the-paper-curio-custom-orders";

function loadLocalOrders(): CustomOrder[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_ORDERS_KEY) || "[]") as CustomOrder[];
  } catch {
    return [];
  }
}

function saveLocalOrders(orders: CustomOrder[]) {
  window.localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(orders));
}

export async function resolveCustomOrderShareId() {
  if (!isSupabaseConfigured) return "demo";
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return "";
  const { data, error } = await supabase.rpc("get_primary_public_share_id");
  if (error) throw new Error("This custom order page is not available right now.");
  return String(data || "");
}

export async function submitCustomOrder(request: CustomOrderRequest) {
  if (!isSupabaseConfigured) {
    const now = new Date().toISOString();
    const selectedBook = request.book_id ? loadLocalBooks().find((book) => book.id === request.book_id) : null;
    const order: CustomOrder = {
      id: crypto.randomUUID(),
      book_id: request.book_id,
      customer_name: request.customer_name,
      customer_phone: request.customer_phone,
      customer_email: request.customer_email,
      preferred_contact: request.preferred_contact,
      page_count: request.page_count,
      custom_page_count: request.custom_page_count,
      customization_options: request.customization_options,
      customer_notes: request.customer_notes,
      quoted_price: null,
      internal_notes: "",
      status: "New Request",
      created_at: now,
      updated_at: now,
      books: selectedBook ? { title: selectedBook.title, author: selectedBook.author, cover_url: selectedBook.cover_url } : null
    };
    saveLocalOrders([order, ...loadLocalOrders()]);
    return order.id;
  }

  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("Order requests are not available right now.");
  const { data, error } = await supabase.rpc("submit_custom_order", {
    share_id: request.share_id || null,
    selected_book_id: request.book_id,
    customer_name: request.customer_name,
    customer_phone: request.customer_phone,
    customer_email: request.customer_email,
    preferred_contact: request.preferred_contact,
    page_count: request.page_count,
    custom_page_count: request.custom_page_count,
    customization_options: request.customization_options,
    customer_notes: request.customer_notes
  });
  if (error) throw new Error("Your request could not be submitted. Please review the form and try again.");
  return String(data);
}

export async function fetchCustomOrders(): Promise<CustomOrder[]> {
  if (!isSupabaseConfigured) return loadLocalOrders();
  const supabase = getSupabaseBrowserClient();
  const user = await ensureSupabaseUser();
  if (!supabase || !user) throw new Error("Sign in to view custom orders.");
  const { data, error } = await supabase
    .from("custom_orders")
    .select("*, books(title, author, cover_url)")
    .eq("owner_user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CustomOrder[];
}

export async function updateCustomOrder(
  id: string,
  updates: Pick<CustomOrder, "status" | "quoted_price" | "internal_notes">
) {
  if (!isSupabaseConfigured) {
    const orders = loadLocalOrders();
    const next = orders.map((order) => order.id === id
      ? { ...order, ...updates, updated_at: new Date().toISOString() }
      : order);
    saveLocalOrders(next);
    const saved = next.find((order) => order.id === id);
    if (!saved) throw new Error("Order request not found.");
    return saved;
  }

  const supabase = getSupabaseBrowserClient();
  const user = await ensureSupabaseUser();
  if (!supabase || !user) throw new Error("Sign in to update custom orders.");
  const { data, error } = await supabase
    .from("custom_orders")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("owner_user_id", user.id)
    .select("*, books(title, author, cover_url)")
    .single();
  if (error) throw error;
  return data as CustomOrder;
}
