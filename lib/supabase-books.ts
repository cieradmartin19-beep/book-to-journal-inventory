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

type CategoryAssignmentRow = {
  book_id: string;
  category_id: string;
  categories: { name: string; color: string }[];
};

function isCustomFieldSchemaError(error: { code?: string; message?: string } | null) {
  return Boolean(error && (
    error.code === "42703"
    || error.code === "PGRST204"
    || /category_id|status_id|categories|statuses/i.test(error.message ?? "")
  ));
}

function readableSupabaseError(action: string, error: { message?: string; details?: string; hint?: string }) {
  const detail = [error.message, error.details, error.hint].filter(Boolean).join(" ");
  return new Error(`${action} failed. ${detail || "Supabase did not provide an error message."}`);
}

function withPhotoUrls(book: SupabaseBookRow, categoryAssignments: CategoryAssignmentRow[] = []): Book {
  const photoUrls = [...(book.book_photos ?? [])]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((photo) => photo.url)
    .filter(Boolean);
  const { book_photos, ...rest } = book;
  const status = book.statuses;
  const bookAssignments = categoryAssignments.filter((assignment) => assignment.book_id === book.id);
  const categoryIds = bookAssignments.map((assignment) => assignment.category_id).filter(Boolean);
  const categoryNames = bookAssignments
    .map((assignment) => assignment.categories?.[0]?.name)
    .filter(Boolean) as string[];
  const categoryColors = bookAssignments
    .map((assignment) => assignment.categories?.[0]?.color)
    .filter(Boolean) as string[];
  const primaryCategory = categoryNames[0] || book.category || "Uncategorized";
  const primaryColor = categoryColors[0] || book.category_color || null;

  return {
    ...rest,
    category: primaryCategory,
    category_color: primaryColor,
    category_ids: categoryIds.length > 0 ? categoryIds : book.category_id ? [book.category_id] : [],
    category_names: categoryNames.length > 0 ? categoryNames : primaryCategory !== "Uncategorized" ? [primaryCategory] : [],
    category_colors: categoryColors.length > 0 ? categoryColors : primaryColor ? [primaryColor] : [],
    status: status?.name || book.status || "Inventory",
    status_color: status?.color || book.status_color || null,
    photo_urls: photoUrls
  } as Book;
}

function withPublicPhotoUrls(book: PublicSupabaseBookRow, categoryAssignments: CategoryAssignmentRow[] = []): Book {
  const bookAssignments = categoryAssignments.filter((assignment) => assignment.book_id === book.id);
  const categoryIds = bookAssignments.map((assignment) => assignment.category_id).filter(Boolean);
  const categoryNames = bookAssignments
    .map((assignment) => assignment.categories?.[0]?.name)
    .filter(Boolean) as string[];
  const categoryColors = bookAssignments
    .map((assignment) => assignment.categories?.[0]?.color)
    .filter(Boolean) as string[];

  return {
    ...book,
    user_id: null,
    photo_urls: Array.isArray(book.photo_urls) ? book.photo_urls : [],
    cost: 0,
    sold_price: 0,
    profit: 0,
    notes: "",
    category_ids: categoryIds.length > 0 ? categoryIds : book.category_id ? [book.category_id] : [],
    category_names: categoryNames.length > 0 ? categoryNames : book.category && book.category !== "Uncategorized" ? [book.category] : [],
    category_colors: categoryColors.length > 0 ? categoryColors : book.category_color ? [book.category_color] : []
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

async function fetchBookCategoryAssignments(bookIds: string[]) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase || bookIds.length === 0) return [];

  const { data, error } = await supabase
    .from("book_categories")
    .select("book_id, category_id, categories(name, color)")
    .in("book_id", bookIds);

  if (error) throw error;
  return (data ?? []) as CategoryAssignmentRow[];
}

export async function fetchSupabaseBooks(userId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("books")
    .select("*, statuses(name, color, sort_order), book_photos(url, sort_order)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    const fallback = await supabase
      .from("books")
      .select("*, book_photos(url, sort_order)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (fallback.error) throw fallback.error;
    return (fallback.data as SupabaseBookRow[]).map((book) => withPhotoUrls(book));
  }

  const books = (data as SupabaseBookRow[]).map((book) => book);
  const assignments = await fetchBookCategoryAssignments(books.map((book) => book.id));
  return books.map((book) => withPhotoUrls(book, assignments));
}

export async function fetchSupabaseBook(id: string, userId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("books")
    .select("*, statuses(name, color, sort_order), book_photos(url, sort_order)")
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

  const assignments = await fetchBookCategoryAssignments([id]);
  return withPhotoUrls(data as SupabaseBookRow, assignments);
}

async function syncBookCategories(bookId: string, userId: string, categoryIds: string[]) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return;

  const nextIds = Array.from(new Set((categoryIds || []).filter(Boolean)));
  const { error: deleteError } = await supabase
    .from("book_categories")
    .delete()
    .eq("book_id", bookId)
    .eq("user_id", userId);

  if (deleteError) throw deleteError;

  if (nextIds.length === 0) return;

  const { error: insertError } = await supabase
    .from("book_categories")
    .insert(nextIds.map((categoryId) => ({
      book_id: bookId,
      category_id: categoryId,
      user_id: userId
    })));

  if (insertError) throw insertError;
}

export async function insertSupabaseBook(book: BookDraft, userId: string, inventoryPrefix = "BK", photoFiles: File[] = []) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const selectedCategoryIds = (book.category_ids ?? (book.category_id ? [book.category_id] : [])).filter(Boolean);
  const firstCategoryId = selectedCategoryIds[0] || book.category_id || null;
  const payload = {
      user_id: userId,
      inventory_prefix: inventoryPrefix,
      title: book.title,
      author: book.author,
      publisher: book.publisher,
      published_year: book.published_year,
      isbn: book.isbn,
      cover_url: book.cover_url,
      category_id: firstCategoryId,
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
  };
  let result = await supabase.from("books").insert(payload).select().single();

  if (isCustomFieldSchemaError(result.error)) {
    const { category_id: _categoryId, status_id: _statusId, ...legacyPayload } = payload;
    result = await supabase.from("books").insert(legacyPayload).select().single();
  }

  if (result.error) throw readableSupabaseError("Book save", result.error);
  const data = result.data;
  const bookId = data.id as string;
  try {
    await syncBookCategories(bookId, userId, selectedCategoryIds);
  } catch (categoryError) {
    await supabase.from("books").delete().eq("id", bookId).eq("user_id", userId);
    throw readableSupabaseError("Book category save", categoryError as { message?: string });
  }
  let photoUrls: string[];
  try {
    photoUrls = await replaceSupabaseBookPhotos(bookId, userId, book.photo_urls ?? [], photoFiles);
  } catch (photoError) {
    await supabase.from("books").delete().eq("id", bookId).eq("user_id", userId);
    throw readableSupabaseError("Book photo upload", photoError as { message?: string });
  }
  const coverUrl = data.cover_url || photoUrls[0] || "";

  if (coverUrl !== data.cover_url) {
    const { data: updated, error: updateError } = await supabase
      .from("books")
      .update({ cover_url: coverUrl, updated_at: new Date().toISOString() })
      .eq("id", bookId)
      .eq("user_id", userId)
      .select("*, categories(name, color), statuses(name, color, sort_order), book_photos(url, sort_order)")
      .single();

    if (updateError) throw readableSupabaseError("Cover update", updateError);
    return withPhotoUrls(updated as SupabaseBookRow);
  }

  return fetchSupabaseBook(bookId, userId);
}

export async function updateSupabaseBook(id: string, updates: Partial<BookDraft>, userId: string, photoFiles: File[] = []) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const selectedCategoryIds = (updates.category_ids ?? (updates.category_id ? [updates.category_id] : [])).filter(Boolean);
  const firstCategoryId = selectedCategoryIds[0] || updates.category_id || null;
  const nextPhotoUrls = await replaceSupabaseBookPhotos(id, userId, updates.photo_urls ?? [], photoFiles);
  const nextCoverUrl = updates.cover_url || nextPhotoUrls[0] || "";

  const payload = {
      title: updates.title,
      author: updates.author,
      publisher: updates.publisher,
      published_year: updates.published_year,
      isbn: updates.isbn,
      cover_url: nextCoverUrl,
      category_id: firstCategoryId,
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
  };
  let result = await supabase.from("books").update(payload).eq("id", id).eq("user_id", userId).select().single();

  if (isCustomFieldSchemaError(result.error)) {
    const { category_id: _categoryId, status_id: _statusId, ...legacyPayload } = payload;
    result = await supabase.from("books").update(legacyPayload).eq("id", id).eq("user_id", userId).select().single();
  }

  if (result.error) throw readableSupabaseError("Book update", result.error);
  await syncBookCategories(id, userId, selectedCategoryIds);
  return fetchSupabaseBook((result.data as Book).id, userId);
}

export async function fetchPublicSupabaseBooks(shareId: string) {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const { data, error } = await supabase.rpc("get_public_library_books", {
    share_id: shareId
  });

  if (error) throw error;
  const books = data as PublicSupabaseBookRow[];
  let assignments: CategoryAssignmentRow[] = [];
  try {
    assignments = await fetchBookCategoryAssignments(books.map((book) => book.id));
  } catch {
    // Public visitors may not read the owner-scoped join table under RLS.
  }
  return books.map((book) => withPublicPhotoUrls(book, assignments));
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
