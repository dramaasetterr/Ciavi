-- Run this in the Supabase SQL Editor.
-- Adds the push-token column that push notifications need (safe to run twice).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_token text;
