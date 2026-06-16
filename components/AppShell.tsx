import Link from "next/link";
import { BookOpen, LibraryBig, Plus, QrCode, Upload } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-3 pb-24 pt-3 sm:px-6 sm:pt-4 lg:px-8">
      <header className="flex items-center justify-between gap-3 py-3">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-honey text-ink shadow-soft sm:h-12 sm:w-12">
            <BookOpen size={26} aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-serif text-xl font-black leading-6 sm:text-2xl">
              Book-to-Journal
            </span>
            <span className="text-sm font-bold text-ink/60">Inventory</span>
          </span>
        </Link>
        <Link href="/add" className="btn-primary hidden sm:inline-flex">
          <Plus size={20} aria-hidden />
          Add Book
        </Link>
      </header>
      <main className="flex-1">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-ink/10 bg-paper/95 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur sm:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4 gap-1.5">
          <Link className="btn-secondary min-h-12 flex-col gap-1 px-1.5 py-2 text-xs leading-none" href="/">
            <LibraryBig size={18} aria-hidden />
            Library
          </Link>
          <Link className="btn-primary min-h-12 flex-col gap-1 px-1.5 py-2 text-xs leading-none" href="/add">
            <Plus size={18} aria-hidden />
            Add
          </Link>
          <Link className="btn-secondary min-h-12 flex-col gap-1 px-1.5 py-2 text-xs leading-none" href="/batch-add">
            <Upload size={18} aria-hidden />
            Batch
          </Link>
          <Link className="btn-secondary min-h-12 flex-col gap-1 px-1.5 py-2 text-xs leading-none" href="/share/demo">
            <QrCode size={18} aria-hidden />
            Share
          </Link>
        </div>
      </nav>
    </div>
  );
}
