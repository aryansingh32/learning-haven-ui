-- ============================================================
-- Migration: Course Pricing
-- Purpose: Add per-course pricing columns so individual courses
--          can be purchased without a full subscription.
-- Fixes:
--   BH-010: Course monetization — per-course pricing + checkout
-- ============================================================

-- Add pricing columns to public.courses
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS price                     INTEGER      DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS currency                  TEXT         DEFAULT 'INR',
  ADD COLUMN IF NOT EXISTS is_individually_purchasable BOOLEAN    DEFAULT false;

COMMENT ON COLUMN public.courses.price IS
  'Individual purchase price in smallest currency unit (paise for INR, cents for USD). NULL = not for individual sale.';
COMMENT ON COLUMN public.courses.currency IS
  'ISO 4217 currency code for the price (e.g. INR, USD). Defaults to INR.';
COMMENT ON COLUMN public.courses.is_individually_purchasable IS
  'When true, learners can buy this course without a subscription via the course checkout flow.';

-- Index for filtering individually purchasable courses in the catalog
CREATE INDEX IF NOT EXISTS idx_courses_individually_purchasable
  ON public.courses(is_individually_purchasable)
  WHERE is_individually_purchasable = true;
