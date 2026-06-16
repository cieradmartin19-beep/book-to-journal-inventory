create extension if not exists "uuid-ossp";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  public_share_id text unique not null default replace(uuid_generate_v4()::text, '-', ''),
  created_at timestamptz not null default now()
);

create table if not exists public.books (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  inventory_prefix text not null default 'BK' check (inventory_prefix ~ '^[A-Z0-9]{1,8}$'),
  inventory_number integer not null,
  inventory_id text generated always as (inventory_prefix || '-' || lpad(inventory_number::text, 3, '0')) stored,
  title text not null,
  author text default '',
  publisher text default '',
  published_year text default '',
  isbn text default '',
  cover_url text default '',
  category text not null default 'Uncategorized',
  book_type text not null default 'Regular Book' check (book_type in ('Regular Book', 'Little Golden Book', 'Children''s Book', 'Vintage Book', 'Journal Project', 'Other')),
  condition text not null default 'Good' check (condition in ('Poor', 'Fair', 'Good', 'Great')),
  cost numeric(10, 2) not null default 0,
  status text not null default 'Inventory' check (status in ('Inventory', 'Ready to Convert', 'In Progress', 'Finished Journal', 'Listed', 'Sold')),
  listed_price numeric(10, 2) not null default 0,
  sold_price numeric(10, 2) not null default 0,
  profit numeric(10, 2) generated always as (sold_price - cost) stored,
  notes text default '',
  show_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, inventory_prefix, inventory_number)
);

create table if not exists public.book_photos (
  id uuid primary key default uuid_generate_v4(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  storage_path text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.books
  drop constraint if exists books_status_check;

alter table public.books
  add constraint books_status_check
  check (status in ('Inventory', 'Ready to Convert', 'In Progress', 'Finished Journal', 'Listed', 'Sold'));

create index if not exists books_user_id_idx on public.books(user_id);
create index if not exists books_user_prefix_idx on public.books(user_id, inventory_prefix);
create index if not exists books_public_idx on public.books(user_id, show_public);
create index if not exists book_photos_book_id_idx on public.book_photos(book_id);
create index if not exists book_photos_user_id_idx on public.book_photos(user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'book-photos',
  'book-photos',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.book_photos enable row level security;

drop policy if exists "Users can read their profile" on public.profiles;
create policy "Users can read their profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can insert their profile" on public.profiles;
create policy "Users can insert their profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile"
  on public.profiles for update
  using (auth.uid() = id);

drop policy if exists "Users can read their books" on public.books;
create policy "Users can read their books"
  on public.books for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their books" on public.books;
create policy "Users can insert their books"
  on public.books for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their books" on public.books;
create policy "Users can update their books"
  on public.books for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their books" on public.books;
create policy "Users can delete their books"
  on public.books for delete
  using (auth.uid() = user_id);

drop policy if exists "Users can read their book photos" on public.book_photos;
create policy "Users can read their book photos"
  on public.book_photos for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their book photos" on public.book_photos;
create policy "Users can insert their book photos"
  on public.book_photos for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their book photos" on public.book_photos;
create policy "Users can update their book photos"
  on public.book_photos for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete their book photos" on public.book_photos;
create policy "Users can delete their book photos"
  on public.book_photos for delete
  using (auth.uid() = user_id);

drop policy if exists "Anyone can read book photo files" on storage.objects;
create policy "Anyone can read book photo files"
  on storage.objects for select
  using (bucket_id = 'book-photos');

drop policy if exists "Users can upload their book photo files" on storage.objects;
create policy "Users can upload their book photo files"
  on storage.objects for insert
  with check (
    bucket_id = 'book-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update their book photo files" on storage.objects;
create policy "Users can update their book photo files"
  on storage.objects for update
  using (
    bucket_id = 'book-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete their book photo files" on storage.objects;
create policy "Users can delete their book photo files"
  on storage.objects for delete
  using (
    bucket_id = 'book-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop function if exists public.get_public_library_books(text);
drop view if exists public.public_library_books;

create or replace view public.public_library_books as
select
  id,
  inventory_prefix,
  inventory_number,
  inventory_id,
  title,
  author,
  publisher,
  published_year,
  isbn,
  cover_url,
  category,
  book_type,
  condition,
  status,
  listed_price,
  show_public,
  coalesce(
    (
      select array_agg(photo.url order by photo.sort_order)
      from public.book_photos photo
      where photo.book_id = books.id
    ),
    array[]::text[]
  ) as photo_urls,
  created_at
from public.books
where show_public = true;

grant select on public.public_library_books to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.get_public_library_books(share_id text)
returns table (
  id uuid,
  inventory_prefix text,
  inventory_number integer,
  inventory_id text,
  title text,
  author text,
  publisher text,
  published_year text,
  isbn text,
  cover_url text,
  category text,
  book_type text,
  condition text,
  status text,
  listed_price numeric,
  show_public boolean,
  photo_urls text[],
  created_at timestamptz
) as $$
begin
  return query
  select
    b.id,
    b.inventory_prefix,
    b.inventory_number,
    b.inventory_id,
    b.title,
    b.author,
    b.publisher,
    b.published_year,
    b.isbn,
    b.cover_url,
    b.category,
    b.book_type,
    b.condition,
    b.status,
    b.listed_price,
    b.show_public,
    b.photo_urls,
    b.created_at
  from public.public_library_books b
  join public.books owner_books on owner_books.id = b.id
  join public.profiles p on p.id = owner_books.user_id
  where p.public_share_id = $1
  order by b.created_at desc;
end;
$$ language plpgsql stable security definer set search_path = public;

grant execute on function public.get_public_library_books(text) to anon, authenticated;

create or replace function public.assign_next_inventory_number()
returns trigger as $$
begin
  if new.inventory_number is null then
    select coalesce(max(inventory_number), 0) + 1
    into new.inventory_number
    from public.books
    where user_id = new.user_id
      and inventory_prefix = new.inventory_prefix;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists assign_inventory_number on public.books;
create trigger assign_inventory_number
before insert on public.books
for each row execute function public.assign_next_inventory_number();
