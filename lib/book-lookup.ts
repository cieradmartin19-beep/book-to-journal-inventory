"use client";

import { BarcodeFormat, BrowserMultiFormatOneDReader } from "@zxing/browser";
import { DecodeHintType } from "@zxing/library";
import type { BookDraft, GoogleBookSuggestion } from "@/lib/types";

export type OcrDebugInfo = {
  hasApiKey?: boolean;
  textLength?: number;
  lineCount?: number;
  lines?: string[];
  titleScore?: number;
  detectedIsbn?: string;
  error?: string;
  status?: number;
  statusText?: string;
};

export type GoogleBooksLookupDiagnostics = {
  googleBooksApiEnabled?: boolean;
  isbnDbApiEnabled?: boolean;
  query?: string;
  matchesReturned?: number;
  firstResultTitle?: string;
  apiError?: string;
  provider?: string;
  providerQueries?: string[];
  providerErrors?: string[];
};

export type CoverScanDiagnostics = {
  ocrEnabled: boolean;
  googleBooksApiEnabled: boolean;
  isbnDbApiEnabled?: boolean;
  ocrTextDetected: string;
  googleBooksQuery: string;
  googleBooksQueries: string[];
  providerQueries?: string[];
  matchesReturned: number;
  firstResultTitle: string;
  apiErrors: string[];
  failureReason: string;
};

export function blankDraft(cover = ""): BookDraft {
  return {
    title: "",
    author: "",
    publisher: "",
    published_year: "",
    isbn: "",
    cover_url: cover,
    photo_urls: [],
    category_id: null,
    category: "Uncategorized",
    category_color: null,
    book_type: "Regular Book",
    condition: "Good",
    cost: 0,
    status_id: null,
    status: "Inventory",
    status_color: null,
    listed_price: 0,
    sold_price: 0,
    notes: "",
    show_public: false
  };
}

export function suggestionToDraft(suggestion: GoogleBookSuggestion, current = blankDraft()): BookDraft {
  return {
    ...current,
    title: suggestion.title || current.title,
    author: suggestion.author || current.author,
    publisher: suggestion.publisher || current.publisher,
    published_year: suggestion.published_year || current.published_year,
    isbn: suggestion.isbn || current.isbn,
    cover_url: suggestion.thumbnail || current.cover_url,
    category: current.category || "Uncategorized"
  };
}

export function cleanIsbn(value: string) {
  return value.replace(/[^0-9Xx]/g, "").toUpperCase();
}

export async function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function searchGoogleBooks(params: { isbn?: string; title?: string; author?: string; query?: string }) {
  const result = await lookupGoogleBooks(params);
  return result.suggestions;
}

export async function lookupGoogleBooks(params: { isbn?: string; title?: string; author?: string; query?: string }) {
  const search = new URLSearchParams();
  if (params.isbn) search.set("isbn", cleanIsbn(params.isbn));
  if (params.title) search.set("title", params.title);
  if (params.author) search.set("author", params.author);
  if (params.query) search.set("q", params.query);

  try {
    const response = await fetch(`/api/google-books?${search.toString()}`);
    if (!response.ok) {
      return {
        suggestions: [] as GoogleBookSuggestion[],
        error: true,
        message: "Book lookup failed. You can still enter it manually."
      };
    }

    const data = await response.json();
    return {
      suggestions: (data.suggestions ?? []) as GoogleBookSuggestion[],
      error: Boolean(data.error),
      message: data.message || "",
      diagnostics: data.diagnostics as GoogleBooksLookupDiagnostics | undefined
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Book lookup failed. You can still enter it manually.";
    return {
      suggestions: [] as GoogleBookSuggestion[],
      error: true,
      message,
      diagnostics: {
        matchesReturned: 0,
        apiError: message
      } satisfies GoogleBooksLookupDiagnostics
    };
  }
}

function compactDetectedText(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line && !/isbn|barcode|copyright|www\.|\.com/i.test(line))
    .slice(0, 5)
    .join(" ");
}

function firstDetectedTextLine(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .find((line) => line && !/isbn|barcode|copyright|www\.|\.com/i.test(line)) ?? "";
}

function mergeSuggestions(groups: GoogleBookSuggestion[][]) {
  const seen = new Set<string>();
  const merged: GoogleBookSuggestion[] = [];

  for (const group of groups) {
    for (const suggestion of group) {
      const key = [suggestion.isbn, suggestion.title.toLowerCase(), suggestion.author.toLowerCase()].join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(suggestion);
    }
  }

  return merged.slice(0, 5);
}

export async function scanCoverForBook(image: string) {
  let identify: {
    detectedTitle?: string;
    detectedAuthor?: string;
    detectedIsbn?: string;
    detectedText?: string;
    confidence?: number;
    message?: string;
    source?: string;
    debug?: OcrDebugInfo;
  } = {};
  let identifyError = "";

  try {
    const response = await fetch("/api/identify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image })
    });

    if (response.ok) {
      identify = await response.json();
    } else {
      identifyError = `OCR request failed (${response.status} ${response.statusText}).`;
      identify = {
        message: identifyError,
        debug: { error: identifyError }
      };
    }
  } catch (error) {
    identifyError = error instanceof Error ? error.message : "OCR request failed.";
    identify = {
      message: identifyError,
      debug: { error: identifyError }
    };
  }

  const detectedTitle = identify.detectedTitle || "";
  const detectedAuthor = identify.detectedAuthor || "";
  const detectedIsbn = identify.detectedIsbn || "";
  const detectedTextFallbackTitle = firstDetectedTextLine(identify.detectedText || "");
  const detectedTextQuery = compactDetectedText(identify.detectedText || "");
  const lookups = [];

  if (detectedIsbn) lookups.push(await lookupGoogleBooks({ isbn: detectedIsbn }));
  if (detectedTitle) lookups.push(await lookupGoogleBooks({ title: detectedTitle, author: detectedAuthor }));
  if (detectedTextQuery && detectedTextQuery !== detectedTitle) lookups.push(await lookupGoogleBooks({ query: detectedTextQuery }));

  const lookup = lookups.find((result) => result.suggestions.length > 0) ??
    lookups.find((result) => result.error) ??
    { suggestions: [] as GoogleBookSuggestion[], error: false, message: "" };
  const suggestions = mergeSuggestions(lookups.map((result) => result.suggestions));
  const googleBooksQueries = lookups.map((result) => result.diagnostics?.query).filter(Boolean) as string[];
  const googleBooksQuery = googleBooksQueries[0] ?? "";
  const providerQueries = lookups.flatMap((result) => result.diagnostics?.providerQueries ?? []);
  const apiErrors = [
    identify.debug?.error,
    ...lookups
      .flatMap((result) => [
        result.diagnostics?.apiError,
        ...(result.diagnostics?.providerErrors ?? []),
        result.error ? result.message : ""
      ])
      .filter(Boolean)
  ].filter(Boolean) as string[];
  const googleBooksApiEnabled = lookups.some((result) => result.diagnostics?.googleBooksApiEnabled);
  const isbnDbApiEnabled = lookups.some((result) => result.diagnostics?.isbnDbApiEnabled);
  const matchesReturned = suggestions.length;
  const firstResultTitle =
    suggestions[0]?.title ||
    lookups.map((result) => result.diagnostics?.firstResultTitle).find(Boolean) ||
    "";
  const fallbackTitle = detectedTitle || detectedTextFallbackTitle;
  const failureReason = suggestions.length > 0
    ? ""
    : apiErrors[0] ||
      (!identify.debug?.hasApiKey ? "GOOGLE_CLOUD_VISION_API_KEY is not configured, so OCR could not run." : "") ||
      (!detectedTitle && !detectedIsbn && !detectedTextQuery ? "OCR did not detect enough searchable text." : "") ||
      "Google Books, Open Library, ISBNdb, and Internet Archive returned no matches for the detected cover text.";

  return {
    detectedTitle,
    detectedAuthor,
    detectedIsbn,
    detectedText: identify.detectedText || "",
    confidence: identify.confidence || 0,
    message: suggestions.length > 0
      ? lookup.message || identify.message || ""
      : lookup.message || identify.message || "We couldn't identify this book automatically. You can still enter it manually.",
    error: lookup.error,
    source: identify.source || "ocr",
    debug: identify.debug,
    diagnostics: {
      ocrEnabled: Boolean(identify.debug?.hasApiKey),
      googleBooksApiEnabled,
      isbnDbApiEnabled,
      ocrTextDetected: identify.detectedText || "",
      googleBooksQuery,
      googleBooksQueries,
      providerQueries,
      matchesReturned,
      firstResultTitle,
      apiErrors,
      failureReason
    } satisfies CoverScanDiagnostics,
    suggestions,
    suggestion: suggestions[0] ?? {
      title: fallbackTitle,
      author: detectedAuthor,
      publisher: "",
      published_year: "",
      isbn: detectedIsbn,
      thumbnail: "",
      category: ""
    }
  };
}

export function scannedValueToIsbn(value: string) {
  const raw = cleanIsbn(value);

  const embeddedIsbn13 = raw.match(/97[89]\d{10}/)?.[0];
  if (embeddedIsbn13) return embeddedIsbn13;

  if (raw.length === 13 && (raw.startsWith("978") || raw.startsWith("979"))) return raw;
  if (raw.length === 12) {
    const leadingZeroEan = `0${raw}`;
    if (leadingZeroEan.startsWith("978") || leadingZeroEan.startsWith("979")) return leadingZeroEan;
  }
  if (/^\d{9}[\dX]$/.test(raw)) return raw;

  return "";
}

export function createIsbnBarcodeReader() {
  const possibleFormats = [
    BarcodeFormat.EAN_13,
    BarcodeFormat.UPC_A,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128
  ];
  const hints = new Map<DecodeHintType, unknown>([
    [DecodeHintType.POSSIBLE_FORMATS, possibleFormats],
    [DecodeHintType.TRY_HARDER, true]
  ]);
  const codeReader = new BrowserMultiFormatOneDReader(hints, {
    delayBetweenScanAttempts: 50,
    delayBetweenScanSuccess: 250,
    tryPlayVideoTimeout: 7000
  });
  codeReader.possibleFormats = possibleFormats;
  return codeReader;
}

export async function decodeBarcodeFromImage(imageDataUrl: string) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = reject;
    element.src = imageDataUrl;
  });

  const result = await createIsbnBarcodeReader().decodeFromImageElement(image);
  const raw = result.getText();
  return {
    raw,
    isbn: scannedValueToIsbn(raw),
    format: result.getBarcodeFormat()?.toString?.() || ""
  };
}

export async function detectIsbnFromImage(imageDataUrl: string) {
  try {
    const result = await decodeBarcodeFromImage(imageDataUrl);
    return result.isbn;
  } catch {
    return "";
  }
}
