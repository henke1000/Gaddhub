create table if not exists public.site_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.site_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  nav_label text,
  nav_order integer not null default 0,
  in_menu boolean not null default true,
  is_home boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'published')),
  sections jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists site_pages_set_updated_at on public.site_pages;
create trigger site_pages_set_updated_at
before update on public.site_pages
for each row execute function public.set_updated_at();

insert into public.site_pages (slug, title, nav_label, nav_order, in_menu, is_home, status, sections)
values (
  'hem',
  'Hem',
  'Hem',
  0,
  true,
  true,
  'published',
  '[
    {
      "type": "hero",
      "eyebrow": "GitHub + Vercel + Supabase",
      "title": "En hemsida du kan redigera sjalv.",
      "text": "Logga in i adminpanelen for att byta text, bilder, layout, sidor och meny.",
      "image": "https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1800&q=80",
      "buttonText": "Kontakta mig",
      "buttonHref": "/?page=kontakt"
    },
    {
      "type": "cards",
      "eyebrow": "Innehall",
      "title": "Redigera direkt i admin",
      "cards": [
        { "title": "Text", "text": "Andra rubriker och brodtext." },
        { "title": "Bilder", "text": "Ladda upp eller byt bildlankar." },
        { "title": "Layout", "text": "Flytta block och byt layout." }
      ]
    }
  ]'::jsonb
)
on conflict (slug) do nothing;

insert into public.site_pages (slug, title, nav_label, nav_order, in_menu, is_home, status, sections)
values (
  'kontakt',
  'Kontakt',
  'Kontakt',
  10,
  true,
  false,
  'published',
  '[
    {
      "type": "contact",
      "eyebrow": "Kontakt",
      "title": "Hör av dig",
      "text": "Byt e-postadressen i adminpanelen.",
      "email": "din-epost@example.com"
    }
  ]'::jsonb
)
on conflict (slug) do nothing;

alter table public.site_admins enable row level security;
alter table public.site_pages enable row level security;

drop policy if exists "Admins can read admin list" on public.site_admins;
create policy "Admins can read admin list"
on public.site_admins
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Anyone can read published pages" on public.site_pages;
create policy "Anyone can read published pages"
on public.site_pages
for select
to anon, authenticated
using (status = 'published');

drop policy if exists "Admins can read all pages" on public.site_pages;
create policy "Admins can read all pages"
on public.site_pages
for select
to authenticated
using (exists (select 1 from public.site_admins where user_id = auth.uid()));

drop policy if exists "Admins can insert pages" on public.site_pages;
create policy "Admins can insert pages"
on public.site_pages
for insert
to authenticated
with check (exists (select 1 from public.site_admins where user_id = auth.uid()));

drop policy if exists "Admins can update pages" on public.site_pages;
create policy "Admins can update pages"
on public.site_pages
for update
to authenticated
using (exists (select 1 from public.site_admins where user_id = auth.uid()))
with check (exists (select 1 from public.site_admins where user_id = auth.uid()));

drop policy if exists "Admins can delete pages" on public.site_pages;
create policy "Admins can delete pages"
on public.site_pages
for delete
to authenticated
using (exists (select 1 from public.site_admins where user_id = auth.uid()));

grant usage on schema public to anon, authenticated;
grant select on public.site_pages to anon, authenticated;
grant insert, update, delete on public.site_pages to authenticated;
grant select on public.site_admins to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-assets', 'site-assets', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admins can upload site assets" on storage.objects;
create policy "Admins can upload site assets"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'site-assets'
  and exists (select 1 from public.site_admins where user_id = auth.uid())
);

drop policy if exists "Admins can update site assets" on storage.objects;
create policy "Admins can update site assets"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'site-assets'
  and exists (select 1 from public.site_admins where user_id = auth.uid())
)
with check (
  bucket_id = 'site-assets'
  and exists (select 1 from public.site_admins where user_id = auth.uid())
);

drop policy if exists "Admins can delete site assets" on storage.objects;
create policy "Admins can delete site assets"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'site-assets'
  and exists (select 1 from public.site_admins where user_id = auth.uid())
);

-- After creating your admin user in Supabase Auth, run this with that user's email:
-- insert into public.site_admins (user_id)
-- select id from auth.users where email = 'din-epost@example.com'
-- on conflict do nothing;
