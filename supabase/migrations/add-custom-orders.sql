create extension if not exists "uuid-ossp";

create table if not exists public.custom_orders (
  id uuid primary key default uuid_generate_v4(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  book_id uuid references public.books(id) on delete set null,
  customer_name text not null,
  customer_phone text not null default '',
  customer_email text not null default '',
  preferred_contact text not null default 'Email',
  page_count text not null,
  custom_page_count integer,
  customization_options jsonb not null default '[]'::jsonb,
  customer_notes text not null default '',
  quoted_price numeric(10, 2),
  internal_notes text not null default '',
  status text not null default 'New Request',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.custom_orders add column if not exists owner_user_id uuid references auth.users(id) on delete cascade;
alter table public.custom_orders add column if not exists book_id uuid references public.books(id) on delete set null;
alter table public.custom_orders add column if not exists customer_phone text not null default '';
alter table public.custom_orders add column if not exists customer_email text not null default '';
alter table public.custom_orders add column if not exists preferred_contact text not null default 'Email';
alter table public.custom_orders add column if not exists page_count text not null default '50 pages';
alter table public.custom_orders add column if not exists custom_page_count integer;
alter table public.custom_orders add column if not exists customization_options jsonb not null default '[]'::jsonb;
alter table public.custom_orders add column if not exists customer_notes text not null default '';
alter table public.custom_orders add column if not exists quoted_price numeric(10, 2);
alter table public.custom_orders add column if not exists internal_notes text not null default '';
alter table public.custom_orders add column if not exists status text not null default 'New Request';
alter table public.custom_orders add column if not exists created_at timestamptz not null default now();
alter table public.custom_orders add column if not exists updated_at timestamptz not null default now();

alter table public.custom_orders drop constraint if exists custom_orders_preferred_contact_check;
alter table public.custom_orders add constraint custom_orders_preferred_contact_check
  check (preferred_contact in ('Phone', 'Email', 'Text'));
alter table public.custom_orders drop constraint if exists custom_orders_status_check;
alter table public.custom_orders add constraint custom_orders_status_check
  check (status in ('New Request', 'Quote Sent', 'Accepted', 'In Progress', 'Completed', 'Declined'));
alter table public.custom_orders drop constraint if exists custom_orders_page_count_check;
-- Keep legacy values valid for existing requests; the current UI offers 50, 75, 100 pages, and Planner.
alter table public.custom_orders add constraint custom_orders_page_count_check
  check (page_count in ('50 pages', '75 pages', '100 pages', 'Planner', '150 pages', 'Custom amount'));
alter table public.custom_orders drop constraint if exists custom_orders_options_array_check;
alter table public.custom_orders add constraint custom_orders_options_array_check
  check (jsonb_typeof(customization_options) = 'array');

create index if not exists custom_orders_owner_created_idx on public.custom_orders(owner_user_id, created_at desc);
create index if not exists custom_orders_owner_status_idx on public.custom_orders(owner_user_id, status);
create index if not exists custom_orders_book_id_idx on public.custom_orders(book_id);

alter table public.custom_orders enable row level security;
grant insert on public.custom_orders to anon, authenticated;
grant select, update, delete on public.custom_orders to authenticated;

drop policy if exists "Public can submit custom orders" on public.custom_orders;
create policy "Public can submit custom orders" on public.custom_orders for insert
with check (
  exists (select 1 from public.profiles where profiles.id = owner_user_id)
  and (book_id is null or exists (
    select 1 from public.books
    where books.id = book_id and books.user_id = owner_user_id and books.show_public = true
  ))
);

drop policy if exists "Owners can read custom orders" on public.custom_orders;
create policy "Owners can read custom orders" on public.custom_orders for select
using (auth.uid() = owner_user_id);
drop policy if exists "Owners can update custom orders" on public.custom_orders;
create policy "Owners can update custom orders" on public.custom_orders for update
using (auth.uid() = owner_user_id) with check (auth.uid() = owner_user_id);
drop policy if exists "Owners can delete custom orders" on public.custom_orders;
create policy "Owners can delete custom orders" on public.custom_orders for delete
using (auth.uid() = owner_user_id);

create or replace function public.get_primary_public_share_id()
returns text as $$
  select profiles.public_share_id
  from public.profiles
  where exists (
    select 1 from public.books
    where books.user_id = profiles.id and books.show_public = true
  )
  order by profiles.created_at asc
  limit 1;
$$ language sql stable security definer set search_path = public;

create or replace function public.submit_custom_order(
  share_id text,
  selected_book_id uuid,
  customer_name text,
  customer_phone text,
  customer_email text,
  preferred_contact text,
  page_count text,
  custom_page_count integer,
  customization_options jsonb,
  customer_notes text
)
returns uuid as $$
declare
  target_owner_id uuid;
  new_order_id uuid;
begin
  if trim(coalesce(customer_name, '')) = '' then raise exception 'Customer name is required.'; end if;
  if trim(coalesce(customer_email, '')) = '' and trim(coalesce(customer_phone, '')) = '' then
    raise exception 'Email or phone number is required.';
  end if;
  if jsonb_typeof(coalesce(customization_options, '[]'::jsonb)) <> 'array' then
    raise exception 'Customization options must be a list.';
  end if;

  if share_id is not null and share_id <> '' then
    select profiles.id into target_owner_id from public.profiles where profiles.public_share_id = share_id;
  else
    select profiles.id into target_owner_id
    from public.profiles
    where exists (select 1 from public.books where books.user_id = profiles.id and books.show_public = true)
    order by profiles.created_at asc limit 1;
  end if;
  if target_owner_id is null then raise exception 'This custom order page is not available.'; end if;

  if selected_book_id is not null and not exists (
    select 1 from public.books
    where books.id = selected_book_id and books.user_id = target_owner_id and books.show_public = true
  ) then raise exception 'The selected book is not available for custom orders.'; end if;

  insert into public.custom_orders (
    owner_user_id, book_id, customer_name, customer_phone, customer_email,
    preferred_contact, page_count, custom_page_count, customization_options, customer_notes
  ) values (
    target_owner_id, selected_book_id, trim(customer_name), trim(coalesce(customer_phone, '')),
    lower(trim(coalesce(customer_email, ''))), preferred_contact, page_count, custom_page_count,
    coalesce(customization_options, '[]'::jsonb), trim(coalesce(customer_notes, ''))
  ) returning id into new_order_id;
  return new_order_id;
end;
$$ language plpgsql security definer set search_path = public;

revoke all on function public.submit_custom_order(text, uuid, text, text, text, text, text, integer, jsonb, text) from public;
grant execute on function public.submit_custom_order(text, uuid, text, text, text, text, text, integer, jsonb, text) to anon, authenticated;
grant execute on function public.get_primary_public_share_id() to anon, authenticated;
