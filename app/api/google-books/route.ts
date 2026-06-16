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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const isbn = searchParams.get("isbn");
  const title = searchParams.get("title");
  const author = searchParams.get("author");

  if (!isbn && !title) {
    return NextResponse.json({ error: "ISBN or title is required." }, { status: 400 });
  }

  const url = new URL("https://www.googleapis.com/books/v1/volumes");
  const query = isbn
    ? `isbn:${isbn}`
    : [`intitle:${title}`, author ? `inauthor:${author}` : ""].filter(Boolean).join("+");
  url.searchParams.set("q", query);
  url.searchParams.set("maxResults", "5");
  if (process.env.GOOGLE_BOOKS_API_KEY) {
    url.searchParams.set("key", process.env.GOOGLE_BOOKS_API_KEY);
  }

  try {
    const response = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
    if (!response.ok) throw new Error("Google Books request failed");
    const data = (await response.json()) as { items?: GoogleBooksVolume[] };
    const suggestions = (data.items ?? []).map((item) => {
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
        description: info.description ?? ""
      };
    });

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({
      suggestions: [],
      error: true,
      message: "Book lookup failed. You can still enter it manually."
    });
  }
}
