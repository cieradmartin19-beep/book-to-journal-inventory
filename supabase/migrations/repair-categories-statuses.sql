create extension if not exists "uuid-ossp";

alter table public.books add column if not exists category_id uuid;
alter table public.books add column if not exists status_id uuid;
alter table public.books drop constraint if exists books_status_check;

create table if not exists public.categories (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#7CC9A7',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists public.statuses (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#E9E1D2',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, name)
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

alter table public.books drop constraint if exists books_category_id_fkey;
alter table public.books
  add constraint books_category_id_fkey
  foreign key (category_id) references public.categories(id) on delete set null;

alter table public.books drop constraint if exists books_status_id_fkey;
alter table public.books
  add constraint books_status_id_fkey
  foreign key (status_id) references public.statuses(id) on delete set null;

create index if not exists books_category_id_idx on public.books(category_id);
create index if not exists books_status_id_idx on public.books(status_id);
create index if not exists categories_user_id_idx on public.categories(user_id);
create index if not exists statuses_user_id_idx on public.statuses(user_id);
create index if not exists statuses_user_sort_idx on public.statuses(user_id, sort_order);
create index if not exists books_user_id_idx on public.books(user_id);
create index if not exists books_public_idx on public.books(user_id, show_public);
create index if not exists book_photos_book_id_idx on public.book_photos(book_id);
create index if not exists book_photos_user_id_idx on public.book_photos(user_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book-photos', 'book-photos', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.profiles enable row level security;
alter table public.books enable row level security;
alter table public.book_photos enable row level security;
alter table public.categories enable row level security;
alter table public.statuses enable row level security;

drop policy if exists "Users can read their profile" on public.profiles;
create policy "Users can read their profile" on public.profiles for select using (auth.uid() = id);
drop policy if exists "Users can insert their profile" on public.profiles;
create policy "Users can insert their profile" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "Users can update their profile" on public.profiles;
create policy "Users can update their profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "Users can read their books" on public.books;
create policy "Users can read their books" on public.books for select using (auth.uid() = user_id);
drop policy if exists "Users can insert their books" on public.books;
create policy "Users can insert their books" on public.books for insert with check (auth.uid() = user_id);
drop policy if exists "Users can update their books" on public.books;
create policy "Users can update their books" on public.books for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete their books" on public.books;
create policy "Users can delete their books" on public.books for delete using (auth.uid() = user_id);

drop policy if exists "Users can read their book photos" on public.book_photos;
create policy "Users can read their book photos" on public.book_photos for select using (auth.uid() = user_id);
drop policy if exists "Users can insert their book photos" on public.book_photos;
create policy "Users can insert their book photos" on public.book_photos for insert with check (
  auth.uid() = user_id and exists (select 1 from public.books where books.id = book_id and books.user_id = auth.uid())
);
drop policy if exists "Users can update their book photos" on public.book_photos;
create policy "Users can update their book photos" on public.book_photos for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users can delete their book photos" on public.book_photos;
create policy "Users can delete their book photos" on public.book_photos for delete using (auth.uid() = user_id);

drop policy if exists "Anyone can read book photo files" on storage.objects;
create policy "Anyone can read book photo files" on storage.objects for select using (bucket_id = 'book-photos');
drop policy if exists "Users can upload their book photo files" on storage.objects;
create policy "Users can upload their book photo files" on storage.objects for insert with check (
  bucket_id = 'book-photos' and auth.uid()::text = (storage.foldername(name))[1]
);
drop policy if exists "Users can update their book photo files" on storage.objects;
create policy "Users can update their book photo files" on storage.objects for update using (
  bucket_id = 'book-photos' and auth.uid()::text = (storage.foldername(name))[1]
) with check (bucket_id = 'book-photos' and auth.uid()::text = (storage.foldername(name))[1]);
drop policy if exists "Users can delete their book photo files" on storage.objects;
create policy "Users can delete their book photo files" on storage.objects for delete using (
  bucket_id = 'book-photos' and auth.uid()::text = (storage.foldername(name))[1]
);

drop policy if exists "Users can read their categories" on public.categories;
create policy "Users can read their categories"
  on public.categories for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their categories" on public.categories;
create policy "Users can insert their categories"
  on public.categories for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their categories" on public.categories;
create policy "Users can update their categories"
  on public.categories for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their categories" on public.categories;
create policy "Users can delete their categories"
  on public.categories for delete using (auth.uid() = user_id);

drop policy if exists "Users can read their statuses" on public.statuses;
create policy "Users can read their statuses"
  on public.statuses for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their statuses" on public.statuses;
create policy "Users can insert their statuses"
  on public.statuses for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their statuses" on public.statuses;
create policy "Users can update their statuses"
  on public.statuses for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their statuses" on public.statuses;
create policy "Users can delete their statuses"
  on public.statuses for delete using (auth.uid() = user_id);

create or replace function public.ensure_default_categories(target_user_id uuid)
returns void as $$
begin
  insert into public.categories (user_id, name, color)
  values
    (target_user_id, 'Little Golden Books', '#F6C453'),
    (target_user_id, 'Children''s Books', '#7CC9A7'),
    (target_user_id, 'Disney', '#8FB7E8'),
    (target_user_id, 'Christmas', '#D95D5D'),
    (target_user_id, 'Religious', '#B99BE8'),
    (target_user_id, 'Vintage', '#D9A66A'),
    (target_user_id, 'Ready to Convert', '#F2A65A'),
    (target_user_id, 'Finished Journals', '#8CCB88'),
    (target_user_id, 'Listed', '#76B7B2'),
    (target_user_id, 'Sold', '#B7B7B7')
  on conflict (user_id, name) do nothing;

  insert into public.categories (user_id, name, color)
  select distinct books.user_id, books.category, '#E9E1D2'
  from public.books
  where books.user_id = target_user_id
    and books.category is not null
    and books.category <> ''
    and books.category <> 'Uncategorized'
  on conflict (user_id, name) do nothing;

  update public.books
  set category_id = categories.id
  from public.categories
  where books.user_id = target_user_id
    and categories.user_id = books.user_id
    and categories.name = books.category
    and books.category_id is null;
end;
$$ language plpgsql security definer set search_path = public;

create or replace function public.ensure_default_statuses(target_user_id uuid)
returns void as $$
begin
  insert into public.statuses (user_id, name, color, sort_order)
  values
    (target_user_id, 'Inventory', '#E9E1D2', 0),
    (target_user_id, 'Ready to Convert', '#F2A65A', 1),
    (target_user_id, 'In Progress', '#8FB7E8', 2),
    (target_user_id, 'Finished Journal', '#8CCB88', 3),
    (target_user_id, 'Listed', '#76B7B2', 4),
    (target_user_id, 'Sold', '#B7B7B7', 5)
  on conflict (user_id, name) do nothing;

  insert into public.statuses (user_id, name, color, sort_order)
  select distinct books.user_id, books.status, '#E9E1D2', 999
  from public.books
  where books.user_id = target_user_id
    and books.status is not null
    and books.status <> ''
  on conflict (user_id, name) do nothing;

  update public.books
  set status_id = statuses.id
  from public.statuses
  where books.user_id = target_user_id
    and statuses.user_id = books.user_id
    and statuses.name = books.status
    and books.status_id is null;
end;
$$ language plpgsql security definer set search_path = public;

insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

select public.ensure_default_categories(id) from auth.users;
select public.ensure_default_statuses(id) from auth.users;

drop function if exists public.get_public_library_books(text);
drop view if exists public.public_library_books;

create or replace view public.public_library_books as
select
  books.id,
  books.inventory_prefix,
  books.inventory_number,
  books.inventory_id,
  books.title,
  books.author,
  books.publisher,
  books.published_year,
  books.isbn,
  books.cover_url,
  books.category_id,
  coalesce(categories.name, books.category, 'Uncategorized') as category,
  categories.color as category_color,
  books.book_type,
  books.condition,
  books.status_id,
  coalesce(statuses.name, books.status, 'Inventory') as status,
  statuses.color as status_color,
  books.listed_price,
  books.show_public,
  coalesce(
    (
      select array_agg(photo.url order by photo.sort_order)
      from public.book_photos photo
      where photo.book_id = books.id
    ),
    array[]::text[]
  ) as photo_urls,
  books.created_at
from public.books
left join public.categories on categories.id = books.category_id
left join public.statuses on statuses.id = books.status_id
where books.show_public = true;

grant select on public.public_library_books to anon, authenticated;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  perform public.ensure_default_categories(new.id);
  perform public.ensure_default_statuses(new.id);
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
  category_id uuid,
  category text,
  category_color text,
  book_type text,
  condition text,
  status_id uuid,
  status text,
  status_color text,
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
    b.category_id,
    b.category,
    b.category_color,
    b.book_type,
    b.condition,
    b.status_id,
    b.status,
    b.status_color,
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
