"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ClipboardList, Home, LibraryBig, ListChecks, LogOut, Plus, Settings, UserCircle } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { getCurrentUser, signOut, userDisplayName } from "@/lib/auth";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return;
    }

    let mounted = true;
    const supabase = getSupabaseBrowserClient();

    void getCurrentUser()
      .then((currentUser) => {
        if (!mounted) return;
        setUser(currentUser);
      })
      .finally(() => {
        if (mounted) setAuthLoading(false);
      });

    const { data } = supabase?.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
      if (event === "SIGNED_IN" && !window.sessionStorage.getItem("book-to-journal-auth-reloaded")) {
        window.sessionStorage.setItem("book-to-journal-auth-reloaded", "true");
        window.location.reload();
      }
      if (event === "SIGNED_OUT") {
        window.sessionStorage.removeItem("book-to-journal-auth-reloaded");
      }
    }) ?? { data: { subscription: null } };

    return () => {
      mounted = false;
      data.subscription?.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    await signOut();
    setUser(null);
  }

  const displayName = userDisplayName(user);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-3 pb-24 pt-3 sm:px-6 sm:pt-4 lg:px-8">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-gold/30 py-3 sm:mb-5 xl:flex-nowrap">
        <Link href="/" aria-label="The Paper Curio home" className="shrink-0">
          <BrandLogo className="h-16 w-16 sm:h-20 sm:w-20 lg:h-24 lg:w-24" />
        </Link>
        <div className="hidden flex-wrap items-center justify-end gap-1.5 lg:flex">
          {(!isSupabaseConfigured || user) ? <>
            <Link className="btn-secondary btn-web-compact" href="/">Home</Link>
            <Link className="btn-secondary btn-web-compact" href="/library">Library</Link>
            <Link className="btn-primary btn-web-compact" href="/add"><Plus size={16} aria-hidden />Add Book</Link>
            <Link className="btn-secondary btn-web-compact" href="/categories">Categories</Link>
            <Link className="btn-secondary btn-web-compact" href="/statuses">Statuses</Link>
            <Link className="btn-secondary btn-web-compact" href="/orders"><ClipboardList size={16} aria-hidden />Orders</Link>
          </> : null}
          {user ? (
            <div className="flex items-center gap-1.5 rounded-md border-2 border-gold/45 bg-white px-2.5 py-2 text-xs font-black text-ink">
              <UserCircle size={16} aria-hidden />
              Signed in as {displayName || "Jess"}
            </div>
          ) : null}
          {user ? (
            <button className="btn-secondary btn-web-compact" onClick={handleSignOut}>
              <LogOut size={16} aria-hidden />
              Sign out
            </button>
          ) : null}
        </div>
      </header>
      <main className="flex-1">
        {authLoading ? (
          <div className="panel grid min-h-96 place-items-center p-8 text-center">
            <div>
              <p className="font-serif text-2xl font-black">The Paper Curio</p>
              <p className="mt-1 font-bold text-ink/65">Checking your account...</p>
            </div>
          </div>
        ) : !isSupabaseConfigured || user ? (
          children
        ) : (
          <div className="panel grid min-h-96 place-items-center p-8 text-center">
            <div className="max-w-md">
              <UserCircle className="mx-auto mb-4 text-marigold" size={48} aria-hidden />
              <h1 className="font-serif text-3xl font-black">Welcome to The Paper Curio</h1>
              <p className="mt-2 font-black text-marigold">Curated Books • Handmade Journals • Creative Collections</p>
              <p className="mt-2 font-semibold text-ink/65">Jess can sign in to see only her saved books, photos, categories, and statuses.</p>
              <Link className="btn-primary mt-5" href="/login">
                Sign in
              </Link>
            </div>
          </div>
        )}
      </main>
      {isSupabaseConfigured && !user ? null : (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-gold/45 bg-ink/95 px-3 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur sm:hidden">
          <div className="mx-auto grid max-w-xl grid-cols-6 gap-1">
            <Link className="btn-secondary min-h-12 flex-col gap-1 px-1 py-2 text-[10px] leading-none" href="/">
              <Home size={18} aria-hidden />
              Home
            </Link>
            <Link className="btn-primary min-h-12 flex-col gap-1 px-1 py-2 text-[10px] leading-none" href="/add">
              <Plus size={18} aria-hidden />
              Add
            </Link>
            <Link className="btn-secondary min-h-12 flex-col gap-1 px-1 py-2 text-[10px] leading-none" href="/library">
              <LibraryBig size={18} aria-hidden />
              Library
            </Link>
            <Link className="btn-secondary min-h-12 flex-col gap-1 px-1 py-2 text-[10px] leading-none" href="/categories">
              <Settings size={18} aria-hidden />
              Categories
            </Link>
            <Link className="btn-secondary min-h-12 flex-col gap-1 px-1 py-2 text-[10px] leading-none" href="/statuses">
              <ListChecks size={18} aria-hidden />
              Statuses
            </Link>
            <Link className="btn-secondary min-h-12 flex-col gap-1 px-1 py-2 text-[10px] leading-none" href="/orders">
              <ClipboardList size={18} aria-hidden />
              Orders
            </Link>
          </div>
          {user ? (
            <div className="mx-auto mt-2 flex max-w-md items-center justify-between gap-2 text-xs font-black text-paper/70">
              <span className="min-w-0 truncate">Signed in as {displayName || "Jess"}</span>
              <button className="underline" onClick={handleSignOut}>Sign out</button>
            </div>
          ) : null}
        </nav>
      )}
    </div>
  );
}
