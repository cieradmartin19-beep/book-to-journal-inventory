"use client";

import Link from "next/link";
import { CheckCircle2, Send } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BrandLogo } from "@/components/BrandLogo";
import { fetchPublicBooks } from "@/lib/inventory-repository";
import { resolveCustomOrderShareId, submitCustomOrder } from "@/lib/custom-orders";
import type { Book } from "@/lib/types";

const pageOptions = ["50 pages", "75 pages", "100 pages", "150 pages", "Custom amount"];
const customizationOptions = [
  "Plain journal pages",
  "Lined pages",
  "Mixed paper pack",
  "Vintage paper",
  "Pockets",
  "Tabs/dividers",
  "Lace/ribbon",
  "Charms",
  "Name/personalization",
  "Gift wrap",
  "Other request"
];

export default function CustomOrderPage() {
  const [shareId, setShareId] = useState("");
  const [books, setBooks] = useState<Book[]>([]);
  const [bookChoice, setBookChoice] = useState("own");
  const [pageCount, setPageCount] = useState("50 pages");
  const [customPageCount, setCustomPageCount] = useState("");
  const [options, setOptions] = useState<string[]>([]);
  const [otherRequest, setOtherRequest] = useState("");
  const [theme, setTheme] = useState("");
  const [colors, setColors] = useState("");
  const [occasion, setOccasion] = useState("");
  const [favoriteDetails, setFavoriteDetails] = useState("");
  const [deadline, setDeadline] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [preferredContact, setPreferredContact] = useState<"Phone" | "Email" | "Text">("Email");
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadCatalog() {
      try {
        const params = new URLSearchParams(window.location.search);
        const resolvedShareId = params.get("shareId") || await resolveCustomOrderShareId();
        const selectedBookId = params.get("bookId") || "";
        if (!active) return;
        setShareId(resolvedShareId);
        const publicBooks = resolvedShareId ? await fetchPublicBooks(resolvedShareId) : [];
        if (!active) return;
        setBooks(publicBooks);
        if (selectedBookId && publicBooks.some((book) => book.id === selectedBookId)) setBookChoice(selectedBookId);
      } catch {
        if (active) setError("Available books could not be loaded. You can still request a journal using your own book.");
      } finally {
        if (active) setLoadingBooks(false);
      }
    }
    void loadCatalog();
    return () => { active = false; };
  }, []);

  const selectedBook = useMemo(() => books.find((book) => book.id === bookChoice), [bookChoice, books]);

  function toggleOption(option: string) {
    setOptions((current) => current.includes(option)
      ? current.filter((item) => item !== option)
      : [...current, option]);
  }

  async function submit() {
    setError("");
    if (!name.trim()) return setError("Please enter your name.");
    if (!email.trim() && !phone.trim()) return setError("Please enter an email address or phone number.");
    if (pageCount === "Custom amount" && (!Number(customPageCount) || Number(customPageCount) < 1)) {
      return setError("Please enter the custom page amount.");
    }
    if (!shareId) return setError("This custom order page is not connected to a shop yet.");

    setSubmitting(true);
    try {
      const notes = [
        theme && `Theme: ${theme}`,
        colors && `Colors: ${colors}`,
        occasion && `Occasion: ${occasion}`,
        favoriteDetails && `Favorite details: ${favoriteDetails}`,
        deadline && `Deadline: ${deadline}`,
        otherRequest && `Other request: ${otherRequest}`
      ].filter(Boolean).join("\n");
      await submitCustomOrder({
        share_id: shareId,
        book_id: bookChoice === "own" ? null : bookChoice,
        customer_name: name.trim(),
        customer_phone: phone.trim(),
        customer_email: email.trim(),
        preferred_contact: preferredContact,
        page_count: pageCount,
        custom_page_count: pageCount === "Custom amount" ? Number(customPageCount) : null,
        customization_options: options,
        customer_notes: notes
      });
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Your request could not be submitted. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <main className="mx-auto grid min-h-screen max-w-2xl place-items-center px-4 py-8">
        <section className="panel p-6 text-center sm:p-10">
          <CheckCircle2 className="mx-auto text-mint" size={58} aria-hidden />
          <h1 className="mt-4 font-serif text-3xl font-black">Thank you!</h1>
          <p className="mx-auto mt-3 max-w-xl font-semibold text-ink/70">
            The Paper Curio will review your request and contact you with a quote. Please allow 3 business days for a custom order quote.
          </p>
          <Link href={shareId ? `/share/${shareId}` : "/"} className="btn-primary mt-6">Return to The Paper Curio</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-3 py-4 sm:px-6 sm:py-8">
      <header className="mb-6"><BrandLogo className="h-20 w-20 sm:h-24 sm:w-24" /></header>

      <section className="panel p-4 sm:p-6">
        <p className="text-sm font-black uppercase tracking-wide text-marigold">Custom Journal Request</p>
        <h1 className="mt-1 font-serif text-3xl font-black sm:text-4xl">Tell Jess what you would love</h1>
        <p className="mt-2 font-semibold text-ink/65">Share your ideas below. Jess will review the details and contact you with a quote.</p>

        <div className="mt-6 grid gap-6">
          <fieldset className="grid gap-3">
            <legend className="label">Choose a book</legend>
            <select className="field" value={bookChoice} onChange={(event) => setBookChoice(event.target.value)} disabled={loadingBooks}>
              <option value="own">I have my own book</option>
              {books.map((book) => <option key={book.id} value={book.id}>{book.title}{book.author ? ` — ${book.author}` : ""}</option>)}
            </select>
            {selectedBook ? <p className="rounded-lg bg-honey/20 p-3 text-sm font-bold">Selected: {selectedBook.title}</p> : null}
          </fieldset>

          <fieldset className="grid gap-3">
            <legend className="label">Number of pages</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {pageOptions.map((option) => <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border-2 border-ink/10 bg-white p-3 text-sm font-bold" key={option}><input type="radio" name="page-count" checked={pageCount === option} onChange={() => setPageCount(option)} />{option}</label>)}
            </div>
            {pageCount === "Custom amount" ? <input className="field" type="number" min="1" placeholder="Custom number of pages" value={customPageCount} onChange={(event) => setCustomPageCount(event.target.value)} /> : null}
          </fieldset>

          <fieldset className="grid gap-3">
            <legend className="label">Customization options</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {customizationOptions.map((option) => <label className="flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border-2 border-ink/10 bg-white p-3 text-sm font-bold" key={option}><input type="checkbox" checked={options.includes(option)} onChange={() => toggleOption(option)} />{option}</label>)}
            </div>
            {options.includes("Other request") ? <input className="field" placeholder="Describe your other request" value={otherRequest} onChange={(event) => setOtherRequest(event.target.value)} /> : null}
          </fieldset>

          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="label sm:col-span-2">Creative details</legend>
            <input className="field" placeholder="Theme" value={theme} onChange={(event) => setTheme(event.target.value)} />
            <input className="field" placeholder="Colors" value={colors} onChange={(event) => setColors(event.target.value)} />
            <input className="field" placeholder="Occasion" value={occasion} onChange={(event) => setOccasion(event.target.value)} />
            <input className="field" placeholder="Favorite details" value={favoriteDetails} onChange={(event) => setFavoriteDetails(event.target.value)} />
            <label className="grid gap-2 sm:col-span-2"><span className="label">Deadline</span><input className="field" type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label>
          </fieldset>

          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="label sm:col-span-2">Contact information</legend>
            <input className="field" placeholder="Name" value={name} onChange={(event) => setName(event.target.value)} />
            <input className="field" type="tel" placeholder="Phone number" value={phone} onChange={(event) => setPhone(event.target.value)} />
            <input className="field" type="email" placeholder="Email" value={email} onChange={(event) => setEmail(event.target.value)} />
            <select className="field" aria-label="Preferred contact method" value={preferredContact} onChange={(event) => setPreferredContact(event.target.value as "Phone" | "Email" | "Text")}><option>Phone</option><option>Email</option><option>Text</option></select>
          </fieldset>

          {error ? <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-800">{error}</p> : null}
          <button className="btn-primary w-full text-lg" disabled={submitting} onClick={submit}><Send size={20} aria-hidden />{submitting ? "Submitting..." : "Submit Custom Order Request"}</button>
        </div>
      </section>
    </main>
  );
}
