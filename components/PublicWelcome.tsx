"use client";

import Link from "next/link";
import { ArrowRight, BookHeart, BookOpen, Feather, Gift, LibraryBig } from "lucide-react";
import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { resolveCustomOrderShareId } from "@/lib/custom-orders";

const journalSizes = [
  {
    title: "Mini Journal",
    description: "Perfect for notes, lists, gratitude journaling, and everyday use.",
    items: ["50 journal pages", "Original story pages", "Combination of lined and blank pages"]
  },
  {
    title: "Standard Journal",
    description: "Ideal for everyday journaling, note-taking, school, work, and memory keeping.",
    items: ["75 journal pages", "Original story pages", "Combination of lined and blank pages", "One folder pocket or divider section when space allows"]
  },
  {
    title: "Deluxe Journal",
    description: "Designed for avid journalers, writers, planners, and memory keepers who want extra space.",
    items: ["100 journal pages", "Original story pages", "Combination of lined and blank pages", "Up to two folder pockets or divider sections when space allows"]
  }
];

function DetailList({ items }: { items: string[] }) {
  return (
    <ul className="mt-4 grid gap-2 text-sm font-semibold text-ink/75">
      {items.map((item) => <li className="flex gap-2" key={item}><span className="text-marigold">•</span><span>{item}</span></li>)}
    </ul>
  );
}

export function PublicWelcome({ shareId }: { shareId?: string }) {
  const [libraryHref, setLibraryHref] = useState(shareId ? `/share/${encodeURIComponent(shareId)}/library` : "");

  useEffect(() => {
    if (shareId) {
      setLibraryHref(`/share/${encodeURIComponent(shareId)}/library`);
      return;
    }
    let active = true;
    void resolveCustomOrderShareId()
      .then((shareId) => {
        if (active && shareId) setLibraryHref(`/share/${encodeURIComponent(shareId)}/library`);
      })
      .catch(() => {
        if (active) setLibraryHref("");
      });
    return () => { active = false; };
  }, [shareId]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between border-b border-gold/30 py-4">
        <BrandLogo className="h-20 w-20 sm:h-24 sm:w-24" />
        <Link href="/login" className="text-sm font-bold text-paper/70 underline decoration-gold/60 underline-offset-4 hover:text-paper">Jess sign in</Link>
      </header>

      <main className="mt-6 overflow-hidden rounded-lg border border-gold/35 bg-paper shadow-[0_18px_50px_rgba(0,0,0,0.28)]">
        <section className="bg-ink px-5 py-14 text-center sm:px-8 sm:py-20">
          <p className="page-kicker">The Paper Curio</p>
          <h1 className="mx-auto mt-3 max-w-4xl font-serif text-4xl font-black leading-tight text-paper sm:text-6xl">Welcome to The Paper Curio</h1>
          <p className="mt-4 font-bold text-gold sm:text-lg">Curated Books • Handmade Journals • Creative Collections</p>
        </section>

        <section className="border-b border-gold/25 px-5 py-10 sm:px-8 sm:py-14">
          <div className="mx-auto max-w-3xl text-center">
            <BookHeart className="mx-auto text-gold" size={34} aria-hidden />
            <h2 className="mt-4 font-serif text-2xl font-black text-ink sm:text-3xl">About The Paper Curio Journals &amp; Specialty Books</h2>
            <div className="mt-5 space-y-4 text-base font-medium leading-8 text-ink/75">
              <p>Each journal is handcrafted from a vintage children&apos;s book that has been loved and enjoyed over the years. Because these books are vintage, signs of age, previous ownership, and wear may be present. I do my best to preserve the original story while carefully cleaning up excessive writing or markings whenever possible.</p>
              <p className="font-bold text-marigold">Every journal is unique, and no two journals will be exactly alike.</p>
            </div>
          </div>
        </section>

        <section className="border-b border-gold/25 bg-white/35 px-5 py-10 sm:px-8 sm:py-14">
          <div className="mx-auto max-w-3xl text-center">
            <BookOpen className="mx-auto text-gold" size={34} aria-hidden />
            <h2 className="mt-4 font-serif text-2xl font-black text-ink sm:text-3xl">What You&apos;ll Find Inside</h2>
            <p className="mt-4 font-semibold text-ink/75">All journals include:</p>
            <div className="mx-auto max-w-md text-left"><DetailList items={["Original story pages", "A combination of lined and blank journal pages"]} /></div>
            <p className="mt-5 leading-7 text-ink/65">Original story pages are shown throughout the journal, allowing readers to revisit the story while enjoying a functional writing journal.</p>
          </div>
        </section>

        <section className="border-b border-gold/25 px-5 py-10 sm:px-8 sm:py-14">
          <div className="text-center">
            <p className="page-kicker">Made For Your Story</p>
            <h2 className="mt-2 font-serif text-3xl font-black text-ink">Journal Sizes</h2>
          </div>
          <div className="mt-7 grid gap-4 lg:grid-cols-3">
            {journalSizes.map((size) => (
              <article className="catalog-card p-5 sm:p-6" key={size.title}>
                <h3 className="font-serif text-2xl font-black">{size.title}</h3>
                <p className="mt-3 min-h-14 text-sm font-semibold leading-6 text-ink/65">{size.description}</p>
                <p className="mt-5 text-xs font-black uppercase tracking-wide text-marigold">Includes</p>
                <DetailList items={size.items} />
              </article>
            ))}
          </div>
        </section>

        <section className="border-b border-gold/25 bg-white/35 px-5 py-10 sm:px-8 sm:py-14">
          <div>
            <Feather className="text-marigold" size={32} aria-hidden />
            <h2 className="mt-3 font-serif text-3xl font-black">Specialty Books</h2>
            <p className="mt-3 max-w-3xl font-semibold leading-7 text-ink/70">Many vintage books can also be transformed into specialty keepsake books using premium paper.</p>
            <p className="mt-2 font-semibold text-ink/70">Available options may include:</p>
            <div className="mt-7 grid gap-8 md:grid-cols-2">
              <div>
                <h3 className="font-serif text-xl font-black">Signature Books</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-ink/70">Perfect for collecting messages, signatures, memories, and well wishes from family and friends.</p>
                <p className="mt-4 text-xs font-black uppercase tracking-wide text-marigold">Popular for</p>
                <DetailList items={["Baby Showers", "Bridal Showers", "Weddings", "Retirement Celebrations", "Birthday Parties", "Family Reunions"]} />
              </div>
              <div>
                <h3 className="font-serif text-xl font-black">Teacher Memory Books</h3>
                <p className="mt-2 text-sm font-semibold leading-6 text-ink/70">A meaningful keepsake for students, teachers, and families.</p>
                <p className="mt-4 text-xs font-black uppercase tracking-wide text-marigold">Perfect for</p>
                <DetailList items={["End of School Year Gifts", "Teacher Appreciation Gifts", "School Milestones", "Student Messages and Memories"]} />
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-8 border-b border-gold/25 px-5 py-10 md:grid-cols-2 md:divide-x md:divide-gold/25 sm:px-8 sm:py-14">
          <article className="md:pr-8">
            <LibraryBig className="text-marigold" size={30} aria-hidden />
            <h2 className="mt-3 font-serif text-2xl font-black text-ink">Vintage Book Information</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-ink/70">Because these journals and keepsake books are created from authentic vintage books:</p>
            <DetailList items={["Original story pages are preserved whenever possible.", "Books may show signs of age, wear, or previous ownership.", "Some books may contain inscriptions, names, or handwritten notes from previous owners.", "Every effort is made to maintain the charm and character of the original book while creating a functional keepsake."]} />
          </article>

          <article className="md:pl-8">
            <Gift className="text-marigold" size={30} aria-hidden />
            <h2 className="mt-3 font-serif text-2xl font-black text-ink">Custom Orders</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-ink/70">Custom orders are available based on current book inventory.</p>
            <p className="mt-5 text-xs font-black uppercase tracking-wide text-marigold">Customers may choose</p>
            <DetailList items={["Available book title", "Journal size", "Specialty book options"]} />
            <p className="mt-5 text-sm font-semibold leading-6 text-ink/70">Please message for current book availability, pricing, and custom order information.</p>
          </article>
        </section>

        <section className="bg-ink px-5 py-14 text-center sm:px-8 sm:py-20">
          <h2 className="font-serif text-4xl font-black text-paper">Ready to Browse?</h2>
          <p className="mx-auto mt-3 max-w-xl font-semibold text-paper/70">Explore the current collection of vintage books available from The Paper Curio.</p>
          {libraryHref ? (
            <Link href={libraryHref} className="btn-primary mt-7 w-full px-7 py-4 text-lg sm:w-fit">Browse the Library <ArrowRight size={21} aria-hidden /></Link>
          ) : (
            <span className="btn-primary mt-7 w-full cursor-wait px-7 py-4 text-lg opacity-70 sm:w-fit">Preparing the Library...</span>
          )}
        </section>
      </main>
    </div>
  );
}
