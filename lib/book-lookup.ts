"use client";

import type { BookDraft, GoogleBookSuggestion } from "@/lib/types";

export function blankDraft(cover = ""): BookDraft {
  return {
    title: "",
    author: "",
    publisher: "",
    published_year: "",
    isbn: "",
    cover_url: cover,
    photo_urls: [],
    category: "Uncategorized",
    book_type: "Regular Book",
    condition: "Good",
    cost: 0,
    status: "Inventory",
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
    category: suggestion.category || current.category || "Uncategorized"
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

export async function searchGoogleBooks(params: { isbn?: string; title?: string; author?: string }) {
  const result = await lookupGoogleBooks(params);
  return result.suggestions;
}

export async function lookupGoogleBooks(params: { isbn?: string; title?: string; author?: string }) {
  const search = new URLSearchParams();
  if (params.isbn) search.set("isbn", cleanIsbn(params.isbn));
  if (params.title) search.set("title", params.title);
  if (params.author) search.set("author", params.author);

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
      message: data.message || ""
    };
  } catch {
    return {
      suggestions: [] as GoogleBookSuggestion[],
      error: true,
      message: "Book lookup failed. You can still enter it manually."
    };
  }
}

export async function scanCoverForBook(image: string) {
  let identify: {
    detectedTitle?: string;
    detectedAuthor?: string;
    detectedText?: string;
    confidence?: number;
    message?: string;
    source?: string;
  } = {};

  try {
    const response = await fetch("/api/identify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image })
    });

    if (response.ok) {
      identify = await response.json();
    }
  } catch {
    identify = {
      message: "Book lookup failed. You can still enter it manually."
    };
  }

  const detectedTitle = identify.detectedTitle || "";
  const detectedAuthor = identify.detectedAuthor || "";
  const lookup = detectedTitle
    ? await lookupGoogleBooks({ title: detectedTitle, author: detectedAuthor })
    : { suggestions: [] as GoogleBookSuggestion[], error: false, message: "" };
  const suggestions = lookup.suggestions;

  return {
    detectedTitle,
    detectedAuthor,
    detectedText: identify.detectedText || "",
    confidence: identify.confidence || 0,
    message: lookup.message || identify.message || "",
    error: lookup.error,
    source: identify.source || "ocr",
    suggestions,
    suggestion: suggestions[0] ?? {
      title: detectedTitle,
      author: detectedAuthor,
      publisher: "",
      published_year: "",
      isbn: "",
      thumbnail: "",
      category: ""
    }
  };
}

type BarcodeDetectorFormat =
  | "aztec"
  | "code_128"
  | "code_39"
  | "code_93"
  | "codabar"
  | "data_matrix"
  | "ean_13"
  | "ean_8"
  | "itf"
  | "pdf417"
  | "qr_code"
  | "upc_a"
  | "upc_e";

type BarcodeDetection = { rawValue: string; format: BarcodeDetectorFormat };

type BarcodeDetectorConstructor = new (options?: {
  formats?: BarcodeDetectorFormat[];
}) => {
  detect(image: HTMLImageElement | HTMLVideoElement): Promise<BarcodeDetection[]>;
};

export function scannedValueToIsbn(value: string) {
  const raw = cleanIsbn(value);

  if (raw.length === 13 && (raw.startsWith("978") || raw.startsWith("979"))) return raw;
  if (raw.length === 10) return raw;
  return "";
}

export function getBarcodeDetector() {
  const barcodeDetector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
  if (!barcodeDetector) return null;

  return new barcodeDetector({
    formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128"]
  });
}

export async function detectIsbnFromImage(imageDataUrl: string) {
  const detector = getBarcodeDetector();
  if (!detector) return "";

  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = reject;
    element.src = imageDataUrl;
  });

  const [result] = await detector.detect(image);
  return scannedValueToIsbn(result?.rawValue || "");
}
