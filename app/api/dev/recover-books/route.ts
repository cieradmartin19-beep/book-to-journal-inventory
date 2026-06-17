import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function json(status: number, body: Record<string, unknown>) {
  return NextResponse.json(body, { status });
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return json(404, {
      error: "This recovery tool only runs in development mode."
    });
  }

  const url = new URL(request.url);
  if (url.searchParams.get("debug") !== "true") {
    return json(404, {
      error: "This recovery tool is only available with ?debug=true in development."
    });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return json(500, {
      error: "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local to use the recovery tool."
    });
  }

  const authorization = request.headers.get("authorization") ?? "";
  const accessToken = authorization.startsWith("Bearer ") ? authorization.slice("Bearer ".length) : "";
  if (!accessToken) {
    return json(401, {
      error: "Missing current Supabase auth session."
    });
  }

  const { previousUserId } = await request.json().catch(() => ({ previousUserId: "" }));
  if (typeof previousUserId !== "string" || !uuidPattern.test(previousUserId)) {
    return json(400, {
      error: "Provide the previous anonymous user_id from Supabase Table Editor > books."
    });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const { data: userData, error: userError } = await admin.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return json(401, {
      error: userError?.message ?? "Could not verify the current signed-in user."
    });
  }

  const currentUserId = userData.user.id;
  if (previousUserId === currentUserId) {
    return json(400, {
      error: "The previous user_id already matches the current signed-in user."
    });
  }

  const { error: profileError } = await admin.from("profiles").upsert({ id: currentUserId }, { onConflict: "id" });
  if (profileError) {
    return json(500, {
      error: profileError.message
    });
  }

  const { data: previousBooks, error: previousBooksError } = await admin
    .from("books")
    .select("id, inventory_prefix, inventory_number")
    .eq("user_id", previousUserId);

  if (previousBooksError) {
    return json(500, {
      error: previousBooksError.message
    });
  }

  if (!previousBooks || previousBooks.length === 0) {
    return json(200, {
      migratedBooks: 0,
      migratedPhotos: 0,
      currentUserId,
      previousUserId,
      message: "No books were found for the previous anonymous user."
    });
  }

  const { data: currentBooks, error: currentBooksError } = await admin
    .from("books")
    .select("inventory_prefix, inventory_number")
    .eq("user_id", currentUserId);

  if (currentBooksError) {
    return json(500, {
      error: currentBooksError.message
    });
  }

  const currentInventoryIds = new Set(
    (currentBooks ?? []).map((book) => `${book.inventory_prefix}-${book.inventory_number}`)
  );
  const conflicts = previousBooks.filter((book) =>
    currentInventoryIds.has(`${book.inventory_prefix}-${book.inventory_number}`)
  );

  if (conflicts.length > 0) {
    return json(409, {
      error: `Recovery stopped because ${conflicts.length} inventory ID${conflicts.length === 1 ? "" : "s"} would collide.`
    });
  }

  const { data: updatedPhotos, error: photosError } = await admin
    .from("book_photos")
    .update({ user_id: currentUserId })
    .eq("user_id", previousUserId)
    .select("id");

  if (photosError) {
    return json(500, {
      error: photosError.message
    });
  }

  const { data: updatedBooks, error: booksError } = await admin
    .from("books")
    .update({ user_id: currentUserId, updated_at: new Date().toISOString() })
    .eq("user_id", previousUserId)
    .select("id");

  if (booksError) {
    return json(500, {
      error: booksError.message
    });
  }

  return json(200, {
    migratedBooks: updatedBooks?.length ?? 0,
    migratedPhotos: updatedPhotos?.length ?? 0,
    currentUserId,
    previousUserId,
    message: `Recovered ${updatedBooks?.length ?? 0} book${updatedBooks?.length === 1 ? "" : "s"}.`
  });
}
