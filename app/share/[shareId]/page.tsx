"use client";

import Link from "next/link";
import Image from "next/image";
import { BookOpen, ArrowLeft, WandSparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { displayCategory } from "@/lib/categories";
import { displayStatus } from "@/lib/statuses";
import { fetchPublicBooks } from "@/lib/inventory-repository";
import type { Book } from "@/lib/types";

export default function PublicSharePage({ params }: { params: { shareId: string } }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("All");

  useEffect(() => {
    let mounted = true;

    async function loadPublicBooks() {
      setLoading(true);
      setLoadFailed(false);

      try {
        const items = await fetchPublicBooks(params.shareId);
        if (!mounted) return;
        setBooks((items ?? []).filter((book) => book.show_public));
      } catch {
        if (!mounted) return;
        setBooks([]);
        setLoadFailed(true);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void loadPublicBooks();

    return () => {
      mounted = false;
    };
  }, [params.shareId]);

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-3 py-4 sm:px-6 sm:py-5">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-honey shadow-soft sm:h-12 sm:w-12">
            <BookOpen size={25} aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="font-serif text-2xl font-black leading-tight sm:text-3xl">The Paper Curio</h1>
            <p className="font-semibold text-ink/65">Curated Books • Handmade Journals • Creative Collections</p>
          </div>
        </div>
        <Link href="/" className="btn-secondary hidden sm:inline-flex">
          <ArrowLeft size={20} aria-hidden />
          Owner View
        </Link>
      </header>

      <div className="mb-5">
        <Link href={`/custom-order?shareId=${encodeURIComponent(params.shareId)}`} className="btn-primary w-full sm:w-fit"><WandSparkles size={20} aria-hidden />Request Custom Journal</Link>
      </div>

      {loading ? (
        <div className="panel grid min-h-80 place-items-center p-8 text-center">
          <p className="font-bold text-ink/65">Loading The Paper Curio...</p>
        </div>
      ) : loadFailed ? (
        <div className="rounded-lg border-2 border-red-200 bg-red-50 p-6 text-center">
          <h2 className="font-serif text-3xl font-black text-red-900">Public library could not be loaded</h2>
          <p className="mt-2 font-semibold text-red-800">Please try again later.</p>
        </div>
      ) : books.length > 0 ? (
        <>
          {Array.from(new Set(books.map((book) => displayCategory(book).name))).length > 1 ? (
            <div className="panel mb-5 p-3 sm:max-w-xs">
              <select className="field" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option>All</option>
                {Array.from(new Set(books.map((book) => displayCategory(book).name))).sort().map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </div>
          ) : null}
          <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
            {books.filter((book) => categoryFilter === "All" || displayCategory(book).name === categoryFilter).map((book) => {
              const category = displayCategory(book);
              const status = displayStatus(book);

              return (
                <article className="panel min-w-0 overflow-hidden" key={book.id}>
              <div className="relative aspect-[4/5] bg-honey/20">
                <Image
                  src={book.cover_url || "/placeholder-cover.svg"}
                  alt={`${book.title} cover`}
                  fill
                  sizes="(max-width: 768px) 50vw, 220px"
                  className="object-cover"
                />
              </div>
              <div className="grid gap-2 p-3">
                <p className="text-xs font-black uppercase tracking-wide text-marigold">{book.inventory_id}</p>
                <h2 className="line-clamp-2 min-h-10 text-sm font-black leading-5">{book.title}</h2>
                <p className="truncate text-xs font-semibold text-ink/60">{book.author || "Unknown author"}</p>
                <div className="flex flex-wrap gap-1">
                  <span className="max-w-full truncate rounded-md px-2 py-1 text-xs font-bold" style={{ backgroundColor: category.color }}>
                    {category.name}
                  </span>
                  <span className="max-w-full truncate rounded-md px-2 py-1 text-xs font-bold" style={{ backgroundColor: status.color }}>
                    {status.name}
                  </span>
                </div>
                <div className="mt-1 grid gap-2">
                  <Link className="btn-secondary w-full px-2 py-2 text-xs" href={`/share/${params.shareId}/books/${book.id}`}>View Book</Link>
                  <Link className="btn-primary w-full px-2 py-2 text-xs" href={`/custom-order?shareId=${encodeURIComponent(params.shareId)}&bookId=${book.id}`}>Request Journal</Link>
                </div>
              </div>
            </article>
              );
            })}
          </section>
        </>
      ) : (
        <div className="panel grid min-h-80 place-items-center p-8 text-center">
          <div>
            <h2 className="font-serif text-3xl font-black">No public books yet</h2>
            <p className="mt-2 font-semibold text-ink/65">No public books yet. Mark books as public to share them.</p>
          </div>
        </div>
      )}
    </main>
  );
}
