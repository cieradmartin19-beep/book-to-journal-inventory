import type { Book, BookDraft } from "@/lib/types";
import { getSupabaseBrowserClient } from "@/lib/supabase";

const PHOTO_BUCKET = "book-photos";

type SupabaseBookRow = Book & {
  book_photos?: { url: string; sort_order: number }[];
  categories?: { name: string; color: string } | null;
  statuses?: { name: string; color: string; sort_order: number } | null;
};

type PublicSupabaseBookRow = Pick<
  Book,
  | "id"
  | "inventory_prefix"
  | "inventory_number"
  | "inventory_id"
  | "title"
  | "author"
  | "publisher"
  | "published_year"
  | "isbn"
  | "cover_url"
  | "category_id"
  | "category"
  | "category_color"
  | "status_id"
  | "status_color"
  | "book_type"
  | "condition"
  | "status"
  | "listed_price"
  | "show_public"
  | "created_at"
> & {
  photo_urls?: string[];
};

function withPhotoUrls(book: SupabaseBookRow): Book {
  const photoUrls = [...(book.book_photos ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((photo) => photo.url)
    .filter(Boolean);
  const { book_photos, ...rest } = book;
  const category = book.categories;
  const status = book.statuses;

  return {
    ...rest,
    category: category?.name || book.category || "Uncategorized",
    category_color: category?.color || book.category_color || null,
    status: status?.name || book.status || "Inventory",
    status_color: status?.color || book.status_color || null,
    photo_urls: photoUrls
  } as Book;
}

function withPublicPhotoUrls(book: PublicSupabaseBookRow): Book {
  return {
    ...book,
    user_id: null,
    photo_urls: Array.isArray(book.photo_urls) ? book.photo_urls : [],
    cost: 0,
    sold_price: 0,
    profit: 0,
    notes: ""
  };
}

export async function uploadCoverToSupabase(file: File, userId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const path = `${userId}/${crypto.randomUUID()}-${file.name}`;
  const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false
  });

  if (error) throw error;
  const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadBookPhotoFiles(bookId: string, userId: string, files: File[]) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || files.length === 0) return [];

  const uploaded: { url: string; storage_path: string }[] = [];
  for (const file of files) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const storagePath = `${userId}/${bookId}/${crypto.randomUUID()}-${safeName}`;
    const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(storagePath, file, {
      cacheControl: "3600",
      upsert: false
    });

    if (error) throw error;
    const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(storagePath);
    uploaded.push({ url: data.publicUrl, storage_path: storagePath });
  }

  return uploaded;
}

async function replaceSupabaseBookPhotos(bookId: string, userId: string, urls: string[], uploadedFiles: File[] = []) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];

  const uploaded = await uploadBookPhotoFiles(bookId, userId, uploadedFiles);
  const nextUrls = [...urls.filter(Boolean), ...uploaded.map((photo) => photo.url)];
  const uploadedByUrl = new Map(uploaded.map((photo) => [photo.url, photo.storage_path]));

  const { error: deleteError } = await supabase
    .from("book_photos")
    .delete()
    .eq("book_id", bookId)
    .eq("user_id", userId);

  if (deleteError) throw deleteError;

  if (nextUrls.length > 0) {
    const { error: insertError } = await supabase.from("book_photos").insert(
      nextUrls.map((url, index) => ({
        book_id: bookId,
        user_id: userId,
        url,
        storage_path: uploadedByUrl.get(url) ?? null,
        sort_order: index
      }))
    );

    if (insertError) throw insertError;
  }

  return nextUrls;
}

export async function fetchSupabaseBooks(userId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("books")
    .select("*, categories(name, color), statuses(name, color, sort_order), book_photos(url, sort_order)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    const fallback = await supabase
      .from("books")
      .select("*, book_photos(url, sort_order)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (fallback.error) throw fallback.error;
    return (fallback.data as SupabaseBookRow[]).map(withPhotoUrls);
  }

  return (data as SupabaseBookRow[]).map(withPhotoUrls);
}

export async function fetchSupabaseBook(id: string, userId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("books")
    .select("*, categories(name, color), statuses(name, color, sort_order), book_photos(url, sort_order)")
    .eq("id", id)
    .eq("user_id", userId)
    .single();

  if (error) {
    const fallback = await supabase
      .from("books")
      .select("*, book_photos(url, sort_order)")
      .eq("id", id)
      .eq("user_id", userId)
      .single();
    if (fallback.error) throw fallback.error;
    return withPhotoUrls(fallback.data as SupabaseBookRow);
  }

  return withPhotoUrls(data as SupabaseBookRow);
}

export async function insertSupabaseBook(book: BookDraft, userId: string, inventoryPrefix = "BK", photoFiles: File[] = []) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("books")
    .insert({
      user_id: userId,
      inventory_prefix: inventoryPrefix,
      title: book.title,
      author: book.author,
      publisher: book.publisher,
      published_year: book.published_year,
      isbn: book.isbn,
      cover_url: book.cover_url,
      category_id: book.category_id || null,
      category: book.category,
      book_type: book.book_type,
      condition: book.condition,
      cost: book.cost,
      status_id: book.status_id || null,
      status: book.status,
      listed_price: book.listed_price,
      sold_price: book.sold_price,
      notes: book.notes,
      show_public: book.show_public
    })
    .select()
    .single();

  if (error) throw error;
  const bookId = data.id as string;
  const photoUrls = await replaceSupabaseBookPhotos(bookId, userId, book.photo_urls ?? [], photoFiles);
  const coverUrl = data.cover_url || photoUrls[0] || "";

  if (coverUrl !== data.cover_url) {
    const { data: updated, error: updateError } = await supabase
      .from("books")
      .update({ cover_url: coverUrl, updated_at: new Date().toISOString() })
      .eq("id", bookId)
      .eq("user_id", userId)
      .select("*, categories(name, color), statuses(name, color, sort_order), book_photos(url, sort_order)")
      .single();

    if (updateError) throw updateError;
    return withPhotoUrls(updated as SupabaseBookRow);
  }

  return fetchSupabaseBook(bookId, userId);
}

export async function updateSupabaseBook(id: string, updates: Partial<BookDraft>, userId: string, photoFiles: File[] = []) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const nextPhotoUrls = await replaceSupabaseBookPhotos(id, userId, updates.photo_urls ?? [], photoFiles);
  const nextCoverUrl = updates.cover_url || nextPhotoUrls[0] || "";

  const { data, error } = await supabase
    .from("books")
    .update({
      title: updates.title,
      author: updates.author,
      publisher: updates.publisher,
      published_year: updates.published_year,
      isbn: updates.isbn,
      cover_url: nextCoverUrl,
      category_id: updates.category_id || null,
      category: updates.category,
      book_type: updates.book_type,
      condition: updates.condition,
      cost: updates.cost,
      status_id: updates.status_id || null,
      status: updates.status,
      listed_price: updates.listed_price,
      sold_price: updates.sold_price,
      notes: updates.notes,
      show_public: updates.show_public,
      updated_at: new Date().toISOString()
    })
    .eq("id", id)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) throw error;
  return fetchSupabaseBook((data as Book).id, userId);
}

export async function fetchPublicSupabaseBooks(shareId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("get_public_library_books", {
    share_id: shareId
  });

  if (error) throw error;
  return (data as PublicSupabaseBookRow[]).map(withPublicPhotoUrls);
}

export async function fetchPublicShareId(userId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("public_share_id")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data.public_share_id as string;
}
