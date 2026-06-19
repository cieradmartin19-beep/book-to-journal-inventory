"use client";

import Link from "next/link";
import { Copy, ExternalLink, LibraryBig, QrCode, Settings, Workflow } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CustomDashboardStats } from "@/components/DashboardStats";
import { QRCodeBox } from "@/components/QRCodeBox";
import { fetchBooks, getPublicSharePath } from "@/lib/inventory-repository";
import { fetchStatuses } from "@/lib/statuses";
import type { Book, CustomStatus } from "@/lib/types";

export default function HomePage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [statuses, setStatuses] = useState<CustomStatus[]>([]);
  const [shareUrl, setShareUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.allSettled([fetchBooks(), fetchStatuses(), getPublicSharePath()])
      .then(([booksResult, statusesResult, shareResult]) => {
        if (!active) return;
        if (booksResult.status === "fulfilled") setBooks(booksResult.value);
        else setError(booksResult.reason instanceof Error ? booksResult.reason.message : "Your dashboard could not be loaded.");
        if (statusesResult.status === "fulfilled") setStatuses(statusesResult.value);
        if (shareResult.status === "fulfilled") setShareUrl(`${window.location.origin}${shareResult.value}`);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  return (
    <AppShell>
      <section className="py-4">
        <p className="text-sm font-black uppercase tracking-wide text-marigold">Home</p>
        <div className="mt-1">
          <div>
            <h1 className="font-serif text-3xl font-black leading-tight sm:text-5xl">The Paper Curio</h1>
            <p className="mt-2 max-w-2xl font-semibold text-ink/65">Curated Books • Handmade Journals • Creative Collections</p>
          </div>
        </div>
      </section>

      {loading ? <div className="panel mt-4 p-5 font-bold text-ink/65">Loading The Paper Curio...</div> : null}
      {!loading && error ? (
        <div className="mt-4 rounded-lg border-2 border-red-200 bg-red-50 p-5">
          <h2 className="text-xl font-black text-red-900">Dashboard could not be loaded</h2>
          <p className="mt-2 font-semibold text-red-800">Please refresh and try again.</p>
          {process.env.NODE_ENV === "development" ? <p className="mt-2 text-sm text-red-800">{error}</p> : null}
        </div>
      ) : null}
      {!loading && !error ? <CustomDashboardStats books={books} statuses={statuses} /> : null}

      <section className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Link href="/library" className="panel p-5 transition hover:-translate-y-1">
          <LibraryBig size={28} aria-hidden /><h2 className="mt-3 text-xl font-black">Library</h2>
          <p className="mt-1 text-sm font-semibold text-ink/65">Browse, search, and filter all saved books.</p>
        </Link>
        <Link href="/categories" className="panel p-5 transition hover:-translate-y-1">
          <Settings size={28} aria-hidden /><h2 className="mt-3 text-xl font-black">Categories</h2>
          <p className="mt-1 text-sm font-semibold text-ink/65">Create the groupings that fit your collection.</p>
        </Link>
        <Link href="/statuses" className="panel p-5 transition hover:-translate-y-1">
          <Workflow size={28} aria-hidden /><h2 className="mt-3 text-xl font-black">Statuses</h2>
          <p className="mt-1 text-sm font-semibold text-ink/65">Shape and reorder your own workflow.</p>
        </Link>
        <div className="panel p-5">
          <QrCode size={28} aria-hidden /><h2 className="mt-3 text-xl font-black">Public Library</h2>
          {shareUrl ? <><div className="mt-3"><QRCodeBox value={shareUrl} /></div><div className="mt-3 grid gap-2"><button className="btn-secondary w-full" onClick={async () => { await navigator.clipboard.writeText(shareUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }}><Copy size={18} aria-hidden />{copied ? "Copied" : "Copy share link"}</button><Link href={shareUrl} target="_blank" className="btn-secondary w-full"><ExternalLink size={18} aria-hidden />Preview</Link></div></> : <p className="mt-2 text-sm font-semibold text-ink/65">Share link unavailable.</p>}
        </div>
      </section>
    </AppShell>
  );
}
