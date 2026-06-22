"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Filter, Images, WandSparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { displayCategories, displayCategory } from "@/lib/categories";
import { displayStatus } from "@/lib/statuses";
import { fetchPublicBooks } from "@/lib/inventory-repository";
import type { Book } from "@/lib/types";

export default function PublicLibraryPage({ params }: { params: { shareId: string } }) {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("All Categories");

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

  const publicCategories = useMemo(
    () => Array.from(new Set(books.flatMap((book) => displayCategories(book).map((category) => category.name)))).sort(),
    [books]
  );
  const visibleBooks = useMemo(
    () => books.filter((book) => {
      if (categoryFilter === "All Categories") return true;
      return displayCategories(book).some((category) => category.name === categoryFilter);
    }),
    [books, categoryFilter]
  );

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-3 py-4 sm:px-6 sm:py-5">
      <header className="mb-6 flex items-center justify-between gap-3">
        <BrandLogo className="h-20 w-20 sm:h-24 sm:w-24" />
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
          <section className="panel mb-5 grid gap-3 p-4 sm:max-w-md">
            <div className="flex items-center gap-2">
              <Filter size={19} aria-hidden />
              <h2 className="font-serif text-lg font-black">Filter the collection</h2>
            </div>
            <label className="grid gap-2">
              <span className="label">Category</span>
              <select aria-label="Filter public books by category" className="field" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
                <option>All Categories</option>
                {publicCategories.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </label>
          </section>
          <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">
            {visibleBooks.map((book) => {
              const categories = displayCategories(book);
              const status = displayStatus(book);
              const photoCount = new Set((book.photo_urls ?? []).filter(Boolean)).size;

              return (
                <article className="catalog-card min-w-0" key={book.id}>
              <div className="relative aspect-[4/5] bg-honey/20">
                <Image
                  src={book.cover_url || "/placeholder-cover.svg"}
                  alt={`${book.title} cover`}
                  fill
                  sizes="(max-width: 768px) 50vw, 220px"
                  className="object-cover"
                />
                {photoCount > 1 ? (
                  <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-sm border border-ink/20 bg-paper px-2 py-1 text-[11px] font-black uppercase tracking-wide text-ink shadow-sm">
                    <Images size={14} aria-hidden />
                    {photoCount} photos
                  </span>
                ) : null}
              </div>
              <div className="grid gap-2 p-3">
                <p className="text-xs font-black uppercase tracking-wide text-marigold">{book.inventory_id}</p>
                <h2 className="line-clamp-2 min-h-10 text-sm font-black leading-5">{book.title}</h2>
                <p className="text-xs font-semibold text-ink/60">{book.published_year || "Year unavailable"}</p>
                <div className="flex flex-wrap gap-1">
                  {categories.map((category) => (
                    <span key={`${book.id}-${category.name}`} className="archive-label" style={{ backgroundColor: category.color }}>
                      {category.name}
                    </span>
                  ))}
                  <span className="archive-label" style={{ backgroundColor: status.color }}>
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
