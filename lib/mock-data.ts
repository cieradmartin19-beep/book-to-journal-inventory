import type { Book } from "@/lib/types";

export const demoBooks: Book[] = [
  {
    id: "demo-1",
    inventory_prefix: "BK",
    inventory_number: 1,
    inventory_id: "BK-001",
    title: "Charlotte's Web",
    author: "E. B. White",
    publisher: "Harper & Brothers",
    published_year: "1952",
    isbn: "9780061124952",
    cover_url: "/placeholder-cover.svg",
    photo_urls: [],
    category: "Children's Fiction",
    book_type: "Children's Book",
    condition: "Great",
    cost: 3,
    status: "Finished Journal",
    listed_price: 38,
    sold_price: 0,
    profit: -3,
    notes: "Classic cover, good candidate for a keepsake journal.",
    show_public: true
  },
  {
    id: "demo-2",
    inventory_prefix: "GB",
    inventory_number: 1,
    inventory_id: "GB-001",
    title: "The Golden Book of Fairy Tales",
    author: "Marie Ponsot",
    publisher: "Golden Press",
    published_year: "1958",
    isbn: "",
    cover_url: "/placeholder-cover.svg",
    photo_urls: [],
    category: "Vintage Children's Books",
    book_type: "Little Golden Book",
    condition: "Great",
    cost: 3,
    status: "Finished Journal",
    listed_price: 38,
    sold_price: 0,
    profit: -3,
    notes: "Creamy pages, lovely spine, ready for ribbon charms.",
    show_public: true
  },
  {
    id: "demo-3",
    inventory_prefix: "JRN",
    inventory_number: 1,
    inventory_id: "JRN-001",
    title: "Pressed Flower Journal",
    author: "",
    publisher: "",
    published_year: "",
    isbn: "",
    cover_url: "/placeholder-cover.svg",
    photo_urls: [],
    category: "Handmade Journals",
    book_type: "Journal Project",
    condition: "Good",
    cost: 4.5,
    status: "Listed",
    listed_price: 42,
    sold_price: 0,
    profit: -4.5,
    notes: "Handmade journal made from a damaged hardcover.",
    show_public: true
  }
];

export const prefixChoices = ["BK", "GB", "JRN", "CUSTOM"] as const;

export function sanitizePrefix(prefix: string) {
  return (prefix || "BK").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8) || "BK";
}

export function parseInventoryId(inventoryId: string) {
  const match = inventoryId.match(/^([A-Z0-9]+)-(\d+)$/i);
  if (!match) return { prefix: "BK", number: 0 };
  return { prefix: sanitizePrefix(match[1]), number: Number(match[2]) };
}

export function nextInventoryId(
  books: Pick<Book, "inventory_id" | "inventory_prefix" | "inventory_number">[],
  prefix = "BK"
) {
  const cleanPrefix = sanitizePrefix(prefix);
  const max = books.reduce((current, book) => {
    const parsed = parseInventoryId(book.inventory_id);
    const bookPrefix = sanitizePrefix(book.inventory_prefix || parsed.prefix);
    const bookNumber = book.inventory_number || parsed.number;
    return bookPrefix === cleanPrefix ? Math.max(current, bookNumber) : current;
  }, 0);

  return `${cleanPrefix}-${String(max + 1).padStart(3, "0")}`;
}

export function nextInventoryParts(
  books: Pick<Book, "inventory_id" | "inventory_prefix" | "inventory_number">[],
  prefix = "BK"
) {
  const inventoryId = nextInventoryId(books, prefix);
  const parsed = parseInventoryId(inventoryId);
  return {
    inventory_id: inventoryId,
    inventory_prefix: parsed.prefix,
    inventory_number: parsed.number
  };
}

export function calculateProfit(cost: number, soldPrice: number) {
  return Number(((soldPrice || 0) - (cost || 0)).toFixed(2));
}
