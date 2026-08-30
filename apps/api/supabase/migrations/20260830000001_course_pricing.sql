-- Coursera-style per-course pricing.
--
-- Until now a course was only reachable through a subscription plan
-- (`all_courses_access`) or an admin-granted entitlement. This adds a price to
-- the course itself so a learner can buy a single course outright, and relaxes
-- `payments.plan_id` so such a purchase does not have to be attributed to a plan.

-- 1. Pricing on the course record. All money is stored in paise, matching
--    `plans`, `payments` and `apprenticeship_programs`.
ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS price_inr INTEGER,
  ADD COLUMN IF NOT EXISTS original_price_inr INTEGER,
  ADD COLUMN IF NOT EXISTS is_free BOOLEAN NOT NULL DEFAULT false;

-- A course is either free or has a non-negative price; a struck-through
-- "original" price only makes sense when it is above the live price.
ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_price_inr_check;
ALTER TABLE public.courses
  ADD CONSTRAINT courses_price_inr_check CHECK (price_inr IS NULL OR price_inr >= 0);

ALTER TABLE public.courses DROP CONSTRAINT IF EXISTS courses_original_price_check;
ALTER TABLE public.courses
  ADD CONSTRAINT courses_original_price_check
  CHECK (original_price_inr IS NULL OR price_inr IS NULL OR original_price_inr >= price_inr);

COMMENT ON COLUMN public.courses.price_inr IS
  'One-time purchase price in paise. NULL means the course is not individually purchasable (plan-only).';
COMMENT ON COLUMN public.courses.original_price_inr IS
  'Optional struck-through reference price in paise, for discount display.';
COMMENT ON COLUMN public.courses.is_free IS
  'When true the course is openly accessible and no purchase or plan is required.';

-- Existing non-premium courses were already open to everyone, so preserve that
-- behaviour rather than silently paywalling them on deploy.
UPDATE public.courses
   SET is_free = true
 WHERE is_free = false
   AND COALESCE(is_premium, false) = false;

-- 2. A standalone course purchase is not tied to a subscription plan.
ALTER TABLE public.payments ALTER COLUMN plan_id DROP NOT NULL;

-- Every payment must still identify what was bought: either a plan, or a
-- resource recorded in metadata.
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_target_present_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_target_present_check
  CHECK (
    plan_id IS NOT NULL
    OR (
      metadata->>'resource_type' IS NOT NULL
      AND metadata->>'resource_id' IS NOT NULL
    )
  );

CREATE INDEX IF NOT EXISTS idx_courses_purchasable
  ON public.courses(is_free, price_inr)
  WHERE is_published = true;
