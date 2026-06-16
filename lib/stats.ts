import type { Book, DashboardStats } from "@/lib/types";

export function getDashboardStats(books: Book[]): DashboardStats {
  return {
    total: books.length,
    inventory: books.filter((book) => book.status === "Inventory").length,
    ready: books.filter((book) => book.status === "Ready to Convert").length,
    inProgress: books.filter((book) => book.status === "In Progress").length,
    finished: books.filter((book) => book.status === "Finished Journal").length,
    listed: books.filter((book) => book.status === "Listed").length,
    sold: books.filter((book) => book.status === "Sold").length,
    profit: books.reduce((sum, book) => sum + Number(book.profit || 0), 0)
  };
}

export function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD"
  }).format(value || 0);
}
