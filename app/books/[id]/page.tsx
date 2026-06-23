"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Save, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BookFormFields } from "@/components/BookFormFields";
import { createCategory, displayCategories, fetchCategories } from "@/lib/categories";
import { createStatus, displayStatus, fetchStatuses } from "@/lib/statuses";
import { deleteBook, fetchBook, updateBook } from "@/lib/inventory-repository";
import { calculateProfit } from "@/lib/mock-data";
import { formatMoney } from "@/lib/stats";
import type { Book, BookDraft, Category, CustomStatus } from "@/lib/types";

export default function BookDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [book, setBook] = useState<Book | null>(null);
  const [draft, setDraft] = useState<BookDraft | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customStatuses, setCustomStatuses] = useState<CustomStatus[]>([]);
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
    }).catch((loadError) => {
      setBook(null);
      setDraft(null);
      setSaveError(loadError instanceof Error ? loadError.message : "Book could not be loaded.");
    }).finally(() => setLoading(false));
    void fetchCategories().then(setCategories).catch(() => setCategories([]));
    void fetchStatuses().then(setCustomStatuses).catch(() => setCustomStatuses([]));
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
            <h1 className="font-serif text-3xl font-black">{loading ? "Loading book..." : "Book not found"}</h1>
            {!loading && saveError && process.env.NODE_ENV === "development" ? <p className="mt-2 text-sm font-semibold text-red-800">{saveError}</p> : null}
            <Link className="btn-primary mt-5" href="/library">Back to Library</Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const profit = calculateProfit(draft.cost, draft.sold_price);
  const galleryUrls = [...(draft.photo_urls ?? []), ...pendingPhotoUrls];
  const displayedCategories = displayCategories(draft);
  const customStatus = displayStatus(draft);

  async function createCategoryFromForm() {
    const name = window.prompt("New category name");
    if (!name?.trim()) return;
    const created = await createCategory(name.trim());
    setCategories((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)));
    setDraft((current) => current ? {
      ...current,
      category_ids: [created.id],
      category_id: created.id,
      category: created.name,
      category_color: created.color
    } : current);
  }

  async function createStatusFromForm() {
    const name = window.prompt("New status name");
    if (!name?.trim()) return;
    const created = await createStatus(name.trim(), "#E9E1D2", customStatuses.length);
    setCustomStatuses((current) => [...current, created].sort((a, b) => a.sort_order - b.sort_order));
    setDraft((current) => current ? {
      ...current,
      status_id: created.id,
      status: created.name,
      status_color: created.color
    } : current);
  }

  return (
    <AppShell>
      <div className="mb-5">
        <Link href="/library" className="btn-secondary">
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
              <p>
                <span
                  className="archive-label"
                  style={{ backgroundColor: customStatus.color }}
                >
                  {customStatus.name}
                </span>
              </p>
              <p className="flex flex-wrap gap-1">
                {displayedCategories.map((category) => (
                  <span
                    key={`${book.id}-${category.name}`}
                    className="archive-label"
                    style={{ backgroundColor: category.color }}
                  >
                    {category.name}
                  </span>
                ))}
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
            statuses={customStatuses}
            onCreateStatus={createStatusFromForm}
            pendingPhotoUrls={pendingPhotoUrls}
            onPhotosSelected={addPendingPhotos}
            onRemovePendingPhoto={removePendingPhoto}
          />
          <button
            className="btn-primary mt-5 w-full text-lg"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              setSaved(false);
              setSaveError("");
              try {
                const updated = await updateBook(book.id, draft, pendingPhotoFiles);
                if (!updated) throw new Error("Supabase did not return the updated book.");
                setBook(updated);
                const { id, inventory_id, inventory_prefix, inventory_number, profit, ...editable } = updated;
                setDraft(editable);
                clearPendingPhotos();
                setSaved(true);
              } catch (error) {
                setSaveError(error instanceof Error ? error.message : "Changes could not be saved.");
              } finally {
                setSaving(false);
              }
            }}
          >
            <Save size={22} aria-hidden />
            {saving ? "Saving..." : saved ? "Saved" : "Save Changes"}
          </button>
          <button
            className="btn-secondary mt-3 w-full justify-center text-lg"
            disabled={saving || deleting}
            onClick={async () => {
              const confirmed = window.confirm(`Delete "${book.title}" from the library? This cannot be undone.`);
              if (!confirmed) return;
              setDeleting(true);
              setSaveError("");
              try {
                await deleteBook(book.id);
                router.push("/library");
              } catch (error) {
                setSaveError(error instanceof Error ? error.message : "Listing could not be deleted.");
                setDeleting(false);
              }
            }}
          >
            <Trash2 size={22} aria-hidden />
            {deleting ? "Deleting..." : "Delete Listing"}
          </button>
          {saveError ? <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-800">{saveError}</p> : null}
        </div>
      </section>
    </AppShell>
  );
}
