"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, Save, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BookFormFields } from "@/components/BookFormFields";
import { InventoryPrefixSettings } from "@/components/InventoryPrefixSettings";
import { createCategory, fetchCategories } from "@/lib/categories";
import { createStatus, fetchStatuses } from "@/lib/statuses";
import { blankDraft, fileToDataUrl, scanCoverForBook, suggestionToDraft } from "@/lib/book-lookup";
import { createBook, fetchBooks } from "@/lib/inventory-repository";
import { nextInventoryId } from "@/lib/mock-data";
import type { Book, BookDraft, Category, CustomStatus, GoogleBookSuggestion } from "@/lib/types";

type BatchItem = {
  id: string;
  fileName: string;
  image: string;
  state: "looking" | "review" | "saved";
  suggestion?: GoogleBookSuggestion;
  suggestions: GoogleBookSuggestion[];
  draft: BookDraft;
  statusText?: string;
};

export default function BatchAddPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [prefix, setPrefix] = useState("BK");
  const [items, setItems] = useState<BatchItem[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customStatuses, setCustomStatuses] = useState<CustomStatus[]>([]);

  useEffect(() => {
    void fetchBooks().then((items) => setBooks(items ?? []));
    void fetchCategories().then(setCategories).catch(() => setCategories([]));
    void fetchStatuses().then(setCustomStatuses).catch(() => setCustomStatuses([]));
  }, []);

  const firstNextId = useMemo(() => {
    if (typeof window === "undefined") return `${prefix}-001`;
    return nextInventoryId(books, prefix);
  }, [books, prefix]);

  async function handleFiles(files: FileList) {
    const nextItems: BatchItem[] = [];
    for (const file of Array.from(files)) {
      const image = await fileToDataUrl(file);
      nextItems.push({
        id: crypto.randomUUID(),
        fileName: file.name,
        image,
        state: "looking",
        suggestions: [],
        draft: blankDraft(image)
      });
    }

    setItems((current) => [...current, ...nextItems]);

    for (const item of nextItems) {
      const result = await scanCoverForBook(item.image);
      const ocrDraft = {
        ...item.draft,
        title: result.detectedTitle,
        author: result.detectedAuthor,
        isbn: result.detectedIsbn
      };
      setItems((current) =>
        current.map((existing) =>
          existing.id === item.id
            ? {
                ...existing,
                state: "review",
                suggestion: result.suggestions[0],
                suggestions: result.suggestions,
                draft: result.suggestions[0] ? suggestionToDraft(result.suggestions[0], ocrDraft) : ocrDraft,
                statusText: result.suggestions.length
                  ? result.detectedIsbn
                    ? `Detected ISBN ${result.detectedIsbn}. Choose the matching Google Books result.`
                    : `Detected "${result.detectedTitle}". Choose the matching Google Books result.`
                  : result.message || "No Google Books match found. Fill in the details manually."
              }
            : existing
        )
      );
    }
  }

  function updateItem(id: string, draft: BookDraft) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, draft } : item)));
  }

  function selectSuggestion(id: string, suggestion: GoogleBookSuggestion) {
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              suggestion,
              draft: suggestionToDraft(suggestion, item.draft)
            }
          : item
      )
    );
  }

  async function createCategoryForItem(id: string) {
    const name = window.prompt("New category name");
    if (!name?.trim()) return;
    const category = await createCategory(name.trim());
    setCategories((current) => [...current, category].sort((a, b) => a.name.localeCompare(b.name)));
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              draft: {
                ...item.draft,
                category_id: category.id,
                category: category.name,
                category_color: category.color
              }
            }
          : item
      )
    );
  }

  async function createStatusForItem(id: string) {
    const name = window.prompt("New status name");
    if (!name?.trim()) return;
    const status = await createStatus(name.trim(), "#E9E1D2", customStatuses.length);
    setCustomStatuses((current) => [...current, status].sort((a, b) => a.sort_order - b.sort_order));
    setItems((current) =>
      current.map((item) =>
        item.id === id
          ? {
              ...item,
              draft: {
                ...item.draft,
                status_id: status.id,
                status: status.name,
                status_color: status.color
              }
            }
          : item
      )
    );
  }

  async function saveItem(id: string) {
    const item = items.find((candidate) => candidate.id === id);
    if (!item || item.state === "saved") return;

    const saved = await createBook(
      {
        ...item.draft,
        title: item.draft.title || "Untitled book",
        category: item.draft.category || "Uncategorized"
      },
      prefix
    );
    setBooks((current) => [saved, ...current]);
    setItems((current) => current.map((candidate) => (candidate.id === id ? { ...candidate, state: "saved" } : candidate)));
  }

  async function saveAll() {
    const reviewed = items.filter((item) => item.state === "review");
    const savedBooks: Book[] = [];
    for (const item of reviewed) {
      savedBooks.push(
        await createBook(
          {
            ...item.draft,
            title: item.draft.title || "Untitled book",
            category: item.draft.category || "Uncategorized"
          },
          prefix
        )
      );
    }
    setBooks((current) => [...savedBooks, ...current]);
    setItems((current) => current.map((item) => (item.state === "review" ? { ...item, state: "saved" } : item)));
  }

  return (
    <AppShell>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:flex sm:items-center sm:justify-between">
        <Link href="/add" className="btn-secondary w-full sm:w-auto">
          <ArrowLeft size={20} aria-hidden />
          Add Book
        </Link>
        <Link href="/" className="btn-secondary w-full sm:w-auto">Library</Link>
      </div>

      <section className="panel p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
          <div className="min-w-0">
            <p className="text-sm font-black uppercase tracking-wide text-marigold">Batch Add</p>
            <h1 className="font-serif text-3xl font-black leading-tight sm:text-4xl">Upload several covers</h1>
            <p className="mt-2 max-w-2xl font-semibold text-ink/70">
              Each cover gets scanned, suggested, and held for review before it receives the next available inventory number.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
            <button className="btn-primary" onClick={() => inputRef.current?.click()}>
              <Upload size={22} aria-hidden />
              Upload Covers
            </button>
            <button className="btn-secondary" disabled={!items.some((item) => item.state === "review")} onClick={saveAll}>
              <Save size={20} aria-hidden />
              Save Reviewed
            </button>
          </div>
        </div>
        <input
          ref={inputRef}
          className="hidden"
          type="file"
          accept="image/*"
          multiple
          onChange={(event) => {
            if (event.target.files) void handleFiles(event.target.files);
          }}
        />
        <p className="mt-4 rounded-lg bg-honey/25 p-3 text-sm font-bold text-ink/70">
          First new item will start at {firstNextId}; the rest continue in order as you save them.
        </p>
      </section>

      <section className="mt-5">
        <InventoryPrefixSettings value={prefix} onChange={setPrefix} />
      </section>

      <section className="mt-5 grid gap-5">
        {items.length === 0 && (
          <div className="panel grid min-h-72 place-items-center p-8 text-center">
            <div>
              <Upload className="mx-auto mb-4 text-marigold" size={48} aria-hidden />
              <h2 className="font-serif text-3xl font-black">No covers yet</h2>
              <p className="mt-2 font-semibold text-ink/65">Upload a group of photos to start the review queue.</p>
            </div>
          </div>
        )}

        {items.map((item, index) => (
          <article className="panel grid gap-4 p-3 sm:p-4 lg:grid-cols-[170px_minmax(0,1fr)]" key={item.id}>
            <div>
              <div className="relative aspect-[4/5] max-w-44 overflow-hidden rounded-lg bg-honey/20 lg:max-w-none">
                <Image src={item.draft.cover_url || item.image} alt={item.fileName} fill sizes="180px" className="object-cover" />
              </div>
              <p className="mt-2 truncate text-xs font-bold text-ink/55">{item.fileName}</p>
            </div>
            <div className="grid min-w-0 gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black uppercase tracking-wide text-marigold">Review #{index + 1}</p>
                  <h2 className="break-words text-xl font-black sm:text-2xl">
                    {item.state === "looking" ? "Looking for your book..." : item.draft.title || "Untitled book"}
                  </h2>
                  {item.statusText ? <p className="mt-1 text-sm font-semibold text-ink/65">{item.statusText}</p> : null}
                </div>
                {item.state === "looking" ? (
                  <Loader2 className="animate-spin text-marigold" size={32} aria-hidden />
                ) : item.state === "saved" ? (
                  <span className="inline-flex items-center gap-2 rounded-lg bg-mint/25 px-3 py-2 font-black">
                    <Check size={18} aria-hidden />
                    Saved
                  </span>
                ) : (
                  <button className="btn-primary" onClick={() => saveItem(item.id)}>
                    <Save size={20} aria-hidden />
                    Save This Book
                  </button>
                )}
              </div>
              {item.state !== "looking" && (
                <>
                  {item.suggestions.length > 0 && (
                    <div className="grid gap-3 md:grid-cols-2">
                      {item.suggestions.map((match) => {
                        const selected = item.suggestion?.isbn
                          ? item.suggestion.isbn === match.isbn
                          : item.suggestion?.title === match.title && item.suggestion?.author === match.author;

                        return (
                          <button
                            className={`grid min-w-0 grid-cols-[52px_minmax(0,1fr)] gap-3 rounded-lg border-2 bg-white p-3 text-left transition ${
                              selected ? "border-marigold ring-4 ring-honey/30" : "border-ink/10 hover:border-marigold"
                            }`}
                            key={`${item.id}-${match.isbn}-${match.title}-${match.author}`}
                            onClick={() => selectSuggestion(item.id, match)}
                          >
                            <div className="relative aspect-[4/5] overflow-hidden rounded-md bg-honey/20">
                              <Image
                                src={match.thumbnail || "/placeholder-cover.svg"}
                                alt={`${match.title} cover`}
                                fill
                                sizes="52px"
                                className="object-cover"
                              />
                            </div>
                            <span className="min-w-0">
                              <span className="line-clamp-2 text-sm font-black leading-5">{match.title || "Untitled book"}</span>
                              <span className="mt-1 block truncate text-xs font-bold text-ink/60">{match.author || "Unknown author"}</span>
                              <span className="mt-2 block truncate text-xs font-bold text-ink/50">
                                {[match.publisher, match.published_year, match.isbn].filter(Boolean).join(" - ") || "Google Books"}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <BookFormFields
                    value={item.draft}
                    onChange={(draft) => updateItem(item.id, draft)}
                    categories={categories}
                    onCreateCategory={() => createCategoryForItem(item.id)}
                    statuses={customStatuses}
                    onCreateStatus={() => createStatusForItem(item.id)}
                  />
                </>
              )}
            </div>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
