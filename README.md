# The Paper Curio

**Curated Books • Handmade Journals • Creative Collections**

Mobile-friendly Next.js app for searching, manually entering, cataloging, and publicly sharing books or journal projects.

## Features

- Add any book three ways: scan barcode/ISBN, scan or upload a cover photo, or type a title manually.
- ISBN-first lookup: Google Books is searched by ISBN when one is available.
- Barcode photos and live barcode scanning use `@zxing/browser`; typing or pasting ISBN is always available as the fallback.
- Cover fallback: when there is no ISBN, the app can use Google Cloud Vision OCR to detect cover title, author, and ISBN text, then search Google Books first, then Open Library, ISBNdb when configured, and Internet Archive.
- Manual entry is always available for missing barcodes, damaged barcodes, old ISBNs, and no-result books.
- Batch Add flow for uploading multiple cover photos and reviewing each result before saving.
- Custom inventory prefixes: `GB`, `BK`, `JRN`, or your own prefix.
- Workflow status tracking: `Inventory`, `Ready to Convert`, `In Progress`, `Finished Journal`, `Listed`, and `Sold`.
- Real Supabase Auth login with email/password accounts and optional Google OAuth.
- Editable fields for inventory ID, title, author, publisher, year, ISBN, cover photo, multi-photo gallery, custom category, condition, status, prices, profit, notes, and public visibility.
- Multiple photos per book, stored in Supabase Storage when Supabase is configured.
- Dashboard totals for books, each workflow status, and profit.
- Search, genre/category filter, status filter, cover grid, detail editor, public share page, and QR code.
- Local browser-storage fallback when Supabase is not configured.

## Local Setup

```bash
npm install
npm run dev
```

Open the local URL printed by Next.js, usually `http://localhost:3000` or the next available port such as `http://localhost:3001`.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the services you want to enable.

```bash
cp .env.example .env.local
```

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` enable Supabase persistence. `GOOGLE_CLOUD_VISION_API_KEY` powers server-side cover OCR. `GOOGLE_BOOKS_API_KEY` is optional for book detail lookup. `ISBNDB_API_KEY` is optional and is used only as a fallback when Google Books has no match and an ISBN exists.

Optional local debugging: open the dashboard with `?debug=true`, for example `http://localhost:3000/?debug=true`.

The Supabase debug panel and OCR debug details are available only in development mode and only when `?debug=true` is present. They are not shown in production.

Optional one-time local recovery:

```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Use this only in `.env.local` for the temporary development recovery tool. Never add it to Vercel or expose it in any `NEXT_PUBLIC_` variable.

## Supabase

The app uses Supabase Auth user accounts plus Row Level Security. Each signed-in user sees only their own books, photos, categories, and statuses. Without Supabase env vars, local development falls back to browser `localStorage`.

### Required Environment Variables

Add these to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

Do not put a service role or secret key in `.env.local` for this app. This is a browser client, and Supabase secrets must stay server-side only.

### Where To Find Them In Supabase

1. Open your Supabase project dashboard.
2. Go to **Project Settings > API Keys**.
3. Copy the project URL into `NEXT_PUBLIC_SUPABASE_URL`.
4. Copy a client-safe key into `NEXT_PUBLIC_SUPABASE_ANON_KEY`:
   - Preferred for newer projects: a **Publishable key** such as `sb_publishable_...`.
   - Legacy projects: the **anon public** key.

### Enable Supabase Auth

The app uses email/password accounts by default and can also use Google OAuth.

1. In Supabase, go to **Authentication > Sign In / Providers**.
2. Open **Email** and make sure email sign-ins are enabled.
3. Make sure **Email + Password** sign-ins are enabled.
4. Choose whether to require email confirmation:
   - Easiest for Jess while testing: turn **Confirm email** off.
   - More secure: keep **Confirm email** on. Jess must confirm her email before signing in.
5. Optional: open **Google**, enable it, and add the Google OAuth client ID/secret from Google Cloud.
6. Save the settings.

### Auth Redirect URLs

In Supabase, go to **Authentication > URL Configuration**.

For local development:

- Site URL: `http://localhost:3000`
- Redirect URLs:
  - `http://localhost:3000`
  - `http://localhost:3001`
  - `http://localhost:3002`

For Vercel production, add:

- Site URL: `https://your-app.vercel.app`
- Redirect URLs:
  - `https://your-app.vercel.app`
  - any custom production domain, such as `https://yourdomain.com`
  - optional preview wildcard: `https://*.vercel.app`

### Schema Verification

`supabase/schema.sql` creates everything the current app needs:

- `public.profiles`: one row per Supabase Auth user, with `public_share_id` for QR/share links.
- `public.books`: private inventory rows scoped by `user_id`.
- `public.book_photos`: ordered gallery image URLs scoped by `user_id` and `book_id`.
- `storage.buckets`: creates/updates a public `book-photos` bucket for gallery uploads.
- RLS policies for profile and book read/insert/update/delete.
- RLS policies for book photo rows and Storage objects.
- `public.public_library_books`: public-safe view that hides cost, sold price, profit, and notes.
- `public.get_public_library_books(share_id text)`: RPC used by `/share/[shareId]`.
- `public.assign_next_inventory_number()`: trigger function that assigns the next number per user and prefix.
- `public.handle_new_user()`: trigger function that creates profile rows for new auth users.

### Run The Schema In Supabase SQL Editor

1. In Supabase, open your project.
2. Go to **SQL Editor**.
3. Create a new query.
4. Open `supabase/schema.sql` in this repo and copy the full file.
5. Paste it into the Supabase SQL Editor.
6. Click **Run**.
7. Confirm the query completes without errors.

For a brand-new project, run the full `supabase/schema.sql`. For the existing production project, run
`supabase/migrations/repair-categories-statuses.sql` instead. The repair migration preserves existing books,
adds missing category/status objects, seeds each existing user, restores RLS and Storage policies, and recreates
the public library view/RPC. It is safe to run more than once.

### Verify Supabase Save/Load

1. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`.
2. Restart the dev server after editing env vars:

```bash
npm run dev
```

3. Open `/login`.
4. Choose **Create account**, enter Jess's email and password, and create the account.
5. If Supabase email confirmation is enabled, confirm Jess's email from her inbox.
6. Sign in and confirm the header says **Signed in as Jess**.
7. Add a test book from `/add`.
8. Confirm the app redirects to `/library` and shows **Book saved successfully.**
9. In Supabase, go to **Table Editor > books** and confirm a new row appears with Jess's `auth.users.id` in `user_id`.
10. Refresh `/library`. The book should still appear, loaded from Supabase.
11. Edit the book title or status, save it, then refresh again. The change should persist.
12. Mark the book **Show on public library**, then open the share page from the QR/share panel and confirm the public card appears without private cost/profit fields.

### Public Share Page

The dashboard QR code and share controls use `window.location.origin`, so links work on any localhost port and on Vercel. The `/share/[shareId]` route calls the Supabase RPC `get_public_library_books(share_id text)` and only shows rows where `books.show_public = true`.

If you update an existing Supabase project, rerun `supabase/schema.sql` in SQL Editor so the public view/RPC are recreated without private fields such as `user_id`, cost, profit, sold price, or notes.

### Migrating Old Anonymous Inventory

Older versions of this app used Supabase anonymous users. Those books are safe, but RLS hides them from Jess's new email/Google login because their `books.user_id` belongs to the old anonymous auth user.

Use the one-time development recovery tool below to assign those existing rows to Jess's signed-in account. It updates `books.user_id` and related `book_photos.user_id`; it does not delete or duplicate books.

### One-Time Development Recovery Tool

If saved books belong to an older anonymous user, use the temporary recovery tool:

1. In Supabase, go to **Project Settings > API Keys**.
2. Copy the **service_role** key.
3. Add it to local `.env.local` only:

```bash
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

4. Restart the dev server with `npm run dev`.
5. Sign in as Jess in the app.
6. Open the dashboard with `?debug=true`, for example `http://localhost:3000/?debug=true`.
7. In the **Supabase debug** panel, paste the old anonymous `books.user_id` from **Table Editor > books**.
8. Click **Recover Existing Books**.
9. Confirm the message shows how many books and photos were migrated to Jess's signed-in account.
10. Remove `SUPABASE_SERVICE_ROLE_KEY` from `.env.local` and restart the dev server to disable the admin utility.

The recovery endpoint only runs in development mode. It verifies the current Supabase session, uses the service role key server-side, updates `book_photos` and `books`, checks inventory ID collisions, and does not disable RLS or duplicate books.

## Vercel Deployment

This app is ready for Vercel as a standard Next.js project. Vercel will install dependencies with `npm install`, build with `npm run build`, and serve the app with the Next.js runtime.

### Required Vercel Environment Variables

Set these in **Vercel Project > Settings > Environment Variables** for Production, Preview, and Development as needed:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

Recommended for full scan/lookup behavior:

```bash
GOOGLE_CLOUD_VISION_API_KEY=your-google-cloud-vision-api-key
GOOGLE_BOOKS_API_KEY=your-google-books-api-key
ISBNDB_API_KEY=your-isbndb-api-key
```

Do not add Supabase service role keys to Vercel for this browser app.

### Production OCR Setup

Cover OCR runs in the server route `app/api/identify/route.ts`, so the Google Vision key stays server-side and must be added to Vercel without a `NEXT_PUBLIC_` prefix.

1. In Google Cloud, create or select a project.
2. Enable **Cloud Vision API** for that project.
3. Create an API key in **APIs & Services > Credentials**.
4. Restrict the key to **Cloud Vision API** if you use API restrictions.
5. In Vercel, open **Project > Settings > Environment Variables**.
6. Add `GOOGLE_CLOUD_VISION_API_KEY` for **Production**. Add it for **Preview** and **Development** too if you test those deployments.
7. Redeploy the Vercel project after adding or changing the variable.
8. Test from `/add` by using **Scan book cover > Upload Photo** or **Use Camera**. With local development `?debug=true`, the review screen shows OCR source, confidence, detected title, author, ISBN, and detected text lines.

When OCR succeeds, the app fills title, author, and ISBN when detected, searches Google Books by ISBN first, and then by title/author. When OCR fails or returns no useful match, manual entry stays available.

### Production Supabase Setup

Before deploying, verify these Supabase settings:

1. For this existing production database, run `supabase/migrations/repair-categories-statuses.sql` in Supabase SQL Editor. Use `supabase/schema.sql` only for a fresh project.
2. Enable **Authentication > Sign In / Providers > Email** for email/password accounts.
3. Optional: enable **Authentication > Sign In / Providers > Google**.
4. Confirm **Table Editor > books** and **Table Editor > profiles** exist.
5. Confirm **Storage > book-photos** exists and is public.
6. In **Authentication > URL Configuration**, set **Site URL** to your production Vercel URL, for example `https://your-app.vercel.app`.
7. Add your production URL to **Redirect URLs** too. Add any custom domain and any preview URL/wildcard you will use.
8. After deployment, sign in as Jess, add a test book, and confirm the row appears in **Table Editor > books** with Jess's `auth.users.id`.

Important: production has a different browser origin than localhost, but Jess's email/Google login will use the same Supabase Auth user across devices after the redirect URLs are configured.

### Camera And Photo Uploads In Production

Vercel serves the app over HTTPS, which is required for browser camera APIs such as `navigator.mediaDevices.getUserMedia()`. The app keeps file upload as a fallback for devices or browsers that do not expose camera access.

Photo uploads use the Supabase Storage bucket and policies from `supabase/schema.sql`. Before production testing, confirm **Storage > book-photos** exists, is public, and has the RLS policies from the schema.

### Deployment Checklist

- `npm run build` passes locally.
- `.env.local` contains the same required values you will add to Vercel.
- `.env.local` is not committed or uploaded.
- Supabase schema has been run successfully.
- Email/password sign-ins are enabled in Supabase.
- Jess has created and confirmed her account if email confirmation is required.
- Google OAuth is configured in Supabase if you want the Google login button to work.
- Supabase Storage bucket `book-photos` exists.
- Vercel environment variables are set for Production.
- Production Supabase Site URL and Redirect URL include the Vercel domain.
- First production save/load test succeeds.
- Camera scan opens on an HTTPS Vercel URL, or upload photo fallback works.
- Book photo upload saves into Supabase Storage and reloads on the detail page.
- Confirm the Supabase debug panel is not visible on the production dashboard.

### Connect And Deploy With Vercel

1. Push this project to a Git provider supported by Vercel, such as GitHub.
2. Open [Vercel](https://vercel.com) and choose **Add New > Project**.
3. Import the repository.
4. Keep the framework preset as **Next.js**.
5. Keep the default commands:
   - Build Command: `npm run build`
   - Install Command: `npm install`
   - Output Directory: leave blank
6. Add the environment variables listed above.
7. Click **Deploy**.
8. When the deployment finishes, open the generated `.vercel.app` URL.
9. Sign in, add a test book, refresh the dashboard, and confirm Supabase still shows **Supabase connected** and the book reloads.

### Deploy With Vercel CLI

If you prefer the CLI:

```bash
npm install -g vercel
vercel login
vercel
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY production
vercel env add GOOGLE_CLOUD_VISION_API_KEY production
vercel env add GOOGLE_BOOKS_API_KEY production
vercel --prod
```

Run `vercel env pull .env.local` later if you want Vercel-managed env vars copied back into local development.

## Where To Add Real Vision APIs

- `app/api/identify/route.ts`: Google Cloud Vision OCR logic lives here.
- `app/api/google-books/route.ts`: searches Google Books by ISBN first when available, otherwise by title and author.

Google Lens is intentionally not used because it does not provide a simple public API for this use case.
