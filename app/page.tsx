"use client";

import Link from "next/link";
import { Copy, ExternalLink, ListChecks, Plus, QrCode, Search, Settings, Upload } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BookCard } from "@/components/BookCard";
import { CustomDashboardStats } from "@/components/DashboardStats";
import { InventoryPrefixSettings } from "@/components/InventoryPrefixSettings";
import { QRCodeBox } from "@/components/QRCodeBox";
import { fetchCategories } from "@/lib/categories";
import { fetchStatuses } from "@/lib/statuses";
import { fetchBooks, getPersistenceStatus, getPublicSharePath, type PersistenceStatus } from "@/lib/inventory-repository";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import type { Book, Category, CustomStatus } from "@/lib/types";

const isDevelopment = process.env.NODE_ENV === "development";

export default function HomePage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [customStatuses, setCustomStatuses] = useState<CustomStatus[]>([]);
  const [booksLoading, setBooksLoading] = useState(true);
  const [booksError, setBooksError] = useState("");
  const [fetchDebug, setFetchDebug] = useState({
    attempted: false,
    count: 0,
    error: ""
  });
  const [existingBooksUserId, setExistingBooksUserId] = useState("");
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{
    migratedBooks: number;
    migratedPhotos: number;
    message: string;
  } | null>(null);
  const [migrationError, setMigrationError] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState("All");
  const [prefix, setPrefix] = useState("BK");
  const [persistence, setPersistence] = useState<PersistenceStatus>({
    mode: "local",
    message: "Checking storage..."
  });
  const [sharePath, setSharePath] = useState("/share/demo");
  const [shareUrl, setShareUrl] = useState("");
  const [shareError, setShareError] = useState("");
  const [shareCopied, setShareCopied] = useState(false);
  const [debugMode, setDebugMode] = useState(false);

  useEffect(() => {
    setDebugMode(isDevelopment && new URLSearchParams(window.location.search).get("debug") === "true");
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadDashboard() {
      setBooksLoading(true);
      setBooksError("");

      try {
        setPersistence(await getPersistenceStatus());
      } catch (error) {
        setPersistence({
          mode: "error",
          message: error instanceof Error ? error.message : "Supabase connection failed."
        });
      }

      if (!mounted) return;

      const [booksResult, shareResult, categoriesResult, statusesResult] = await Promise.allSettled([
        fetchBooks(),
        getPublicSharePath(),
        fetchCategories(),
        fetchStatuses()
      ]);

      if (!mounted) return;

      if (booksResult.status === "fulfilled") {
        setBooks(booksResult.value ?? []);
        setFetchDebug({
          attempted: true,
          count: booksResult.value?.length ?? 0,
          error: ""
        });
      } else {
        setBooks([]);
        const message = booksResult.reason instanceof Error
          ? booksResult.reason.message
          : "Books could not be loaded from Supabase.";
        setBooksError(message);
        setFetchDebug({
          attempted: true,
          count: 0,
          error: message
        });
      }

      if (shareResult.status === "fulfilled") {
        setSharePath(shareResult.value);
        setShareError("");
      } else {
        setSharePath("");
        setShareError(
          shareResult.reason instanceof Error
            ? shareResult.reason.message
            : "Share link could not be loaded from Supabase."
        );
      }

      if (categoriesResult.status === "fulfilled") {
        setCategories(categoriesResult.value ?? []);
      } else {
        setCategories([]);
      }

      if (statusesResult.status === "fulfilled") {
        setCustomStatuses(statusesResult.value ?? []);
      } else {
        setCustomStatuses([]);
      }

      setBooksLoading(false);
    }

    void loadDashboard();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!sharePath) {
      setShareUrl("");
      return;
    }

    setShareUrl(`${window.location.origin}${sharePath}`);
  }, [sharePath]);

  async function copyShareLink() {
    if (!shareUrl) return;

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1800);
    } catch {
      setShareCopied(false);
    }
  }

  const filteredBooks = useMemo(() => {
    return books.filter((book) => {
      const searchable = [book.title, book.author, book.publisher, book.isbn, book.inventory_id]
        .join(" ")
        .toLowerCase();
      const matchesQuery = searchable.includes(query.toLowerCase());
      const legacyCategoryKey = `legacy:${book.category || "Uncategorized"}`;
      const matchesCategory = category === "All" || book.category_id === category || (!book.category_id && legacyCategoryKey === category);
      const legacyStatusKey = `legacy:${book.status || "Inventory"}`;
      const matchesStatus = status === "All" || book.status_id === status || (!book.status_id && legacyStatusKey === status);
      return matchesQuery && matchesCategory && matchesStatus;
    });
  }, [books, category, query, status]);

  const categoryOptions = useMemo(() => {
    const legacy = books
      .filter((book) => !book.category_id && book.category)
      .map((book) => ({ id: `legacy:${book.category}`, name: book.category }));
    const options = [...categories.map((item) => ({ id: item.id, name: item.name })), ...legacy];
    return Array.from(new Map(options.map((item) => [item.id, item])).values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [books, categories]);

  const statusOptions = useMemo(() => {
    const legacy = books
      .filter((book) => !book.status_id && book.status)
      .map((book) => ({ id: `legacy:${book.status}`, name: book.status }));
    const options = [...customStatuses.map((item) => ({ id: item.id, name: item.name })), ...legacy];
    return Array.from(new Map(options.map((item) => [item.id, item])).values());
  }, [books, customStatuses]);

  const currentUserId = persistence.userId ?? "";
  const showSupabaseDebugPanel = isDevelopment && debugMode;
  const persistenceMessage =
    persistence.mode === "error" && !showSupabaseDebugPanel
      ? "Storage connection unavailable."
      : persistence.message;
  const cleanedExistingUserId = existingBooksUserId.trim();
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const hasExistingUserId = Boolean(cleanedExistingUserId);
  const existingUserIdLooksValid = uuidPattern.test(cleanedExistingUserId);
  const idsMatch = Boolean(currentUserId && existingUserIdLooksValid && currentUserId === cleanedExistingUserId);
  const idsDiffer = Boolean(currentUserId && existingUserIdLooksValid && currentUserId !== cleanedExistingUserId);
  const relinkSql = idsDiffer ? `begin;

do $$
declare
  old_user_id uuid := '${cleanedExistingUserId}';
  new_user_id uuid := '${currentUserId}';
  conflicting_inventory_ids integer;
begin
  select count(*)
  into conflicting_inventory_ids
  from public.books old_books
  join public.books new_books
    on new_books.user_id = new_user_id
   and new_books.inventory_prefix = old_books.inventory_prefix
   and new_books.inventory_number = old_books.inventory_number
  where old_books.user_id = old_user_id;

  if conflicting_inventory_ids > 0 then
    raise exception 'Relink stopped: the current user already has % conflicting inventory IDs.', conflicting_inventory_ids;
  end if;

  update public.book_photos
  set user_id = new_user_id
  where user_id = old_user_id;

  update public.books
  set user_id = new_user_id,
      updated_at = now()
  where user_id = old_user_id;
end $$;

commit;` : "";

  async function refreshBookList() {
    const items = await fetchBooks();
    setBooks(items ?? []);
    setFetchDebug({
      attempted: true,
      count: items?.length ?? 0,
      error: ""
    });
    setBooksError("");
  }

  async function recoverExistingBooks() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMigrationError("Supabase is not configured.");
      return;
    }

    setMigrationLoading(true);
    setMigrationError("");
    setMigrationResult(null);

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      const accessToken = data.session?.access_token;
      if (!accessToken) throw new Error("No current Supabase auth session found.");

      const response = await fetch("/api/dev/recover-books?debug=true", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({ previousUserId: cleanedExistingUserId })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Book recovery failed.");

      setMigrationResult({
        migratedBooks: Number(result.migratedBooks ?? 0),
        migratedPhotos: Number(result.migratedPhotos ?? 0),
        message: String(result.message ?? "Recovery complete.")
      });
      await refreshBookList();
    } catch (error) {
      setMigrationError(error instanceof Error ? error.message : "Book recovery failed.");
    } finally {
      setMigrationLoading(false);
    }
  }

  return (
    <AppShell>
      <section className="grid gap-5 py-3 sm:py-4 lg:grid-cols-[minmax(0,1fr)_310px] lg:items-start">
        <div className="min-w-0">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-black uppercase tracking-wide text-marigold">Library dashboard</p>
              <h1 className="font-serif text-3xl font-black leading-tight sm:text-5xl">Book-to-Journal Inventory</h1>
            </div>
            <div className="hidden gap-3 sm:flex">
              <Link href="/batch-add" className="btn-secondary">
                <Upload size={20} aria-hidden />
                Batch Add
              </Link>
              <Link href="/categories" className="btn-secondary">
                <Settings size={20} aria-hidden />
                Categories
              </Link>
              <Link href="/statuses" className="btn-secondary">
                <ListChecks size={20} aria-hidden />
                Statuses
              </Link>
              <Link href="/add" className="btn-primary">
                <Plus size={20} aria-hidden />
                Add Book
              </Link>
            </div>
          </div>

          <CustomDashboardStats books={books} statuses={customStatuses} />

          <div className="mt-5 rounded-lg border-2 border-ink/10 bg-white/80 p-3 text-sm font-bold text-ink/70">
            {persistence.mode === "supabase" ? "Supabase connected" : persistence.mode === "error" ? "Supabase error" : "Local mode"}:{" "}
            {persistenceMessage}
            {showSupabaseDebugPanel && persistence.userId ? (
              <span className="mt-1 block break-all text-xs text-ink/55">Anonymous user: {persistence.userId}</span>
            ) : null}
          </div>

          {showSupabaseDebugPanel ? (
            <div className="mt-5 rounded-lg border-2 border-amber-300 bg-amber-50 p-4 text-sm text-ink">
              <h2 className="text-lg font-black">Supabase debug</h2>
              <div className="mt-3 grid gap-2 font-semibold text-ink/75">
                <p>Configured mode: {persistence.mode}</p>
                <p className="break-all">Current auth user id: {currentUserId || "Not signed in yet"}</p>
                <p>
                  fetchBooks: {fetchDebug.attempted ? `${fetchDebug.count} book${fetchDebug.count === 1 ? "" : "s"}` : "Not run yet"}
                </p>
                {fetchDebug.error ? <p className="break-words text-red-800">fetchBooks error: {fetchDebug.error}</p> : null}
              </div>

              <label className="mt-4 block">
                <span className="text-xs font-black uppercase tracking-wide text-ink/60">books.user_id from Supabase Table Editor</span>
                <input
                  className="field mt-1 bg-white"
                  placeholder="Paste the saved books.user_id here"
                  value={existingBooksUserId}
                  onChange={(event) => setExistingBooksUserId(event.target.value)}
                />
              </label>

              {hasExistingUserId && !existingUserIdLooksValid ? (
                <p className="mt-3 rounded-lg bg-red-50 p-3 font-bold text-red-800">
                  That does not look like a Supabase UUID yet. Paste the exact `user_id` value from a saved row in
                  Table Editor &gt; books.
                </p>
              ) : null}

              {idsMatch ? (
                <p className="mt-3 rounded-lg bg-mint/30 p-3 font-bold text-ink">
                  The current anonymous user matches the saved books.user_id. If the count is still 0, the next suspects are RLS
                  policy shape, schema drift, or a query error.
                </p>
              ) : null}

              {idsDiffer ? (
                <div className="mt-3 grid gap-3">
                  <p className="rounded-lg bg-white p-3 font-bold text-ink">
                    The current anonymous user does not match the saved books.user_id. Supabase RLS will hide those books from
                    this session until you restore the old session or relink the rows.
                  </p>
                  <p className="font-semibold text-ink/70">
                    Dev-safe recovery: use the button below. It runs only in development mode, requires the server-side
                    `SUPABASE_SERVICE_ROLE_KEY`, and stops if inventory IDs would collide.
                  </p>
                  <button
                    className="btn-primary w-full sm:w-fit"
                    disabled={migrationLoading || Boolean(migrationResult)}
                    onClick={recoverExistingBooks}
                  >
                    {migrationLoading ? "Recovering..." : "Recover Existing Books"}
                  </button>
                  {migrationResult ? (
                    <p className="rounded-lg bg-mint/30 p-3 font-bold text-ink">
                      {migrationResult.message} Migrated {migrationResult.migratedPhotos} related photo
                      {migrationResult.migratedPhotos === 1 ? "" : "s"}. The tool is now disabled for this page load.
                    </p>
                  ) : null}
                  {migrationError ? (
                    <p className="rounded-lg bg-red-50 p-3 font-bold text-red-800">{migrationError}</p>
                  ) : null}
                  <p className="font-semibold text-ink/70">
                    Manual fallback SQL remains below. Remove `SUPABASE_SERVICE_ROLE_KEY` from `.env.local` or restart without it
                    after migration to disable the admin utility.
                  </p>
                  <pre className="max-h-72 overflow-auto whitespace-pre-wrap rounded-lg bg-ink p-3 text-xs font-semibold text-white">
                    {relinkSql}
                  </pre>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="panel mt-5 grid gap-3 p-3 sm:p-4 md:grid-cols-[minmax(0,1fr)_180px_180px]">
            <label className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/45" size={20} aria-hidden />
              <input
                className="field pl-11"
                placeholder="Search title, author, ISBN"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <select className="field" value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="All">All categories</option>
              {categoryOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <select className="field" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="All">All statuses</option>
              {statusOptions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>

          {booksLoading ? (
            <div className="panel mt-5 p-5 text-sm font-bold text-ink/65">Loading books from storage...</div>
          ) : booksError ? (
            <div className="mt-5 rounded-lg border-2 border-red-200 bg-red-50 p-5">
              <h2 className="text-xl font-black text-red-900">Books could not be loaded</h2>
              <p className="mt-2 text-sm font-semibold text-red-800">
                Please refresh and try again. If this keeps happening, check the deployment setup.
              </p>
              {showSupabaseDebugPanel ? (
                <p className="mt-2 break-words text-sm font-semibold text-red-800">{booksError}</p>
              ) : null}
              <p className="mt-3 text-sm font-semibold text-red-800">
                Saved books are protected while the connection is unavailable.
              </p>
            </div>
          ) : filteredBooks.length > 0 ? (
            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
              {filteredBooks.map((book) => <BookCard book={book} key={book.id} />)}
            </div>
          ) : (
            <div className="panel mt-5 p-5">
              <h2 className="text-xl font-black">No books found for this user</h2>
              <p className="mt-2 text-sm font-semibold text-ink/65">
                The app loaded successfully, but Supabase returned no rows for the current anonymous user.
              </p>
              {persistence.mode === "supabase" ? (
                <p className="mt-2 text-sm font-semibold text-ink/65">
                  Anonymous sessions are now shared across localhost ports going forward. If the books were created on a
                  different localhost port before this fix, they may belong to that older anonymous user and remain hidden
                  by RLS until that session is migrated or the rows are reassigned in Supabase.
                </p>
              ) : null}
            </div>
          )}
        </div>

        <aside className="grid min-w-0 gap-4">
          <InventoryPrefixSettings value={prefix} onChange={setPrefix} />
          <div className="panel p-4">
            <div className="mb-3 flex items-center gap-2">
              <QrCode size={22} aria-hidden />
              <h2 className="text-xl font-black">Share Library</h2>
            </div>
            <p className="mb-4 text-sm font-semibold text-ink/65">
              Public pages show only books marked public and hide private cost/profit fields.
            </p>
            {shareError ? (
              <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-800">
                Share link could not be loaded.
                {showSupabaseDebugPanel ? <span className="mt-1 block break-words">{shareError}</span> : null}
              </p>
            ) : null}
            <QRCodeBox value={shareUrl} />
            <div className="mt-3 grid gap-2">
              <button className="btn-secondary w-full" disabled={!shareUrl} onClick={copyShareLink}>
                <Copy size={18} aria-hidden />
                {shareCopied ? "Copied" : "Copy share link"}
              </button>
              {sharePath ? (
                <Link className="btn-primary w-full" href={sharePath} target="_blank">
                  <ExternalLink size={18} aria-hidden />
                  Preview public library
                </Link>
              ) : (
                <button className="btn-primary w-full opacity-60" disabled>
                  <ExternalLink size={18} aria-hidden />
                  Preview public library
                </button>
              )}
            </div>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
