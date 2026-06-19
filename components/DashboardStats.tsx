import { BookOpenCheck, DollarSign, Hammer, LibraryBig, PackageCheck, Store, Trophy, WandSparkles } from "lucide-react";
import type { Book, CustomStatus, DashboardStats as Stats } from "@/lib/types";
import { formatMoney } from "@/lib/stats";

const items = [
  { key: "total", label: "Total books", icon: LibraryBig },
  { key: "inventory", label: "Inventory", icon: PackageCheck },
  { key: "ready", label: "Ready", icon: WandSparkles },
  { key: "inProgress", label: "In progress", icon: Hammer },
  { key: "finished", label: "Finished", icon: BookOpenCheck },
  { key: "listed", label: "Listed", icon: Store },
  { key: "sold", label: "Sold", icon: Trophy },
  { key: "profit", label: "Profit", icon: DollarSign }
] as const;

export function DashboardStats({ stats }: { stats: Stats }) {
  return (
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-8">
      {items.map((item) => {
        const Icon = item.icon;
        const value = item.key === "profit" ? formatMoney(stats.profit) : stats[item.key];

        return (
          <div className="panel min-w-0 p-3 sm:p-4" key={item.key}>
            <div className="mb-3 grid h-9 w-9 place-items-center rounded-md border border-gold/50 bg-honey/45 sm:h-10 sm:w-10">
              <Icon size={20} aria-hidden />
            </div>
            <p className="text-xs font-black uppercase text-ink/55 sm:tracking-wide">{item.label}</p>
            <p className="mt-1 truncate text-xl font-black sm:text-2xl">{value}</p>
          </div>
        );
      })}
    </section>
  );
}

const statusIcons = [PackageCheck, WandSparkles, Hammer, BookOpenCheck, Store, Trophy];

export function CustomDashboardStats({ books, statuses }: { books: Book[]; statuses: CustomStatus[] }) {
  const profit = books.reduce((sum, book) => sum + Number(book.profit || 0), 0);
  const visibleStatuses = statuses.length
    ? statuses
    : Array.from(new Set(books.map((book) => book.status).filter(Boolean))).map((name, index) => ({
        id: name,
        name,
        color: "#E9E1D2",
        sort_order: index
      } as CustomStatus));

  return (
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3 lg:grid-cols-8">
      <div className="panel min-w-0 p-3 sm:p-4">
        <div className="mb-3 grid h-9 w-9 place-items-center rounded-md border border-gold/50 bg-honey/45 sm:h-10 sm:w-10">
          <LibraryBig size={20} aria-hidden />
        </div>
        <p className="text-xs font-black uppercase text-ink/55 sm:tracking-wide">Total books</p>
        <p className="mt-1 truncate text-xl font-black sm:text-2xl">{books.length}</p>
      </div>
      {visibleStatuses.map((status, index) => {
        const Icon = statusIcons[index % statusIcons.length];
        const count = books.filter((book) => book.status_id === status.id || (!book.status_id && book.status === status.name)).length;

        return (
          <div className="panel min-w-0 p-3 sm:p-4" key={status.id}>
            <div className="mb-3 grid h-9 w-9 place-items-center rounded-md border border-ink/25 sm:h-10 sm:w-10" style={{ backgroundColor: status.color }}>
              <Icon size={20} aria-hidden />
            </div>
            <p className="truncate text-xs font-black uppercase text-ink/55 sm:tracking-wide">{status.name}</p>
            <p className="mt-1 truncate text-xl font-black sm:text-2xl">{count}</p>
          </div>
        );
      })}
      <div className="panel min-w-0 p-3 sm:p-4">
        <div className="mb-3 grid h-9 w-9 place-items-center rounded-md border border-gold/50 bg-honey/45 sm:h-10 sm:w-10">
          <DollarSign size={20} aria-hidden />
        </div>
        <p className="text-xs font-black uppercase text-ink/55 sm:tracking-wide">Profit</p>
        <p className="mt-1 truncate text-xl font-black sm:text-2xl">{formatMoney(profit)}</p>
      </div>
    </section>
  );
}
