"use client";

import {
  calculateProfit,
  demoBooks,
  nextInventoryParts,
  parseInventoryId,
  sanitizePrefix
} from "@/lib/mock-data";
import type { Book, BookType } from "@/lib/types";

const STORAGE_KEY = "book-to-journal-inventory";
const LEGACY_STORAGE_KEY = "golden-book-journal-inventory";
const PREFIX_KEY = "book-to-journal-inventory-prefix";

function normalizeBook(book: Partial<Book>, index: number): Book {
  const parsed = parseInventoryId(book.inventory_id || `BK-${String(index + 1).padStart(3, "0")}`);
  const prefix = sanitizePrefix(book.inventory_prefix || parsed.prefix);
  const number = book.inventory_number || parsed.number || index + 1;
  const categoryIds = Array.isArray(book.category_ids)
    ? book.category_ids.filter(Boolean)
    : book.category_id
      ? [book.category_id]
      : [];
  const categoryNames = Array.isArray(book.category_names)
    ? book.category_names.filter(Boolean)
    : [];
  const categoryColors = Array.isArray(book.category_colors)
    ? book.category_colors.filter(Boolean)
    : [];
  const primaryCategory = categoryNames[0] || book.category || "Uncategorized";

  return {
    id: book.id || crypto.randomUUID(),
    user_id: book.user_id ?? null,
    inventory_prefix: prefix,
    inventory_number: number,
    inventory_id: book.inventory_id || `${prefix}-${String(number).padStart(3, "0")}`,
    title: book.title || "Untitled book",
    author: book.author || "",
    publisher: book.publisher || "",
    published_year: book.published_year || "",
    isbn: book.isbn || "",
    cover_url: book.cover_url || "/placeholder-cover.svg",
    photo_urls: Array.isArray(book.photo_urls) ? book.photo_urls.filter(Boolean) : [],
    category_id: categoryIds[0] ?? book.category_id ?? null,
    category: primaryCategory,
    category_color: book.category_color ?? categoryColors[0] ?? null,
    category_ids: categoryIds,
    category_names: categoryNames.length > 0 ? categoryNames : primaryCategory !== "Uncategorized" ? [primaryCategory] : [],
    category_colors: categoryColors,
    book_type: (book.book_type || "Regular Book") as BookType,
    condition: book.condition || "Good",
    cost: Number(book.cost || 0),
    status_id: book.status_id ?? null,
    status: book.status || "Inventory",
    status_color: book.status_color ?? null,
    listed_price: Number(book.listed_price || 0),
    sold_price: Number(book.sold_price || 0),
    profit: calculateProfit(Number(book.cost || 0), Number(book.sold_price || 0)),
    notes: book.notes || "",
    show_public: Boolean(book.show_public),
    created_at: book.created_at,
    updated_at: book.updated_at
  };
}

export function loadLocalBooks(): Book[] {
  if (typeof window === "undefined") {
    return demoBooks;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY) || window.localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!stored) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(demoBooks));
    return demoBooks;
  }

  try {
    const normalized = (JSON.parse(stored) as Partial<Book>[]).map(normalizeBook);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    return demoBooks;
  }
}

export function saveLocalBooks(books: Book[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(books));
}

export function loadInventoryPrefix() {
  if (typeof window === "undefined") return "BK";
  return sanitizePrefix(window.localStorage.getItem(PREFIX_KEY) || "BK");
}

export function saveInventoryPrefix(prefix: string) {
  const cleanPrefix = sanitizePrefix(prefix);
  window.localStorage.setItem(PREFIX_KEY, cleanPrefix);
  return cleanPrefix;
}

export function createLocalBook(
  input: Omit<Book, "id" | "inventory_id" | "inventory_prefix" | "inventory_number" | "profit">,
  prefix = loadInventoryPrefix()
) {
  const books = loadLocalBooks();
  const inventory = nextInventoryParts(books, prefix);
  const newBook: Book = {
    ...input,
    id: crypto.randomUUID(),
    ...inventory,
    profit: calculateProfit(input.cost, input.sold_price),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  saveLocalBooks([newBook, ...books]);
  return newBook;
}

export function updateLocalBook(id: string, updates: Partial<Book>) {
  const books = loadLocalBooks();
  const updated = books.map((book) => {
    if (book.id !== id) return book;

    const next = { ...book, ...updates };
    next.profit = calculateProfit(next.cost, next.sold_price);
    next.updated_at = new Date().toISOString();
    return next;
  });

  saveLocalBooks(updated);
  return updated.find((book) => book.id === id) ?? null;
}

export function deleteLocalBook(id: string) {
  const books = loadLocalBooks();
  const nextBooks = books.filter((book) => book.id !== id);
  saveLocalBooks(nextBooks);
  return nextBooks.length !== books.length;
}
