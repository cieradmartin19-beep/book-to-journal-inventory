"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BookFormFields } from "@/components/BookFormFields";
import { createCategory, displayCategory, fetchCategories } from "@/lib/categories";
import { fetchBook, updateBook } from "@/lib/inventory-repository";
import { calculateProfit } from "@/lib/mock-data";
import { formatMoney } from "@/lib/stats";
import type { Book, BookDraft, Category } from "@/lib/types";

export default function BookDetailPage({ params }: { params: { id: string } }) {
  const [book, setBook] = useState<Book | null>(null);
  const [draft, setDraft] = useState<BookDraft | null>(null);
  const [saved, setSaved] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pendingPhotoFiles, setPendingPhotoFiles] = useState<File[]>([]);
  const [pendingPhotoUrls, setPendingPhotoUrls] = useState<string[]>([]);
  const pendingPhotoUrlsRef = useRef<string[]>([]);

  useEffect(() => {
    void fetchBook(params.id).then((found) => {
      setBook(found);
      if (found) {
        const { id, inventory_id, inventory_prefix, inventory_number, profit, ...editable } = found;
        setDraft(editable);
      }
    });
    void fetchCategories().then(setCategories).catch(() => setCategories([]));
  }, [params.id]);

  useEffect(() => {
    return () => {
      pendingPhotoUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    pendingPhotoUrlsRef.current = pendingPhotoUrls;
  }, [pendingPhotoUrls]);

  function addPendingPhotos(files: File[]) {
    setPendingPhotoFiles((current) => [...current, ...files]);
    setPendingPhotoUrls((current) => [...current, ...files.map((file) => URL.createObjectURL(file))]);
  }

  function removePendingPhoto(index: number) {
    setPendingPhotoFiles((current) => current.filter((_, fileIndex) => fileIndex !== index));
    setPendingPhotoUrls((current) => {
      const removed = current[index];
      if (removed) URL.revokeObjectURL(removed);
      return current.filter((_, urlIndex) => urlIndex !== index);
    });
  }

  function clearPendingPhotos() {
    pendingPhotoUrls.forEach((url) => URL.revokeObjectURL(url));
    setPendingPhotoFiles([]);
    setPendingPhotoUrls([]);
  }

  if (!book || !draft) {
    return (
      <AppShell>
        <div className="panel grid min-h-96 place-items-center p-8 text-center">
          <div>
            <h1 className="font-serif text-3xl font-black">Book not found</h1>
            <Link className="btn-primary mt-5" href="/">Back to Library</Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const profit = calculateProfit(draft.cost, draft.sold_price);
  const galleryUrls = [...(draft.photo_urls ?? []), ...pendingPhotoUrls];
  const category = displayCategory(draft);

  async function createCategoryFromForm() {
    const name = window.prompt("New category name");
    if (!name?.trim()) return;
    const created = await createCategory(name.trim());
    setCategories((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
    setDraft((current) => current ? {
      ...current,
      category_id: created.id,
      category: created.name,
      category_color: created.color
    } : current);
  }

  return (
    <AppShell>
      <div className="mb-5">
        <Link href="/" className="btn-secondary">
          <ArrowLeft size={20} aria-hidden />
          Library
        </Link>
      </div>

      <section className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <div className="panel min-w-0 overflow-hidden">
          <div className="relative aspect-[4/5] bg-honey/20">
            <Image src={draft.cover_url || "/placeholder-cover.svg"} alt={draft.title} fill sizes="320px" className="object-cover" />
          </div>
          <div className="grid gap-3 p-4">
            <p className="text-sm font-black uppercase tracking-wide text-marigold">{book.inventory_id}</p>
            <h1 className="break-words font-serif text-2xl font-black sm:text-3xl">{draft.title}</h1>
            <div className="grid gap-1 text-sm font-bold text-ink/65">
              <p>{draft.book_type}</p>
              <p>
                <span
                  className="inline-flex max-w-full rounded-md px-2 py-1 text-xs font-black text-ink"
                  style={{ backgroundColor: category.color }}
                >
                  {category.name}
                </span>
              </p>
              {draft.isbn ? <p className="break-all">ISBN {draft.isbn}</p> : null}
            </div>
            <div className="rounded-lg bg-mint/20 p-3">
              <p className="text-xs font-black uppercase tracking-wide text-ink/55">Current profit</p>
              <p className="text-2xl font-black">{formatMoney(profit)}</p>
            </div>
            {galleryUrls.length > 0 ? (
              <div className="grid gap-3">
                <p className="text-xs font-black uppercase tracking-wide text-ink/55">Gallery</p>
                <div className="grid grid-cols-2 gap-2">
                  {galleryUrls.map((url, index) => (
                    <div className="aspect-square overflow-hidden rounded-lg bg-honey/20" key={`${url}-${index}`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`${draft.title} photo ${index + 1}`} className="h-full w-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="panel min-w-0 p-4 sm:p-5">
          <BookFormFields
            value={draft}
            onChange={setDraft}
            categories={categories}
            onCreateCategory={createCategoryFromForm}
            pendingPhotoUrls={pendingPhotoUrls}
            onPhotosSelected={addPendingPhotos}
            onRemovePendingPhoto={removePendingPhoto}
          />
          <button
            className="btn-primary mt-5 w-full text-lg"
            onClick={async () => {
              const updated = await updateBook(book.id, draft, pendingPhotoFiles);
              if (updated) {
                setBook(updated);
                const { id, inventory_id, inventory_prefix, inventory_number, profit, ...editable } = updated;
                setDraft(editable);
              }
              clearPendingPhotos();
              setSaved(true);
            }}
          >
            <Save size={22} aria-hidden />
            {saved ? "Saved" : "Save Changes"}
          </button>
        </div>
      </section>
    </AppShell>
  );
}
