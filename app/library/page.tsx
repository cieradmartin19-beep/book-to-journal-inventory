"use client";

import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BookCard } from "@/components/BookCard";
import { fetchCategories } from "@/lib/categories";
import { deleteBook, fetchBooks } from "@/lib/inventory-repository";
import { fetchStatuses } from "@/lib/statuses";
import type { Book, Category, CustomStatus } from "@/lib/types";

export default function LibraryPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [statuses, setStatuses] = useState<CustomStatus[]>([]);
  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [statusId, setStatusId] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deletingId, setDeletingId] = useState("");

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("saved") === "true") {
      setSavedMessage("Book saved successfully.");
    }
    let active = true;
    Promise.allSettled([fetchBooks(), fetchCategories(), fetchStatuses()]).then((results) => {
      if (!active) return;
      const [booksResult, categoryResult, statusResult] = results;
      if (booksResult.status === "fulfilled") setBooks(booksResult.value);
      else setError(booksResult.reason instanceof Error ? booksResult.reason.message : "Books could not be loaded.");
      if (categoryResult.status === "fulfilled") setCategories(categoryResult.value);
      if (statusResult.status === "fulfilled") setStatuses(statusResult.value);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const categoryOptions = useMemo(() => {
    const legacy = books.filter((book) => !book.category_id && book.category && book.category !== "Uncategorized")
      .map((book) => ({ id: `legacy:${book.category}`, name: book.category }));
    return Array.from(new Map([...legacy, ...categories].map((item) => [item.name.toLowerCase(), item])).values());
  }, [books, categories]);

  const statusOptions = useMemo(() => {
    const legacy = books.filter((book) => !book.status_id && book.status)
      .map((book) => ({ id: `legacy:${book.status}`, name: book.status }));
    return Array.from(new Map([...legacy, ...statuses].map((item) => [item.name.toLowerCase(), item])).values());
  }, [books, statuses]);

  const filteredBooks = useMemo(() => books.filter((book) => {
    const text = `${book.title} ${book.author} ${book.isbn} ${book.inventory_id}`.toLowerCase();
    const categoryKey = book.category_id || `legacy:${book.category || "Uncategorized"}`;
    const statusKey = book.status_id || `legacy:${book.status || "Inventory"}`;
    const selectedCategoryName = categoryOptions.find((item) => item.id === categoryId)?.name;
    const selectedStatusName = statusOptions.find((item) => item.id === statusId)?.name;
    const matchesCategory = categoryId === "all"
      || categoryKey === categoryId
      || book.category === selectedCategoryName
      || (book.category_ids ?? []).includes(categoryOptions.find((item) => item.id === categoryId)?.id || "")
      || (book.category_names ?? []).includes(selectedCategoryName || "");
    return text.includes(query.trim().toLowerCase())
      && matchesCategory
      && (statusId === "all" || statusKey === statusId || book.status === selectedStatusName);
  }), [books, categoryId, categoryOptions, query, statusId, statusOptions]);

  async function handleDeleteBook(book: Book) {
    const confirmed = window.confirm(`Delete "${book.title}" from the library? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingId(book.id);
    setDeleteError("");
    try {
      await deleteBook(book.id);
      setBooks((current) => current.filter((item) => item.id !== book.id));
      setSavedMessage("Listing deleted.");
    } catch (deleteFailure) {
      setDeleteError(deleteFailure instanceof Error ? deleteFailure.message : "Listing could not be deleted.");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <AppShell>
      <section className="flex flex-col gap-4 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="page-kicker">Library</p>
          <h1 className="font-serif text-3xl font-black sm:text-5xl">All books</h1>
          <p className="page-subtitle mt-2">{books.length} saved book{books.length === 1 ? "" : "s"}</p>
        </div>
        <Link href="/add" className="btn-primary w-full sm:w-fit"><Plus size={20} aria-hidden />Add Book</Link>
      </section>

      {savedMessage ? <p className="mb-4 rounded-lg bg-mint/30 p-3 font-black">{savedMessage}</p> : null}
      {deleteError ? <p className="mb-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-800">{deleteError}</p> : null}
      <div className="panel grid gap-3 p-3 md:grid-cols-[minmax(0,1fr)_200px_200px]">
        <label className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/45" size={20} aria-hidden />
          <input className="field pl-11" placeholder="Search title, author, or ISBN" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <select className="field" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="all">All categories</option><option value="legacy:Uncategorized">Uncategorized</option>
          {categoryOptions.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
        <select className="field" value={statusId} onChange={(event) => setStatusId(event.target.value)}>
          <option value="all">All statuses</option>
          {statusOptions.map((status) => <option key={status.id} value={status.id}>{status.name}</option>)}
        </select>
      </div>

      {loading ? <div className="panel mt-5 p-5 font-bold text-ink/65">Loading books...</div> : null}
      {!loading && error ? <div className="mt-5 rounded-lg border-2 border-red-200 bg-red-50 p-5"><h2 className="text-xl font-black text-red-900">Books could not be loaded</h2><p className="mt-2 font-semibold text-red-800">Please refresh and try again.</p>{process.env.NODE_ENV === "development" ? <p className="mt-2 break-words text-sm text-red-800">{error}</p> : null}</div> : null}
      {!loading && !error && filteredBooks.length > 0 ? <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5">{filteredBooks.map((book) => <BookCard key={book.id} book={book} onDelete={handleDeleteBook} deleting={deletingId === book.id} />)}</div> : null}
      {!loading && !error && filteredBooks.length === 0 ? <div className="panel mt-5 grid min-h-64 place-items-center p-8 text-center"><div><h2 className="font-serif text-2xl font-black">{books.length ? "No books match these filters" : "The Paper Curio is ready"}</h2><p className="mt-2 font-semibold text-ink/65">{books.length ? "Try another search, category, or status." : "Add your first book to begin cataloging."}</p>{!books.length ? <Link href="/add" className="btn-primary mt-5"><Plus size={20} aria-hidden />Add Book</Link> : null}</div></div> : null}
    </AppShell>
  );
}
