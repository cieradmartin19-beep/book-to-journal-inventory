"use client";

import Link from "next/link";
import Image from "next/image";
import { BookOpen, ArrowLeft } from "lucide-react";
import { useEffect, useState } from "react";
import { fetchPublicBooks } from "@/lib/inventory-repository";
import type { Book } from "@/lib/types";

export default function PublicSharePage({ params }: { params: { shareId: string } }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

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
            <h1 className="font-serif text-2xl font-black leading-tight sm:text-3xl">Public Book Library</h1>
            <p className="font-semibold text-ink/65">A shareable peek at selected books and journals.</p>
          </div>
        </div>
        <Link href="/" className="btn-secondary hidden sm:inline-flex">
          <ArrowLeft size={20} aria-hidden />
          Owner View
        </Link>
      </header>

      {loading ? (
        <div className="panel grid min-h-80 place-items-center p-8 text-center">
          <p className="font-bold text-ink/65">Loading public library...</p>
        </div>
      ) : loadFailed ? (
        <div className="rounded-lg border-2 border-red-200 bg-red-50 p-6 text-center">
          <h2 className="font-serif text-3xl font-black text-red-900">Public library could not be loaded</h2>
          <p className="mt-2 font-semibold text-red-800">Please try again later.</p>
        </div>
      ) : books.length > 0 ? (
        <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
          {books.map((book) => (
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
                  <span className="max-w-full truncate rounded-md bg-mint/25 px-2 py-1 text-xs font-bold">{book.category}</span>
                  <span className="max-w-full truncate rounded-md bg-honey/35 px-2 py-1 text-xs font-bold">{book.book_type}</span>
                  <span className="max-w-full truncate rounded-md bg-rose/15 px-2 py-1 text-xs font-bold">{book.status}</span>
                </div>
              </div>
            </article>
          ))}
        </section>
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
