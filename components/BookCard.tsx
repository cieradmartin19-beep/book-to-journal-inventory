"use client";

import Image from "next/image";
import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { displayCategory } from "@/lib/categories";
import type { Book } from "@/lib/types";
import { formatMoney } from "@/lib/stats";

export function BookCard({ book }: { book: Book }) {
  const category = displayCategory(book);

  return (
    <Link
      href={`/books/${book.id}`}
      className="panel block min-w-0 overflow-hidden transition hover:-translate-y-1"
    >
      <div className="relative aspect-[4/5] bg-honey/25">
        <Image
          src={book.cover_url || "/placeholder-cover.svg"}
          alt={`${book.title} cover`}
          fill
          sizes="(max-width: 768px) 50vw, 220px"
          className="object-cover"
        />
        <span className="absolute left-2 top-2 rounded-md bg-paper px-2 py-1 text-xs font-black shadow-sm">
          {book.inventory_id}
        </span>
      </div>
      <div className="space-y-2 p-2.5 sm:p-3">
        <div>
          <h3 className="line-clamp-2 min-h-10 text-sm font-black leading-5">{book.title}</h3>
          <p className="truncate text-xs font-semibold text-ink/60">{book.author || "Unknown author"}</p>
        </div>
        <div className="flex flex-wrap gap-1">
          <span className="max-w-full truncate rounded-md px-2 py-1 text-xs font-bold" style={{ backgroundColor: category.color }}>
            {category.name}
          </span>
          <span className="max-w-full truncate rounded-md bg-honey/35 px-2 py-1 text-xs font-bold">{book.book_type}</span>
          <span className="max-w-full truncate rounded-md bg-rose/15 px-2 py-1 text-xs font-bold">{book.status}</span>
        </div>
        <div className="flex items-center justify-between gap-2 text-xs font-bold text-ink/65">
          <span className="min-w-0 truncate">{book.status === "Sold" ? formatMoney(book.profit) : book.condition}</span>
          {book.show_public ? <Eye size={16} aria-label="Public" /> : <EyeOff size={16} aria-label="Private" />}
        </div>
      </div>
    </Link>
  );
}
