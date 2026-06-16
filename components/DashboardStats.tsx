import { BookOpenCheck, DollarSign, Hammer, LibraryBig, PackageCheck, Store, Trophy, WandSparkles } from "lucide-react";
import type { DashboardStats as Stats } from "@/lib/types";
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
            <div className="mb-3 grid h-9 w-9 place-items-center rounded-lg bg-honey/45 sm:h-10 sm:w-10">
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
