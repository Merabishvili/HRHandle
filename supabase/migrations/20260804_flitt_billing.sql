-- Flitt payment billing — multi-currency (GEL/EUR/USD), auto-recurring.
--
-- APPLY ON BOTH PROJECTS: staging (quotchdymcnjlnwtjmgu) then production
-- (fnpyfwhvgzoxgyjafbsg). Idempotent — safe to re-run.
--
-- The `subscriptions` table already carries the plan/period/payment_provider
-- columns this integration writes to; nothing changes there. This migration
-- adds (1) a per-org currency override and (2) the payment_orders ledger that
-- correlates Flitt callbacks to an org + plan.

-- 1) Manual billing-currency override. NULL → currency is derived from
--    organizations.billing_country (GE→GEL, EU/EEA→EUR, else→USD). An owner can
--    set this on the billing page to force a currency.
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS billing_currency TEXT;

-- 2) Payment orders — one row per checkout attempt. Stores the intended
--    amount/currency so the callback can reject tampered results, enforces
--    idempotency via the UNIQUE order_id, and provides an audit trail.
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  order_id           TEXT        NOT NULL UNIQUE,
  plan_code          TEXT        NOT NULL,               -- 'individual' | 'organization'
  billing_cycle      TEXT        NOT NULL,               -- 'monthly' | 'annual'
  currency           TEXT        NOT NULL,               -- 'GEL' | 'EUR' | 'USD'
  amount_minor       INTEGER     NOT NULL,               -- tetri / cents
  status             TEXT        NOT NULL DEFAULT 'pending', -- pending|approved|declined|expired|processing|reversed
  flitt_payment_id   TEXT,
  flitt_rectoken     TEXT,                               -- recurring token, once tokenized
  created_by         UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_org
  ON public.payment_orders (organization_id, created_at DESC);

ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

-- Org members may READ their org's payment history. There is deliberately NO
-- insert/update policy: writes happen only through our server code using the
-- service-role admin client (checkout action + callback route), which bypasses
-- RLS. This keeps clients from ever forging an order or flipping its status.
DROP POLICY IF EXISTS "org_members_read_payment_orders" ON public.payment_orders;
CREATE POLICY "org_members_read_payment_orders"
  ON public.payment_orders FOR SELECT
  USING (organization_id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));
