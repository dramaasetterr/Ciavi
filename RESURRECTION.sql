-- ============================================
-- CHIAVI FULL DATABASE RESURRECTION SCRIPT
-- Paste this ENTIRE file into the Supabase SQL Editor of your NEW project and Run.
-- Rebuilds: schema 001-007, production sync 008, storage buckets + policies.
-- ============================================

-- ============================================
-- CHIAVI: All Migrations Combined
-- Paste this entire script into Supabase SQL Editor and click "Run"
-- ============================================

-- ============================================
-- 001: Profiles
-- ============================================

create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text default '',
  avatar_url text,
  phone text,
  current_stage text not null default 'prep_your_home'
    check (current_stage in (
      'prep_your_home',
      'price_it',
      'create_listing',
      'manage_showings',
      'review_offers',
      'close_the_deal'
    )),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.update_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.update_updated_at();

-- ============================================
-- 002: Pricing Results
-- ============================================

create table public.pricing_results (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  address text not null,
  sqft integer not null,
  bedrooms integer not null,
  bathrooms integer not null,
  year_built integer not null,
  condition text not null
    check (condition in ('Excellent', 'Good', 'Fair', 'Needs Work')),
  recommended_price numeric not null,
  sell_fast_price numeric not null,
  maximize_price numeric not null,
  reasoning jsonb not null default '[]'::jsonb,
  selected_price_type text
    check (selected_price_type in ('sell_fast', 'recommended', 'maximize')),
  selected_price numeric,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.pricing_results enable row level security;

create policy "Users can read own pricing results"
  on public.pricing_results for select
  using (auth.uid() = user_id);

create policy "Users can insert own pricing results"
  on public.pricing_results for insert
  with check (auth.uid() = user_id);

create policy "Users can update own pricing results"
  on public.pricing_results for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger pricing_results_updated_at
  before update on public.pricing_results
  for each row execute function public.update_updated_at();

-- ============================================
-- 003: Listings
-- ============================================

create table public.listings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  address text not null,
  bedrooms integer,
  bathrooms numeric,
  sqft integer,
  year_built integer,
  property_type text check (property_type in ('single_family', 'condo', 'townhouse', 'multi_family')),
  hoa boolean default false,
  hoa_fee numeric,
  title text,
  description text,
  photos jsonb default '[]'::jsonb,
  price numeric,
  status text default 'draft' check (status in ('draft', 'active', 'pending', 'sold')),
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.listings enable row level security;

create policy "Users can read own listings"
  on public.listings for select
  using (auth.uid() = user_id);

create policy "Users can insert own listings"
  on public.listings for insert
  with check (auth.uid() = user_id);

create policy "Users can update own listings"
  on public.listings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own listings"
  on public.listings for delete
  using (auth.uid() = user_id);

create trigger listings_updated_at
  before update on public.listings
  for each row execute function public.update_updated_at();

-- ============================================
-- 004: Documents
-- ============================================

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  listing_id uuid references public.listings on delete set null,
  document_type text not null check (document_type in ('sellers_disclosure', 'purchase_agreement', 'counter_offer')),
  state text not null,
  title text,
  content text,
  html_content text,
  pdf_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.documents enable row level security;

create policy "Users can view own documents"
  on public.documents for select
  using (auth.uid() = user_id);

create policy "Users can insert own documents"
  on public.documents for insert
  with check (auth.uid() = user_id);

create policy "Users can update own documents"
  on public.documents for update
  using (auth.uid() = user_id);

create policy "Users can delete own documents"
  on public.documents for delete
  using (auth.uid() = user_id);

create or replace function update_documents_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger documents_updated_at
  before update on public.documents
  for each row
  execute function update_documents_updated_at();

-- ============================================
-- 005: Showings
-- ============================================

create table public.showing_availability (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  listing_id uuid references public.listings not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  is_booked boolean default false,
  created_at timestamptz default now()
);

alter table public.showing_availability enable row level security;

create policy "Users can view own availability"
  on public.showing_availability for select
  using (auth.uid() = user_id);

create policy "Users can insert own availability"
  on public.showing_availability for insert
  with check (auth.uid() = user_id);

create policy "Users can update own availability"
  on public.showing_availability for update
  using (auth.uid() = user_id);

create policy "Users can delete own availability"
  on public.showing_availability for delete
  using (auth.uid() = user_id);

create policy "Anon can view availability"
  on public.showing_availability for select
  using (true);

create table public.showings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings not null,
  seller_id uuid references auth.users not null,
  availability_id uuid references public.showing_availability not null,
  buyer_name text not null,
  buyer_email text not null,
  buyer_phone text,
  showing_date date not null,
  showing_time_start time not null,
  showing_time_end time not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'cancelled', 'completed')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.showings enable row level security;

create policy "Sellers can view own showings"
  on public.showings for select
  using (auth.uid() = seller_id);

create policy "Sellers can update own showings"
  on public.showings for update
  using (auth.uid() = seller_id);

create policy "Anon can insert showings"
  on public.showings for insert
  with check (true);

create or replace function update_showings_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger showings_updated_at
  before update on public.showings
  for each row
  execute function update_showings_updated_at();

-- ============================================
-- 006: Offers
-- ============================================

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  listing_id uuid references public.listings not null,
  offered_price numeric not null,
  financing_type text not null check (financing_type in ('cash', 'conventional', 'fha', 'va')),
  down_payment_pct numeric,
  inspection_contingency boolean default true,
  appraisal_contingency boolean default true,
  closing_date date,
  seller_concessions text,
  notes text,
  score integer,
  score_label text,
  summary text,
  red_flags jsonb default '[]'::jsonb,
  counter_suggested_price numeric,
  counter_suggested_changes jsonb default '[]'::jsonb,
  counter_reasoning text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.offers enable row level security;

create policy "Users can view own offers"
  on public.offers for select
  using (auth.uid() = user_id);

create policy "Users can insert own offers"
  on public.offers for insert
  with check (auth.uid() = user_id);

create policy "Users can update own offers"
  on public.offers for update
  using (auth.uid() = user_id);

create policy "Users can delete own offers"
  on public.offers for delete
  using (auth.uid() = user_id);

create or replace function update_offers_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger offers_updated_at
  before update on public.offers
  for each row
  execute function update_offers_updated_at();

-- ============================================
-- 007: Closing
-- ============================================

create table public.closing_checklist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  listing_id uuid references public.listings(id) not null,
  step_key text not null,
  step_label text not null,
  completed boolean not null default false,
  completed_at timestamptz,
  step_order integer not null,
  created_at timestamptz default now(),
  unique (user_id, listing_id, step_key)
);

alter table public.closing_checklist enable row level security;

create policy "Users can view own checklist"
  on public.closing_checklist for select using (auth.uid() = user_id);
create policy "Users can insert own checklist"
  on public.closing_checklist for insert with check (auth.uid() = user_id);
create policy "Users can update own checklist"
  on public.closing_checklist for update using (auth.uid() = user_id);
create policy "Users can delete own checklist"
  on public.closing_checklist for delete using (auth.uid() = user_id);

create table public.closing_calculator (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  listing_id uuid references public.listings(id) not null,
  sale_price numeric,
  attorney_fees numeric default 1500,
  title_fees numeric default 1000,
  transfer_tax_pct numeric default 1.0,
  recording_fees numeric default 250,
  seller_concessions numeric default 0,
  custom_costs jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, listing_id)
);

alter table public.closing_calculator enable row level security;

create policy "Users can view own calculator"
  on public.closing_calculator for select using (auth.uid() = user_id);
create policy "Users can insert own calculator"
  on public.closing_calculator for insert with check (auth.uid() = user_id);
create policy "Users can update own calculator"
  on public.closing_calculator for update using (auth.uid() = user_id);
create policy "Users can delete own calculator"
  on public.closing_calculator for delete using (auth.uid() = user_id);

create or replace function update_closing_calculator_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger closing_calculator_updated_at
  before update on public.closing_calculator
  for each row execute function update_closing_calculator_updated_at();

create table public.closing_guides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  listing_id uuid references public.listings(id) not null,
  state text,
  guide_content jsonb,
  created_at timestamptz default now(),
  unique (user_id, listing_id)
);

alter table public.closing_guides enable row level security;

create policy "Users can view own guides"
  on public.closing_guides for select using (auth.uid() = user_id);
create policy "Users can insert own guides"
  on public.closing_guides for insert with check (auth.uid() = user_id);
create policy "Users can update own guides"
  on public.closing_guides for update using (auth.uid() = user_id);
create policy "Users can delete own guides"
  on public.closing_guides for delete using (auth.uid() = user_id);

-- ============================================
-- Storage Buckets (run these separately if needed)
-- ============================================
-- insert into storage.buckets (id, name, public) values ('listing-photos', 'listing-photos', true);
-- insert into storage.buckets (id, name, public) values ('documents', 'documents', false);


-- ============================================================================
-- RUN THIS IN SUPABASE SQL EDITOR
-- https://supabase.com/dashboard/project/ysrfxvdxiavyxygttppf/sql
-- ============================================================================
-- This adds the new tables and columns needed for the production app.
-- Safe to run multiple times (idempotent).
-- ============================================================================

-- 1. Add 'plan' column to profiles
DO $$ BEGIN
  ALTER TABLE public.profiles
    ADD COLUMN plan text NOT NULL DEFAULT 'free'
    CHECK (plan IN ('free', 'seller_pro', 'full_service'));
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 2. Waitlist table
CREATE TABLE IF NOT EXISTS public.waitlist (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email      text NOT NULL,
  plan       text NOT NULL,
  source     text DEFAULT 'app',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON public.waitlist (email);
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "waitlist_insert_public" ON public.waitlist;
CREATE POLICY "waitlist_insert_public" ON public.waitlist FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "waitlist_select_own" ON public.waitlist;
CREATE POLICY "waitlist_select_own" ON public.waitlist FOR SELECT USING (true);

-- 3. Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id    uuid REFERENCES public.listings(id) ON DELETE CASCADE NOT NULL,
  sender_id     uuid REFERENCES auth.users ON DELETE SET NULL,
  receiver_id   uuid REFERENCES auth.users ON DELETE SET NULL,
  content       text NOT NULL DEFAULT '',
  sender_name   text,
  sender_email  text,
  read          boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON public.messages (receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages (listing_id, sender_id, receiver_id);
DROP POLICY IF EXISTS "messages_select_sender" ON public.messages;
CREATE POLICY "messages_select_sender" ON public.messages FOR SELECT USING (auth.uid() = sender_id);
DROP POLICY IF EXISTS "messages_select_receiver" ON public.messages;
CREATE POLICY "messages_select_receiver" ON public.messages FOR SELECT USING (auth.uid() = receiver_id);
DROP POLICY IF EXISTS "messages_insert_public" ON public.messages;
CREATE POLICY "messages_insert_public" ON public.messages FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "messages_update_receiver" ON public.messages;
CREATE POLICY "messages_update_receiver" ON public.messages FOR UPDATE USING (auth.uid() = receiver_id);
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN others THEN NULL;
END $$;

-- 4. Public read policy for active listings (marketplace)
DROP POLICY IF EXISTS "Anyone can view active listings" ON public.listings;
CREATE POLICY "Anyone can view active listings" ON public.listings FOR SELECT USING (status = 'active');

-- 5. Add city/state/zip/lot_size/features columns to listings
DO $$ BEGIN ALTER TABLE public.listings ADD COLUMN city text; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.listings ADD COLUMN state text; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.listings ADD COLUMN zip_code text; EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.listings ADD COLUMN lot_size numeric(12,2); EXCEPTION WHEN duplicate_column THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE public.listings ADD COLUMN features text; EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- 6. Home prep checklist table
CREATE TABLE IF NOT EXISTS public.home_prep_checklist (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES auth.users ON DELETE CASCADE NOT NULL UNIQUE,
  items      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.home_prep_checklist ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own prep checklist" ON public.home_prep_checklist;
CREATE POLICY "Users can view own prep checklist" ON public.home_prep_checklist FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can upsert own prep checklist" ON public.home_prep_checklist;
CREATE POLICY "Users can upsert own prep checklist" ON public.home_prep_checklist FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own prep checklist" ON public.home_prep_checklist;
CREATE POLICY "Users can update own prep checklist" ON public.home_prep_checklist FOR UPDATE USING (auth.uid() = user_id);

-- Done!


-- ============================================
-- STORAGE: Buckets + RLS policies
-- (appended by resurrection script builder)
-- ============================================

insert into storage.buckets (id, name, public)
values ('listing-photos', 'listing-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;

-- listing-photos: users upload/delete in their own folder, anyone can read (public bucket)
drop policy if exists "Users can upload own listing photos" on storage.objects;
create policy "Users can upload own listing photos"
  on storage.objects for insert
  with check (bucket_id = 'listing-photos' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Anyone can read listing photos" on storage.objects;
create policy "Anyone can read listing photos"
  on storage.objects for select
  using (bucket_id = 'listing-photos');

drop policy if exists "Users can delete own listing photos" on storage.objects;
create policy "Users can delete own listing photos"
  on storage.objects for delete
  using (bucket_id = 'listing-photos' and auth.uid()::text = (storage.foldername(name))[1]);

-- documents: private bucket, users manage files under {user_id}/...
drop policy if exists "Users can upload own documents" on storage.objects;
create policy "Users can upload own documents"
  on storage.objects for insert
  with check (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can read own documents" on storage.objects;
create policy "Users can read own documents"
  on storage.objects for select
  using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users can delete own documents" on storage.objects;
create policy "Users can delete own documents"
  on storage.objects for delete
  using (bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]);

