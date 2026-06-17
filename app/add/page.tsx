"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Barcode,
  Camera,
  Check,
  Keyboard,
  Loader2,
  Save,
  Search,
  Sparkles,
  Upload
} from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { BookFormFields } from "@/components/BookFormFields";
import { InventoryPrefixSettings } from "@/components/InventoryPrefixSettings";
import { createCategory, fetchCategories } from "@/lib/categories";
import {
  blankDraft,
  cleanIsbn,
  detectIsbnFromImage,
  fileToDataUrl,
  lookupGoogleBooks,
  scanCoverForBook,
  suggestionToDraft
} from "@/lib/book-lookup";
import type { CoverScanDiagnostics, OcrDebugInfo } from "@/lib/book-lookup";
import { createBook, fetchBooks } from "@/lib/inventory-repository";
import { nextInventoryId } from "@/lib/mock-data";
import type { Book, BookDraft, GoogleBookSuggestion } from "@/lib/types";
import type { Category } from "@/lib/types";

const LiveBarcodeScanner = dynamic(() => import("@/components/LiveBarcodeScanner"), {
  ssr: false,
  loading: () => (
    <div className="rounded-lg border-2 border-ink/10 bg-white p-3 text-sm font-bold text-ink/70">
      Loading camera scanner...
    </div>
  )
});

export default function AddBookPage() {
  const coverInput = useRef<HTMLInputElement>(null);
  const barcodeInput = useRef<HTMLInputElement>(null);
  const coverVideoRef = useRef<HTMLVideoElement>(null);
  const coverStreamRef = useRef<MediaStream | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);
  const pendingPhotoUrlsRef = useRef<string[]>([]);
  const [prefix, setPrefix] = useState("BK");
  const [draft, setDraft] = useState<BookDraft>(blankDraft());
  const [step, setStep] = useState<"start" | "looking" | "review">("start");
  const [suggestion, setSuggestion] = useState<GoogleBookSuggestion | null>(null);
  const [suggestions, setSuggestions] = useState<GoogleBookSuggestion[]>([]);
  const [isbnEntry, setIsbnEntry] = useState("");
  const [manualTitle, setManualTitle] = useState("");
  const [manualAuthor, setManualAuthor] = useState("");
  const [statusText, setStatusText] = useState("Choose how you want to add this book.");
  const [books, setBooks] = useState<Book[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [toast, setToast] = useState("");
  const [pendingPhotoFiles, setPendingPhotoFiles] = useState<File[]>([]);
  const [pendingPhotoUrls, setPendingPhotoUrls] = useState<string[]>([]);
  const [lookupError, setLookupError] = useState("");
  const [isbnLookupLoading, setIsbnLookupLoading] = useState(false);
  const [titleLookupLoading, setTitleLookupLoading] = useState(false);
  const [coverCameraOpen, setCoverCameraOpen] = useState(false);
  const [coverCameraStatus, setCoverCameraStatus] = useState("Point your camera at the book cover.");
  const [coverScanPreview, setCoverScanPreview] = useState("");
  const [debugMode, setDebugMode] = useState(false);
  const [ocrDebug, setOcrDebug] = useState<{
    detectedTitle: string;
    detectedAuthor: string;
    detectedIsbn: string;
    detectedText: string;
    confidence: number;
    source: string;
    message: string;
    debug?: OcrDebugInfo;
  } | null>(null);
  const [coverScanDiagnostics, setCoverScanDiagnostics] = useState<CoverScanDiagnostics | null>(null);

  useEffect(() => {
    void fetchBooks().then((items) => setBooks(items ?? []));
    void fetchCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    setDebugMode(process.env.NODE_ENV === "development" && new URLSearchParams(window.location.search).get("debug") === "true");
  }, []);

  useEffect(() => {
    return () => {
      stopCoverCamera(false);
      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }
      pendingPhotoUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    pendingPhotoUrlsRef.current = pendingPhotoUrls;
  }, [pendingPhotoUrls]);

  const nextId = useMemo(() => {
    if (typeof window === "undefined") return `${prefix}-001`;
    return nextInventoryId(books, prefix);
  }, [books, prefix]);

  function dataUrlToFile(dataUrl: string, fileName: string) {
    const [header, base64 = ""] = dataUrl.split(",");
    const mime = header.match(/data:(.*?);base64/)?.[1] || "image/jpeg";
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return new File([bytes], fileName, { type: mime });
  }

  function stopCoverCamera(updateState = true) {
    if (coverStreamRef.current) {
      coverStreamRef.current.getTracks().forEach((track) => track.stop());
      coverStreamRef.current = null;
    }

    if (coverVideoRef.current) {
      coverVideoRef.current.srcObject = null;
    }

    if (updateState) {
      setCoverCameraOpen(false);
    }
  }

  async function startCoverCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCoverCameraOpen(true);
      setCoverCameraStatus("Camera access is not available in this browser. Upload a photo or enter the book manually.");
      return;
    }

    setCoverCameraOpen(true);
    setCoverCameraStatus("Starting camera...");

    try {
      stopCoverCamera(false);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 960 }
        }
      });
      coverStreamRef.current = stream;

      const video = coverVideoRef.current;
      if (!video) throw new Error("Camera preview is unavailable.");

      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play();
      setCoverCameraStatus("Frame the full book cover, then capture.");
    } catch (error) {
      stopCoverCamera(false);
      setCoverCameraOpen(true);
      setCoverCameraStatus(
        error instanceof Error
          ? `${error.message}. Upload a photo or enter the book manually.`
          : "Camera could not be started. Upload a photo or enter the book manually."
      );
    }
  }

  async function captureCoverPhoto() {
    const video = coverVideoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setCoverCameraStatus("Camera is not ready yet. Try again in a moment.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setCoverCameraStatus("Could not capture the photo. Upload a photo or enter manually.");
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = canvas.toDataURL("image/jpeg", 0.9);
    const file = dataUrlToFile(image, `cover-scan-${Date.now()}.jpg`);
    stopCoverCamera();
    await processCoverImage(image, file);
  }

  async function lookupByIsbn(rawIsbn: string, coverUrl = "") {
    const isbn = cleanIsbn(rawIsbn);
    setIsbnLookupLoading(true);
    setLookupError("");
    setStep("looking");
    setStatusText("Checking Google Books by ISBN first...");
    setSuggestion(null);
    setSuggestions([]);

    const base = { ...blankDraft(coverUrl), isbn };
    if (!isbn) {
      setDraft(base);
      setStatusText("No ISBN was found. You can type the details manually.");
      setStep("review");
      setIsbnLookupLoading(false);
      return;
    }

    const result = await lookupGoogleBooks({ isbn });
    const matches = result.suggestions;
    const [match] = matches;
    if (match) {
      setSuggestion(match);
      setSuggestions(matches);
      setDraft(suggestionToDraft(match, base));
      setStatusText("ISBN match found. Review it before saving.");
    } else if (result.error) {
      setDraft(base);
      setLookupError(result.message || "Book lookup failed. You can still enter it manually.");
      setStatusText(result.message || "Book lookup failed. You can still enter it manually.");
    } else {
      setDraft(base);
      setStatusText("No ISBN match found. Manual entry is ready.");
    }
    setStep("review");
    setIsbnLookupLoading(false);
  }

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

  async function handleBarcodeFile(file: File) {
    const image = await fileToDataUrl(file);
    setDraft(blankDraft(image));
    setStep("looking");
    setStatusText("Reading the barcode or ISBN...");

    try {
      const isbn = await detectIsbnFromImage(image);
      await lookupByIsbn(isbn, image);
    } catch {
      setDraft(blankDraft(image));
      setLookupError("Book lookup failed. You can still enter it manually.");
      setStatusText("That barcode could not be read. Type the ISBN or enter the book manually.");
      setStep("review");
    }
  }

  async function processCoverImage(image: string, capturedCoverFile?: File) {
    setCoverScanPreview(image);
    setDraft(blankDraft(image));
    setStep("looking");
    setSuggestion(null);
    setSuggestions([]);
    setLookupError("");
    setOcrDebug(null);
    setCoverScanDiagnostics(null);
    setStatusText("Identifying book...");
    if (capturedCoverFile) {
      addPendingPhotos([capturedCoverFile]);
    }
    const result = await scanCoverForBook(image);
    setOcrDebug({
      detectedTitle: result.detectedTitle,
      detectedAuthor: result.detectedAuthor,
      detectedIsbn: result.detectedIsbn,
      detectedText: result.detectedText,
      confidence: result.confidence,
      source: result.source,
      message: result.message,
      debug: result.debug
    });
    setCoverScanDiagnostics(result.diagnostics);
    const ocrDraft = {
      ...blankDraft(image),
      title: result.detectedTitle,
      author: result.detectedAuthor,
      isbn: result.detectedIsbn
    };

    if (result.suggestions.length > 0) {
      setSuggestion(result.suggestion);
      setSuggestions(result.suggestions);
      setDraft(suggestionToDraft(result.suggestion, ocrDraft));
      setStatusText(
        result.detectedIsbn
          ? `Detected ISBN ${result.detectedIsbn}. Choose the correct Google Books match or edit manually.`
          : result.detectedTitle
            ? `Detected "${result.detectedTitle}". Choose the correct Google Books match or edit manually.`
          : "Google Books matches are ready. Choose the best one or edit manually."
      );
    } else {
      setSuggestion(null);
      setDraft(ocrDraft);
      if (result.error) {
        setLookupError("We couldn't identify this book automatically. You can still enter it manually.");
      }
      setStatusText("We couldn't identify this book automatically. You can still enter it manually.");
    }
    setStep("review");
  }

  async function handleCoverFile(file: File) {
    const image = await fileToDataUrl(file);
    await processCoverImage(image, file);
  }

  async function lookupByTitle() {
    setTitleLookupLoading(true);
    setLookupError("");
    setStep("looking");
    setStatusText("Searching Google Books by title and author...");
    setSuggestion(null);
    setSuggestions([]);
    const base = { ...blankDraft(), title: manualTitle, author: manualAuthor };
    const result = manualTitle
      ? await lookupGoogleBooks({ title: manualTitle, author: manualAuthor })
      : { suggestions: [] as GoogleBookSuggestion[], error: false, message: "" };
    const matches = result.suggestions;
    const [match] = matches;

    if (match) {
      setSuggestion(match);
      setSuggestions(matches);
      setDraft(suggestionToDraft(match, base));
      setStatusText("Google Books matches found. Choose the best match or edit manually.");
    } else if (result.error) {
      setSuggestion(null);
      setDraft(base);
      setLookupError(result.message || "Book lookup failed. You can still enter it manually.");
      setStatusText(result.message || "Book lookup failed. You can still enter it manually.");
    } else {
      setSuggestion(null);
      setDraft(base);
      setStatusText("No title match found. Manual entry is ready.");
    }
    setStep("review");
    setTitleLookupLoading(false);
  }

  async function saveBook() {
    setStatusText("Saving your book...");
    try {
      const book = await createBook(
        {
          ...draft,
          title: draft.title || "Untitled book",
          category: draft.category || "Uncategorized"
        },
        prefix,
        pendingPhotoFiles
      );
      setBooks((current) => [book, ...current]);
      setDraft(blankDraft());
      setSuggestion(null);
      setSuggestions([]);
      setLookupError("");
      setCoverScanPreview("");
      setOcrDebug(null);
      setCoverScanDiagnostics(null);
      setIsbnEntry("");
      setManualTitle("");
      setManualAuthor("");
      clearPendingPhotos();
      setStep("start");
      setStatusText(`${book.inventory_id} saved. Ready for the next scan.`);
      setToast(`${book.inventory_id} saved`);

      if (toastTimeoutRef.current) {
        window.clearTimeout(toastTimeoutRef.current);
      }

      toastTimeoutRef.current = window.setTimeout(() => {
        setToast("");
      }, 3500);

    } catch (error) {
      setStatusText(error instanceof Error ? error.message : "Save failed. Please try again.");
    }
  }

  async function createCategoryFromForm() {
    const name = window.prompt("New category name");
    if (!name?.trim()) return;
    const category = await createCategory(name.trim());
    setCategories((current) => [...current, category].sort((a, b) => a.name.localeCompare(b.name)));
    setDraft((current) => ({
      ...current,
      category_id: category.id,
      category: category.name,
      category_color: category.color
    }));
  }

  return (
    <AppShell>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:flex sm:items-center sm:justify-between">
        <Link href="/" className="btn-secondary w-full sm:w-auto">
          <ArrowLeft size={20} aria-hidden />
          Library
        </Link>
        <Link href="/batch-add" className="btn-secondary w-full sm:w-auto">
          <Upload size={20} aria-hidden />
          Batch Add
        </Link>
      </div>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="grid min-w-0 gap-4">
          <div className="panel p-4 sm:p-5">
            <p className="text-sm font-black uppercase tracking-wide text-marigold">Next inventory ID</p>
            <h1 className="mt-1 break-all font-serif text-3xl font-black sm:text-4xl">{nextId}</h1>
            <p className="mt-3 text-base font-semibold text-ink/70 sm:text-lg">
              Add any book by ISBN, cover photo, or typed title. Manual entry is always available.
            </p>
          </div>

          <InventoryPrefixSettings value={prefix} onChange={setPrefix} />

          <div className="panel grid gap-4 p-4 sm:p-5">
            <input
              ref={barcodeInput}
              className="hidden"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleBarcodeFile(file);
              }}
            />
            <input
              ref={coverInput}
              className="hidden"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleCoverFile(file);
              }}
            />

            <div className="rounded-lg bg-honey/25 p-3 sm:p-4">
              <div className="mb-3 flex items-center gap-2">
                <Barcode size={22} aria-hidden />
                <h2 className="text-lg font-black sm:text-xl">1. Scan barcode/ISBN</h2>
              </div>
              <LiveBarcodeScanner
                disabled={isbnLookupLoading}
                onDetected={(isbn) => {
                  setIsbnEntry(isbn);
                  void lookupByIsbn(isbn);
                }}
              />
              <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]">
                <input
                  className="field"
                  inputMode="numeric"
                  placeholder="Type or paste ISBN"
                  value={isbnEntry}
                  onChange={(event) => setIsbnEntry(event.target.value)}
                />
                <button className="btn-secondary" disabled={isbnLookupLoading} onClick={() => lookupByIsbn(isbnEntry)}>
                  {isbnLookupLoading ? <Loader2 className="animate-spin" size={20} aria-hidden /> : <Search size={20} aria-hidden />}
                  {isbnLookupLoading ? "Searching..." : "Search ISBN"}
                </button>
              </div>
              <button className="btn-secondary mt-2 w-full" onClick={() => barcodeInput.current?.click()}>
                <Upload size={20} aria-hidden />
                Upload Barcode Photo
              </button>
            </div>

            <div className="rounded-lg bg-mint/20 p-3 sm:p-4">
              <div className="mb-3 flex items-center gap-2">
                <Camera size={22} aria-hidden />
                <h2 className="text-lg font-black sm:text-xl">2. Scan book cover</h2>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <button className="btn-primary w-full" onClick={startCoverCamera}>
                  <Camera size={22} aria-hidden />
                  Use Camera
                </button>
                <button className="btn-secondary w-full" onClick={() => coverInput.current?.click()}>
                  <Upload size={20} aria-hidden />
                  Upload Photo
                </button>
              </div>
              {coverCameraOpen && (
                <div className="mt-3 grid gap-3 rounded-lg border-2 border-ink/10 bg-white p-3">
                  <div className="relative overflow-hidden rounded-lg bg-ink">
                    <video
                      ref={coverVideoRef}
                      className="aspect-[3/4] w-full object-cover"
                      muted
                      playsInline
                    />
                    <div className="pointer-events-none absolute inset-6 rounded-lg border-2 border-honey shadow-[0_0_0_999px_rgba(0,0,0,0.22)]" />
                  </div>
                  <p className="text-sm font-bold text-ink/70">{coverCameraStatus}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <button className="btn-primary w-full" onClick={captureCoverPhoto}>
                      <Camera size={20} aria-hidden />
                      Capture Cover
                    </button>
                    <button className="btn-secondary w-full" onClick={() => stopCoverCamera()}>
                      Stop Camera
                    </button>
                  </div>
                </div>
              )}
              {coverScanPreview ? (
                <div className="mt-3 overflow-hidden rounded-lg border-2 border-ink/10 bg-white">
                  <div className="aspect-[4/5] max-h-80 bg-honey/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={coverScanPreview} alt="Captured or uploaded book cover preview" className="h-full w-full object-cover" />
                  </div>
                  <p className="p-3 text-sm font-bold text-ink/65">Cover photo ready for recognition.</p>
                </div>
              ) : null}
            </div>

            <div className="rounded-lg bg-rose/15 p-3 sm:p-4">
              <div className="mb-3 flex items-center gap-2">
                <Keyboard size={22} aria-hidden />
                <h2 className="text-lg font-black sm:text-xl">3. Type title manually</h2>
              </div>
              <div className="grid gap-2">
                <input
                  className="field"
                  placeholder="Book title"
                  value={manualTitle}
                  onChange={(event) => setManualTitle(event.target.value)}
                />
                <input
                  className="field"
                  placeholder="Author, optional"
                  value={manualAuthor}
                  onChange={(event) => setManualAuthor(event.target.value)}
                />
                <div className="grid gap-2 md:grid-cols-2">
                  <button className="btn-secondary" disabled={titleLookupLoading} onClick={lookupByTitle}>
                    {titleLookupLoading ? <Loader2 className="animate-spin" size={20} aria-hidden /> : <Search size={20} aria-hidden />}
                    {titleLookupLoading ? "Searching..." : "Search Title"}
                  </button>
                  <button
                    className="btn-primary"
                    onClick={() => {
                      setSuggestion(null);
                      setSuggestions([]);
                      setLookupError("");
                      setDraft({ ...blankDraft(), title: manualTitle, author: manualAuthor });
                      setStatusText("Manual entry is ready.");
                      setStep("review");
                    }}
                  >
                    <Keyboard size={20} aria-hidden />
                    Enter Manually
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="panel min-w-0 p-4 sm:p-5">
          {step === "start" && (
            <div className="grid min-h-80 place-items-center text-center sm:min-h-96">
              <div>
                <Sparkles className="mx-auto mb-4 text-marigold" size={46} aria-hidden />
                <h2 className="font-serif text-2xl font-black sm:text-3xl">Choose an add method</h2>
                <p className="mx-auto mt-2 max-w-sm font-semibold text-ink/65">
                  ISBN search is fastest, cover scan is handy, and manual entry is always there.
                </p>
              </div>
            </div>
          )}

          {step === "looking" && (
            <div className="grid min-h-80 place-items-center text-center sm:min-h-96">
              <div>
                {coverScanPreview ? (
                  <div className="mx-auto mb-4 aspect-[4/5] w-32 overflow-hidden rounded-lg border-2 border-ink/10 bg-honey/20">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={coverScanPreview} alt="Book cover scan preview" className="h-full w-full object-cover" />
                  </div>
                ) : null}
                <Loader2 className="mx-auto mb-4 animate-spin text-marigold" size={48} aria-hidden />
                <h2 className="font-serif text-2xl font-black sm:text-3xl">Looking for your book...</h2>
                <p className="mx-auto mt-2 max-w-sm font-semibold text-ink/65">{statusText}</p>
              </div>
            </div>
          )}

          {step === "review" && (
            <div className="grid gap-5">
              <div className="grid gap-4 rounded-lg bg-honey/30 p-3 sm:p-4 md:grid-cols-[110px_minmax(0,1fr)]">
                <div className="relative aspect-[4/5] max-w-36 overflow-hidden rounded-lg bg-white md:max-w-none">
                  <Image
                    src={draft.cover_url || "/placeholder-cover.svg"}
                    alt="Selected book cover"
                    fill
                    sizes="120px"
                    className="object-cover"
                  />
                </div>
                <div>
                  <p className="text-sm font-black uppercase tracking-wide text-ink/55">Review before saving</p>
                  <p className="mt-2 break-words text-xl font-black sm:text-2xl">{suggestion?.title || draft.title || "Manual entry"}</p>
                  <p className="mt-1 text-sm font-bold text-ink/65">{statusText}</p>
                  {lookupError ? (
                    <p className="mt-3 inline-flex max-w-full items-center gap-2 rounded-lg bg-rose/15 px-3 py-2 text-sm font-bold text-ink">
                      <AlertCircle size={17} aria-hidden />
                      {lookupError}
                    </p>
                  ) : null}
                  {suggestion ? (
                    <button className="btn-secondary mt-3 w-full sm:w-auto" onClick={() => setDraft(suggestionToDraft(suggestion, draft))}>
                      <Check size={20} aria-hidden />
                      Use Selected Match
                    </button>
                  ) : (
                    <p className="mt-3 inline-flex max-w-full items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-bold">
                      <AlertCircle size={17} aria-hidden />
                      Fill in whatever you know.
                    </p>
                  )}
                </div>
              </div>
              {coverScanDiagnostics ? (
                <div className="grid gap-3 rounded-lg border-2 border-ink/10 bg-white p-3 sm:p-4">
                  <div>
                    <p className="text-sm font-black uppercase tracking-wide text-marigold">Cover scan diagnostics</p>
                    <p className="mt-1 text-sm font-semibold text-ink/65">
                      Automatic identification details from OCR and Google Books.
                    </p>
                  </div>
                  <div className="grid gap-2 text-sm font-bold text-ink/75 sm:grid-cols-2">
                    <p className="rounded-lg bg-honey/20 p-2">OCR enabled? {coverScanDiagnostics.ocrEnabled ? "yes" : "no"}</p>
                    <p className="rounded-lg bg-honey/20 p-2">
                      Google Books API enabled? {coverScanDiagnostics.googleBooksApiEnabled ? "yes" : "no"}
                    </p>
                    <p className="rounded-lg bg-honey/20 p-2">Matches returned: {coverScanDiagnostics.matchesReturned}</p>
                    <p className="rounded-lg bg-honey/20 p-2">
                      Status: {coverScanDiagnostics.failureReason ? "Needs manual review" : "Matches found"}
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <div className="rounded-lg bg-ink/5 p-3">
                      <p className="text-xs font-black uppercase tracking-wide text-ink/55">OCR text detected</p>
                      <pre className="mt-2 max-h-36 overflow-auto whitespace-pre-wrap text-xs font-semibold leading-5 text-ink/75">
                        {coverScanDiagnostics.ocrTextDetected || "No OCR text detected."}
                      </pre>
                    </div>
                    <div className="rounded-lg bg-ink/5 p-3">
                      <p className="text-xs font-black uppercase tracking-wide text-ink/55">Google Books query sent</p>
                      <pre className="mt-2 whitespace-pre-wrap text-xs font-semibold leading-5 text-ink/75">
                        {coverScanDiagnostics.googleBooksQueries.length
                          ? coverScanDiagnostics.googleBooksQueries.join("\n")
                          : "No Google Books query was sent."}
                      </pre>
                    </div>
                    <div className={`rounded-lg p-3 ${coverScanDiagnostics.apiErrors.length || coverScanDiagnostics.failureReason ? "bg-rose/15" : "bg-mint/20"}`}>
                      <p className="text-xs font-black uppercase tracking-wide text-ink/55">API errors / failure reason</p>
                      <pre className="mt-2 whitespace-pre-wrap text-xs font-semibold leading-5 text-ink/75">
                        {[
                          ...coverScanDiagnostics.apiErrors,
                          coverScanDiagnostics.failureReason
                        ].filter(Boolean).join("\n") || "No API errors reported."}
                      </pre>
                    </div>
                  </div>
                </div>
              ) : null}
              {suggestions.length > 0 && (
                <div className="grid gap-3">
                  <div>
                    <p className="text-sm font-black uppercase tracking-wide text-marigold">Google Books matches</p>
                    <p className="mt-1 text-sm font-semibold text-ink/65">Select the cover/title that matches your book, then edit anything below.</p>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {suggestions.map((match) => {
                      const selected = suggestion?.isbn
                        ? suggestion.isbn === match.isbn
                        : suggestion?.title === match.title && suggestion?.author === match.author;

                      return (
                        <button
                          className={`grid min-w-0 grid-cols-[56px_minmax(0,1fr)] gap-3 rounded-lg border-2 bg-white p-3 text-left transition ${
                            selected ? "border-marigold ring-4 ring-honey/30" : "border-ink/10 hover:border-marigold"
                          }`}
                          key={`${match.isbn}-${match.title}-${match.author}`}
                          onClick={() => {
                            setSuggestion(match);
                            setDraft(suggestionToDraft(match, draft));
                          }}
                        >
                          <div className="relative aspect-[4/5] overflow-hidden rounded-md bg-honey/20">
                            <Image
                              src={match.thumbnail || "/placeholder-cover.svg"}
                              alt={`${match.title} cover`}
                              fill
                              sizes="56px"
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
                </div>
              )}
              {debugMode && ocrDebug ? (
                <div className="grid gap-3 rounded-lg border-2 border-ink/10 bg-white p-3 sm:p-4">
                  <div>
                    <p className="text-sm font-black uppercase tracking-wide text-marigold">OCR debug</p>
                    <p className="mt-1 text-sm font-semibold text-ink/65">
                      Source: {ocrDebug.source} · Confidence: {Math.round((ocrDebug.confidence || 0) * 100)}%
                    </p>
                  </div>
                  <div className="grid gap-2 text-sm font-bold text-ink/75 sm:grid-cols-3">
                    <p className="break-words rounded-lg bg-honey/20 p-2">Title: {ocrDebug.detectedTitle || "None"}</p>
                    <p className="break-words rounded-lg bg-honey/20 p-2">Author: {ocrDebug.detectedAuthor || "None"}</p>
                    <p className="break-words rounded-lg bg-honey/20 p-2">ISBN: {ocrDebug.detectedIsbn || "None"}</p>
                  </div>
                  {ocrDebug.debug?.lines?.length ? (
                    <div className="rounded-lg bg-ink/5 p-3">
                      <p className="text-xs font-black uppercase tracking-wide text-ink/55">
                        Detected lines ({ocrDebug.debug.lineCount ?? ocrDebug.debug.lines.length})
                      </p>
                      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs font-semibold leading-5 text-ink/70">
                        {ocrDebug.debug.lines.join("\n")}
                      </pre>
                    </div>
                  ) : ocrDebug.detectedText ? (
                    <div className="rounded-lg bg-ink/5 p-3">
                      <p className="text-xs font-black uppercase tracking-wide text-ink/55">Detected text</p>
                      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs font-semibold leading-5 text-ink/70">
                        {ocrDebug.detectedText.slice(0, 1200)}
                      </pre>
                    </div>
                  ) : (
                    <p className="rounded-lg bg-rose/15 p-3 text-sm font-bold text-ink/70">
                      {ocrDebug.message || "No OCR text was detected. Manual entry is ready."}
                    </p>
                  )}
                </div>
              ) : null}
              <BookFormFields
                value={draft}
                onChange={setDraft}
                categories={categories}
                onCreateCategory={createCategoryFromForm}
                pendingPhotoUrls={pendingPhotoUrls}
                onPhotosSelected={addPendingPhotos}
                onRemovePendingPhoto={removePendingPhoto}
              />
              <button className="btn-primary w-full text-lg" onClick={saveBook}>
                <Save size={22} aria-hidden />
                Save & Scan Next
              </button>
            </div>
          )}
        </div>
      </section>

      {toast ? (
        <div className="fixed inset-x-3 bottom-24 z-40 mx-auto flex max-w-sm items-center gap-3 rounded-lg border-2 border-ink/10 bg-white px-4 py-3 font-black text-ink shadow-soft sm:bottom-6 sm:right-6 sm:left-auto">
          <Check className="shrink-0 rounded-full bg-mint/30 p-1" size={28} aria-hidden />
          <span className="min-w-0 truncate">{toast}. Ready for next scan.</span>
        </div>
      ) : null}
    </AppShell>
  );
}
