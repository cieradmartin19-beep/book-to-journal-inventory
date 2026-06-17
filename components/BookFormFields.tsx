"use client";

import { bookTypes, conditions, type Book } from "@/lib/types";
import type { Category } from "@/lib/types";
import type { CustomStatus } from "@/lib/types";

type EditableBook = Omit<Book, "id" | "inventory_id" | "inventory_prefix" | "inventory_number" | "profit">;

export function BookFormFields({
  value,
  onChange,
  categories = [],
  onCreateCategory,
  statuses = [],
  onCreateStatus,
  pendingPhotoUrls = [],
  onPhotosSelected,
  onRemovePendingPhoto
}: {
  value: EditableBook;
  onChange: (book: EditableBook) => void;
  categories?: Category[];
  onCreateCategory?: () => void;
  statuses?: CustomStatus[];
  onCreateStatus?: () => void;
  pendingPhotoUrls?: string[];
  onPhotosSelected?: (files: File[]) => void;
  onRemovePendingPhoto?: (index: number) => void;
}) {
  const set = <K extends keyof EditableBook>(key: K, nextValue: EditableBook[K]) => {
    onChange({ ...value, [key]: nextValue });
  };

  const savedPhotoUrls = value.photo_urls ?? [];
  const allPhotoUrls = [...savedPhotoUrls, ...pendingPhotoUrls];
  const legacyCategoryValue = !value.category_id && value.category && value.category !== "Uncategorized" ? `legacy:${value.category}` : "";
  const categorySelectValue = value.category_id ?? legacyCategoryValue;
  const legacyStatusValue = !value.status_id && value.status && !statuses.some((item) => item.name === value.status) ? `legacy:${value.status}` : "";
  const statusSelectValue = value.status_id ?? legacyStatusValue;

  return (
    <div className="grid gap-4">
      <label className="grid gap-2">
        <span className="label">Title</span>
        <input className="field" value={value.title} onChange={(event) => set("title", event.target.value)} />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className="label">Author</span>
          <input className="field" value={value.author} onChange={(event) => set("author", event.target.value)} />
        </label>
        <label className="grid gap-2">
          <span className="label">Publisher</span>
          <input className="field" value={value.publisher} onChange={(event) => set("publisher", event.target.value)} />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className="label">ISBN</span>
          <input className="field" inputMode="numeric" value={value.isbn} onChange={(event) => set("isbn", event.target.value)} />
        </label>
        <label className="grid gap-2">
          <span className="label">Year</span>
          <input className="field" value={value.published_year} onChange={(event) => set("published_year", event.target.value)} />
        </label>
      </div>
      <label className="grid gap-2">
        <span className="label">Cover image URL</span>
        <input className="field" value={value.cover_url} onChange={(event) => set("cover_url", event.target.value)} />
      </label>
      <div className="grid gap-3 rounded-lg border-2 border-ink/10 bg-white p-4 sm:grid-cols-[92px_minmax(0,1fr)]">
        <div className="aspect-[4/5] overflow-hidden rounded-lg bg-honey/20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value.cover_url || "/placeholder-cover.svg"}
            alt="Cover preview"
            className="h-full w-full object-cover"
          />
        </div>
        <div className="self-center">
          <p className="font-black">Cover preview</p>
          <p className="mt-1 text-sm font-semibold text-ink/60">
            Google Books covers are saved here automatically when available. If no cover is found, paste a cover URL or add photos below.
          </p>
        </div>
      </div>
      {onPhotosSelected || allPhotoUrls.length > 0 ? (
        <div className="grid gap-3 rounded-lg border-2 border-ink/10 bg-white p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-black">Book photos</p>
              <p className="text-sm font-semibold text-ink/60">Add cover, spine, back, condition, or finished journal photos.</p>
            </div>
            {onPhotosSelected ? (
              <label className="btn-secondary cursor-pointer">
                Add Photos
                <input
                  className="hidden"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? []);
                    if (files.length > 0) onPhotosSelected(files);
                    event.target.value = "";
                  }}
                />
              </label>
            ) : null}
          </div>
          {allPhotoUrls.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {allPhotoUrls.map((url, index) => {
                const saved = index < savedPhotoUrls.length;

                return (
                  <div className="overflow-hidden rounded-lg border-2 border-ink/10 bg-paper" key={`${url}-${index}`}>
                    <div className="aspect-square bg-honey/20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Book photo ${index + 1}`} className="h-full w-full object-cover" />
                    </div>
                    <button
                      className="w-full px-3 py-2 text-sm font-black text-ink/70 transition hover:bg-rose/15"
                      type="button"
                      onClick={() => {
                        if (saved) {
                          set("photo_urls", savedPhotoUrls.filter((_, photoIndex) => photoIndex !== index) as EditableBook["photo_urls"]);
                        } else {
                          onRemovePendingPhoto?.(index - savedPhotoUrls.length);
                        }
                      }}
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="rounded-lg bg-honey/20 p-3 text-sm font-bold text-ink/65">No extra photos yet.</p>
          )}
        </div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className="label">Category</span>
          <select
            className="field"
            value={categorySelectValue}
            onChange={(event) => {
              if (event.target.value === "__new") {
                onCreateCategory?.();
                return;
              }
              if (event.target.value.startsWith("legacy:")) return;

              const category = categories.find((item) => item.id === event.target.value);
              onChange({
                ...value,
                category_id: category?.id ?? null,
                category: category?.name ?? "Uncategorized",
                category_color: category?.color ?? null
              });
            }}
          >
            <option value="">Uncategorized</option>
            {legacyCategoryValue ? <option value={legacyCategoryValue}>{value.category}</option> : null}
            {categories.map((category) => (
              <option key={category.id} value={category.id}>{category.name}</option>
            ))}
            <option value="__new">+ New Category</option>
          </select>
        </label>
        <label className="grid gap-2">
          <span className="label">Book type</span>
          <select className="field" value={value.book_type} onChange={(event) => set("book_type", event.target.value as EditableBook["book_type"])}>
            {bookTypes.map((bookType) => <option key={bookType}>{bookType}</option>)}
          </select>
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2">
          <span className="label">Condition</span>
          <select className="field" value={value.condition} onChange={(event) => set("condition", event.target.value as EditableBook["condition"])}>
            {conditions.map((condition) => <option key={condition}>{condition}</option>)}
          </select>
        </label>
        <label className="grid gap-2">
          <span className="label">Status</span>
          <select
            className="field"
            value={statusSelectValue}
            onChange={(event) => {
              if (event.target.value === "__new") {
                onCreateStatus?.();
                return;
              }
              if (event.target.value.startsWith("legacy:")) return;

              const status = statuses.find((item) => item.id === event.target.value);
              onChange({
                ...value,
                status_id: status?.id ?? null,
                status: (status?.name ?? "Inventory") as EditableBook["status"],
                status_color: status?.color ?? null
              });
            }}
          >
            {statuses.length === 0 ? <option value="">Inventory</option> : null}
            {legacyStatusValue ? <option value={legacyStatusValue}>{value.status}</option> : null}
            {statuses.map((status) => (
              <option key={status.id} value={status.id}>{status.name}</option>
            ))}
            <option value="__new">+ New Status</option>
          </select>
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="grid gap-2">
          <span className="label">Cost</span>
          <input className="field" type="number" min="0" step="0.01" value={value.cost} onChange={(event) => set("cost", Number(event.target.value))} />
        </label>
        <label className="grid gap-2">
          <span className="label">Listed price</span>
          <input className="field" type="number" min="0" step="0.01" value={value.listed_price} onChange={(event) => set("listed_price", Number(event.target.value))} />
        </label>
        <label className="grid gap-2">
          <span className="label">Sold price</span>
          <input className="field" type="number" min="0" step="0.01" value={value.sold_price} onChange={(event) => set("sold_price", Number(event.target.value))} />
        </label>
      </div>
      <label className="flex items-center justify-between gap-4 rounded-lg border-2 border-marigold/40 bg-honey/20 px-4 py-3">
        <span>
          <span className="block font-black">Show on public library</span>
          <span className="mt-1 block text-sm font-semibold text-ink/65">
            Only books with this enabled appear on the QR/share page.
          </span>
        </span>
        <input
          className="h-8 w-8 shrink-0 accent-marigold"
          type="checkbox"
          checked={value.show_public}
          onChange={(event) => set("show_public", event.target.checked)}
        />
      </label>
      <label className="grid gap-2">
        <span className="label">Notes</span>
        <textarea className="field min-h-28" value={value.notes} onChange={(event) => set("notes", event.target.value)} />
      </label>
    </div>
  );
}
