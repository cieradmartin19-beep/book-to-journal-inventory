"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, BookOpen, WandSparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { displayCategory } from "@/lib/categories";
import { fetchPublicBooks } from "@/lib/inventory-repository";
import { displayStatus } from "@/lib/statuses";
import type { Book } from "@/lib/types";

export default function PublicBookPage({ params }: { params: { shareId: string; bookId: string } }) {
  const [book, setBook] = useState<Book | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchPublicBooks(params.shareId)
      .then((books) => { if (active) setBook(books.find((item) => item.id === params.bookId && item.show_public) ?? null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [params.bookId, params.shareId]);

  if (loading) return <main className="grid min-h-screen place-items-center p-6 font-bold text-paper/65">Loading The Paper Curio...</main>;
  if (!book) return <main className="grid min-h-screen place-items-center p-6 text-center"><div><h1 className="font-serif text-3xl font-black">Book not available</h1><Link className="btn-primary mt-5" href={`/share/${params.shareId}`}>Back to Public Library</Link></div></main>;

  const category = displayCategory(book);
  const status = displayStatus(book);
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-3 py-4 sm:px-6 sm:py-8">
      <header className="mb-6 flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-md border border-gold bg-gold text-ink"><BookOpen size={26} aria-hidden /></span><div><p className="font-serif text-2xl font-black">The Paper Curio</p><p className="text-sm font-bold text-paper/60">Curated Books • Handmade Journals • Creative Collections</p></div></header>
      <Link href={`/share/${params.shareId}`} className="btn-secondary mb-5"><ArrowLeft size={19} aria-hidden />Public Library</Link>
      <section className="grid gap-5 md:grid-cols-[300px_minmax(0,1fr)]">
        <div className="panel relative aspect-[4/5] overflow-hidden bg-honey/20"><Image src={book.cover_url || "/placeholder-cover.svg"} alt={`${book.title} cover`} fill sizes="300px" className="object-cover" /></div>
        <div className="panel p-5 sm:p-7">
          <p className="text-sm font-black uppercase tracking-wide text-marigold">{book.inventory_id}</p>
          <h1 className="mt-2 font-serif text-3xl font-black sm:text-5xl">{book.title}</h1>
          <p className="mt-2 text-lg font-semibold text-ink/65">{book.author || "Unknown author"}</p>
          <div className="mt-4 flex flex-wrap gap-2"><span className="archive-label" style={{ backgroundColor: category.color }}>{category.name}</span><span className="archive-label" style={{ backgroundColor: status.color }}>{status.name}</span></div>
          {book.publisher ? <p className="mt-5 font-semibold text-ink/70">{[book.publisher, book.published_year].filter(Boolean).join(" • ")}</p> : null}
          <Link href={`/custom-order?shareId=${encodeURIComponent(params.shareId)}&bookId=${book.id}`} className="btn-primary mt-6 w-full sm:w-fit"><WandSparkles size={20} aria-hidden />Request This Book as a Journal</Link>
        </div>
      </section>
    </main>
  );
}
