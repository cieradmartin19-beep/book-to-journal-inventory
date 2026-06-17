import { NextResponse } from "next/server";

type GoogleBooksImageLinks = {
  smallThumbnail?: string;
  thumbnail?: string;
  small?: string;
  medium?: string;
  large?: string;
  extraLarge?: string;
};

type GoogleBooksVolume = {
  volumeInfo?: {
    title?: string;
    authors?: string[];
    publisher?: string;
    publishedDate?: string;
    industryIdentifiers?: { type?: string; identifier?: string }[];
    categories?: string[];
    imageLinks?: GoogleBooksImageLinks;
    description?: string;
  };
};

type BookSuggestion = {
  title: string;
  author: string;
  publisher: string;
  published_year: string;
  isbn: string;
  thumbnail: string;
  category: string;
  description?: string;
  source?: string;
};

type LookupResult = {
  suggestions: BookSuggestion[];
  query: string;
  error?: string;
};

type OpenLibraryDoc = {
  title?: string;
  author_name?: string[];
  publisher?: string[];
  first_publish_year?: number;
  publish_year?: number[];
  isbn?: string[];
  isbn_13?: string[];
  isbn_10?: string[];
  cover_i?: number;
  subject?: string[];
};

type IsbnDbBook = {
  title?: string;
  title_long?: string;
  authors?: string[];
  publisher?: string;
  date_published?: string;
  isbn?: string;
  isbn10?: string;
  isbn13?: string;
  image?: string;
  subjects?: string[];
  synopsis?: string;
};

type InternetArchiveDoc = {
  identifier?: string;
  title?: string;
  creator?: string | string[];
  publisher?: string | string[];
  date?: string;
  isbn?: string | string[];
  subject?: string | string[];
  description?: string | string[];
};

type InternetArchiveMetadata = {
  metadata?: InternetArchiveDoc;
};

const BOOK_LOOKUP_LOG_PREFIX = "[book-lookup-debug]";
const GOOGLE_BOOKS_ENDPOINT = "https://www.googleapis.com/books/v1/volumes";

function toHttps(url = "") {
  return url.replace(/^http:\/\//i, "https://");
}

function bestCoverUrl(imageLinks?: GoogleBooksImageLinks) {
  if (!imageLinks) return "";

  return toHttps(
    imageLinks.extraLarge ??
      imageLinks.large ??
      imageLinks.medium ??
      imageLinks.small ??
      imageLinks.thumbnail ??
      imageLinks.smallThumbnail ??
      ""
  );
}

function yearFrom(value?: string | number) {
  return String(value ?? "").match(/\d{4}/)?.[0] ?? "";
}

function firstValue(value?: string | string[] | number[]) {
  if (Array.isArray(value)) return String(value[0] ?? "");
  return String(value ?? "");
}

function normalizeIsbn(value = "") {
  return value.replace(/[^0-9Xx]/g, "").toUpperCase();
}

function cleanSuggestions(suggestions: BookSuggestion[]) {
  const seen = new Set<string>();
  const clean: BookSuggestion[] = [];

  for (const suggestion of suggestions) {
    const title = suggestion.title.trim();
    if (!title) continue;
    const isbn = normalizeIsbn(suggestion.isbn);
    const key = [isbn, title.toLowerCase(), suggestion.author.toLowerCase()].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    clean.push({
      ...suggestion,
      title,
      isbn,
      thumbnail: toHttps(suggestion.thumbnail)
    });
  }

  return clean.slice(0, 5);
}

function redactGoogleApiKey(url: URL) {
  const redacted = new URL(url.toString());
  if (redacted.searchParams.has("key")) redacted.searchParams.set("key", "[REDACTED]");
  return redacted.toString();
}

async function fetchJson<T>(url: URL | string, init?: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Request failed (${response.status} ${response.statusText})${detail ? `: ${detail}` : ""}`);
  }
  return response.json() as Promise<T>;
}

async function searchGoogleBooks(params: { isbn?: string; title?: string; author?: string; queryText?: string }): Promise<LookupResult> {
  const { isbn, title, author, queryText } = params;
  const googleBooksApiKey = process.env.GOOGLE_BOOKS_API_KEY;
  const url = new URL(GOOGLE_BOOKS_ENDPOINT);
  const query = isbn
    ? `isbn:${isbn}`
    : queryText
      ? queryText
      : [`intitle:${title}`, author ? `inauthor:${author}` : ""].filter(Boolean).join(" ");
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", "5");
  if (googleBooksApiKey) {
    url.searchParams.set("key", googleBooksApiKey);
  }

  console.log(`${BOOK_LOOKUP_LOG_PREFIX} Query sent to Google Books`, {
    query,
    endpoint: GOOGLE_BOOKS_ENDPOINT,
    hasApiKey: Boolean(googleBooksApiKey),
    keyLength: googleBooksApiKey?.length ?? 0,
    requestUrl: redactGoogleApiKey(url)
  });

  try {
    const response = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
    const responseBody = await response.text();
    if (!response.ok) {
      console.error(`${BOOK_LOOKUP_LOG_PREFIX} Google Books HTTP error`, {
        query,
        status: response.status,
        statusText: response.statusText,
        responseBody
      });
      throw new Error(`Google Books request failed (${response.status} ${response.statusText}). ${responseBody}`);
    }

    const data = JSON.parse(responseBody) as { items?: GoogleBooksVolume[] };
    console.log(`${BOOK_LOOKUP_LOG_PREFIX} Raw Google Books response count`, {
      query,
      itemCount: data.items?.length ?? 0,
      totalItems: (data as { totalItems?: number }).totalItems ?? null
    });
    const suggestions = cleanSuggestions((data.items ?? []).map((item) => {
      const info = item.volumeInfo ?? {};
      const primaryIsbn =
        info.industryIdentifiers?.find((identifier) => identifier.type === "ISBN_13")?.identifier ??
        info.industryIdentifiers?.find((identifier) => identifier.type === "ISBN_10")?.identifier ??
        isbn ??
        "";

      return {
        title: info.title ?? title ?? "",
        author: info.authors?.join(", ") ?? "",
        publisher: info.publisher ?? "",
        published_year: info.publishedDate?.slice(0, 4) ?? "",
        isbn: primaryIsbn,
        thumbnail: bestCoverUrl(info.imageLinks),
        category: info.categories?.[0] ?? "",
        description: info.description ?? "",
        source: "Google Books"
      };
    }));
    return { suggestions, query };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google Books request failed.";
    console.error(`${BOOK_LOOKUP_LOG_PREFIX} Google Books API error`, {
      query,
      error: message
    });
    return { suggestions: [], query, error: message };
  }
}

async function searchOpenLibrary(params: { isbn?: string; title?: string; author?: string; queryText?: string }): Promise<LookupResult> {
  const { isbn, title, author, queryText } = params;
  const url = new URL("https://openlibrary.org/search.json");
  const query = queryText || [title, author].filter(Boolean).join(" ");
  if (isbn) url.searchParams.set("isbn", isbn);
  else if (title) url.searchParams.set("title", title);
  else url.searchParams.set("q", query);
  if (author && !queryText) url.searchParams.set("author", author);
  url.searchParams.set("limit", "5");
  url.searchParams.set("fields", "title,author_name,publisher,first_publish_year,publish_year,isbn,isbn_13,isbn_10,cover_i,subject");

  try {
    const data = await fetchJson<{ docs?: OpenLibraryDoc[] }>(url, { next: { revalidate: 60 * 60 * 24 } });
    const suggestions = cleanSuggestions((data.docs ?? []).map((doc) => {
      const primaryIsbn = doc.isbn_13?.[0] ?? doc.isbn?.find((item) => normalizeIsbn(item).length === 13) ?? doc.isbn_10?.[0] ?? doc.isbn?.[0] ?? isbn ?? "";
      return {
        title: doc.title ?? title ?? "",
        author: doc.author_name?.join(", ") ?? "",
        publisher: doc.publisher?.[0] ?? "",
        published_year: yearFrom(doc.first_publish_year ?? doc.publish_year?.[0]),
        isbn: primaryIsbn,
        thumbnail: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : "",
        category: doc.subject?.[0] ?? "",
        description: "",
        source: "Open Library"
      };
    }));
    return { suggestions, query: isbn ? `openlibrary:isbn:${isbn}` : query };
  } catch (error) {
    return { suggestions: [], query: isbn ? `openlibrary:isbn:${isbn}` : query, error: error instanceof Error ? error.message : "Open Library request failed." };
  }
}

async function searchIsbnDb(isbn: string): Promise<LookupResult> {
  const apiKey = process.env.ISBNDB_API_KEY;
  const query = `isbndb:book:${isbn}`;
  if (!apiKey) return { suggestions: [], query, error: "ISBNDB_API_KEY is not configured." };

  try {
    const data = await fetchJson<{ book?: IsbnDbBook }>(`https://api2.isbndb.com/book/${isbn}`, {
      headers: { Authorization: apiKey },
      next: { revalidate: 60 * 60 * 24 }
    });
    const book = data.book;
    const suggestions = book
      ? cleanSuggestions([{
          title: book.title_long || book.title || "",
          author: book.authors?.join(", ") ?? "",
          publisher: book.publisher ?? "",
          published_year: yearFrom(book.date_published),
          isbn: book.isbn13 || book.isbn || book.isbn10 || isbn,
          thumbnail: book.image ?? "",
          category: book.subjects?.[0] ?? "",
          description: book.synopsis ?? "",
          source: "ISBNdb"
        }])
      : [];
    return { suggestions, query };
  } catch (error) {
    return { suggestions: [], query, error: error instanceof Error ? error.message : "ISBNdb request failed." };
  }
}

function internetArchiveQuery(params: { isbn?: string; title?: string; author?: string; queryText?: string }) {
  if (params.isbn) return `isbn:${params.isbn} AND mediatype:texts`;
  const text = params.queryText || [params.title, params.author].filter(Boolean).join(" ");
  return text ? `(${text}) AND mediatype:texts` : "mediatype:texts";
}

function mapInternetArchiveMetadata(identifier: string, metadata?: InternetArchiveDoc): BookSuggestion {
  return {
    title: firstValue(metadata?.title),
    author: firstValue(metadata?.creator),
    publisher: firstValue(metadata?.publisher),
    published_year: yearFrom(firstValue(metadata?.date)),
    isbn: normalizeIsbn(firstValue(metadata?.isbn)),
    thumbnail: identifier ? `https://archive.org/services/img/${identifier}` : "",
    category: firstValue(metadata?.subject),
    description: firstValue(metadata?.description),
    source: "Internet Archive"
  };
}

async function searchInternetArchive(params: { isbn?: string; title?: string; author?: string; queryText?: string }): Promise<LookupResult> {
  const query = internetArchiveQuery(params);
  const url = new URL("https://archive.org/advancedsearch.php");
  url.searchParams.set("q", query);
  url.searchParams.set("output", "json");
  url.searchParams.set("rows", "5");
  ["identifier", "title", "creator", "publisher", "date", "isbn", "subject", "description"].forEach((field) => {
    url.searchParams.append("fl[]", field);
  });

  try {
    const data = await fetchJson<{ response?: { docs?: InternetArchiveDoc[] } }>(url, { next: { revalidate: 60 * 60 * 24 } });
    const docs = data.response?.docs ?? [];
    const metadataResults = await Promise.all(
      docs.slice(0, 5).map(async (doc) => {
        if (!doc.identifier) return mapInternetArchiveMetadata("", doc);
        try {
          const metadata = await fetchJson<InternetArchiveMetadata>(`https://archive.org/metadata/${doc.identifier}`, {
            next: { revalidate: 60 * 60 * 24 }
          });
          return mapInternetArchiveMetadata(doc.identifier, metadata.metadata ?? doc);
        } catch {
          return mapInternetArchiveMetadata(doc.identifier, doc);
        }
      })
    );

    return { suggestions: cleanSuggestions(metadataResults), query };
  } catch (error) {
    return { suggestions: [], query, error: error instanceof Error ? error.message : "Internet Archive request failed." };
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isbn = searchParams.get("isbn");
  const title = searchParams.get("title");
  const author = searchParams.get("author");
  const queryText = searchParams.get("q");

  if (!isbn && !title && !queryText) {
    return NextResponse.json({
      suggestions: [],
      error: true,
      message: "ISBN, title, or query text is required.",
      diagnostics: {
        googleBooksApiEnabled: Boolean(process.env.GOOGLE_BOOKS_API_KEY),
        query: "",
        matchesReturned: 0,
        apiError: "ISBN, title, or query text is required."
      }
    }, { status: 400 });
  }

  const params = {
    isbn: isbn ? normalizeIsbn(isbn) : "",
    title: title ?? "",
    author: author ?? "",
    queryText: queryText ?? ""
  };
  console.log(`${BOOK_LOOKUP_LOG_PREFIX} lookup route request`, params);
  const providerResults: LookupResult[] = [];
  const google = await searchGoogleBooks(params);
  providerResults.push(google);

  let suggestions = google.suggestions;
  if (suggestions.length === 0) {
    const openLibrary = await searchOpenLibrary(params);
    providerResults.push(openLibrary);

    const isbnDb = params.isbn ? await searchIsbnDb(params.isbn) : null;
    if (isbnDb) providerResults.push(isbnDb);

    const internetArchive = await searchInternetArchive(params);
    providerResults.push(internetArchive);

    suggestions = cleanSuggestions(providerResults.flatMap((result) => result.suggestions));
  }

  const providerQueries = providerResults.slice(1).map((result) => result.query).filter(Boolean);
  const providerErrors = providerResults
    .filter((result) => result.error)
    .map((result) => `${result.query}: ${result.error}`);
  const winningProvider = suggestions[0]?.source || "";
  console.log(`${BOOK_LOOKUP_LOG_PREFIX} provider summary`, {
    googleQuery: google.query,
    googleMatches: google.suggestions.length,
    providerQueries,
    providerErrors,
    finalMatches: suggestions.length,
    winningProvider
  });

  return NextResponse.json({
    suggestions: suggestions.slice(0, 5),
    error: suggestions.length === 0 && providerErrors.length > 0,
    message: suggestions.length
      ? winningProvider ? `Matches found from ${winningProvider}.` : "Book matches found."
      : "No provider returned a match. Manual entry is ready.",
    diagnostics: {
      googleBooksApiEnabled: Boolean(process.env.GOOGLE_BOOKS_API_KEY),
      isbnDbApiEnabled: Boolean(process.env.ISBNDB_API_KEY),
      query: google.query,
      provider: winningProvider,
      providerQueries,
      providerErrors,
      matchesReturned: suggestions.length,
      apiError: suggestions.length ? "" : providerErrors.join("\n")
    }
  });
}
