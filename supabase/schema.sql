-- E-12 members platform: initial schema
-- Applied 2026-07-29 to project thgmytymflaikcorjvop (e12, ATP's Org)

-- ============ tables ============

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('member','admin')),
  created_at timestamptz not null default now()
);

create table public.admin_emails (
  email text primary key,
  added_at timestamptz not null default now()
);

create table public.trainings (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  badge text not null default 'members' check (badge in ('free','members')),
  image_url text not null default '',
  video_url text not null default '',
  sort int not null default 100,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.site_links (
  key text primary key,
  label text not null default '',
  url text not null default '',
  updated_at timestamptz not null default now()
);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  email text not null default '',
  phone text not null default '',
  source text not null default 'membership' check (source in ('membership', 'signup', 'contact')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.admin_emails enable row level security;
alter table public.trainings enable row level security;
alter table public.site_links enable row level security;
alter table public.leads enable row level security;

-- ============ helpers ============

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    coalesce(new.email, ''),
    case when exists (select 1 from public.admin_emails where lower(email) = lower(coalesce(new.email, '')))
      then 'admin' else 'member' end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ policies ============

create policy "profiles: own row or admin reads" on public.profiles
  for select using (id = auth.uid() or public.is_admin());
create policy "profiles: admin updates roles" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());
create policy "profiles: admin deletes" on public.profiles
  for delete using (public.is_admin());

create policy "admin_emails: admin all" on public.admin_emails
  for all using (public.is_admin()) with check (public.is_admin());

create policy "trainings: published or admin" on public.trainings
  for select using (published or public.is_admin());
create policy "trainings: admin insert" on public.trainings
  for insert with check (public.is_admin());
create policy "trainings: admin update" on public.trainings
  for update using (public.is_admin()) with check (public.is_admin());
create policy "trainings: admin delete" on public.trainings
  for delete using (public.is_admin());

create policy "site_links: public read" on public.site_links
  for select using (true);
create policy "site_links: admin write" on public.site_links
  for insert with check (public.is_admin());
create policy "site_links: admin update" on public.site_links
  for update using (public.is_admin()) with check (public.is_admin());
create policy "site_links: admin delete" on public.site_links
  for delete using (public.is_admin());

create policy "leads: anyone can submit" on public.leads
  for insert with check (true);
create policy "leads: admin reads" on public.leads
  for select using (public.is_admin());
create policy "leads: admin deletes" on public.leads
  for delete using (public.is_admin());

-- ============ storage ============

insert into storage.buckets (id, name, public) values
  ('media', 'media', true),
  ('videos', 'videos', false);

create policy "media: public read" on storage.objects
  for select using (bucket_id = 'media');
create policy "media: admin insert" on storage.objects
  for insert with check (bucket_id = 'media' and public.is_admin());
create policy "media: admin update" on storage.objects
  for update using (bucket_id = 'media' and public.is_admin());
create policy "media: admin delete" on storage.objects
  for delete using (bucket_id = 'media' and public.is_admin());

create policy "videos: members read" on storage.objects
  for select using (bucket_id = 'videos' and auth.role() = 'authenticated');
create policy "videos: admin insert" on storage.objects
  for insert with check (bucket_id = 'videos' and public.is_admin());
create policy "videos: admin update" on storage.objects
  for update using (bucket_id = 'videos' and public.is_admin());
create policy "videos: admin delete" on storage.objects
  for delete using (bucket_id = 'videos' and public.is_admin());

-- ============ seeds ============

insert into public.admin_emails (email) values ('aperez@atpconsultancy.com');

insert into public.site_links (key, label, url) values
  ('travelPartner',  'Traverex',            ''),
  ('wealthPartner',  'Wealth partner',      ''),
  ('membership',     'Membership signup',   ''),
  ('academyPreview', 'Free preview video',  ''),
  ('contact',        'Contact',             '');

insert into public.trainings (title, badge, image_url, sort) values
  ('Travel Points and Miles 101',      'free',    'img/academy-travel.jpg',    10),
  ('Affiliate Marketing Foundations',  'members', 'img/academy-affiliate.jpg', 20),
  ('Bitcoin, Plainly',                 'members', 'img/academy-bitcoin.jpg',   30),
  ('Booking Business Class for Less',  'members', 'img/academy-luxe.jpg',      40);
