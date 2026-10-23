-- Payment records that outlive the organization, receipts, checkout consent,
-- and a register of personal-data disclosures.
--
-- Why:
--  * Payment and card-transaction records must be kept for 5 years from the
--    transaction (merchant agreement; Privacy §7 already promised to keep
--    payment records after an account is deleted). Until now
--    payment_orders.organization_id was ON DELETE CASCADE, so the nightly
--    purge-deleted cron erased an org's whole payment history 30 days after the
--    account was closed. Rows now survive the org (organization_id → NULL) with
--    a snapshot of who paid, and the cron deletes them only after retain_until.
--  * The callback now keeps the non-sensitive transaction details Flitt sends
--    (masked card, RRN, approval code, refund) — they print on the customer's
--    receipt and are the evidence for a dispute or chargeback.
--  * Checkout records the customer's consent (Terms version, time, IP).
--  * data_disclosures: who received which personal data, when and on what
--    legal basis, kept as long as the data itself.
--
-- APPLY BEFORE the code deploys is NOT required: the new columns are only
-- written/read through graceful paths (a missing column is logged and skipped).
-- Apply on BOTH staging (quotchdymcnjlnwtjmgu) and production
-- (fnpyfwhvgzoxgyjafbsg). Safe to re-run.

-- 1) Keep payment rows when the organization is purged.
ALTER TABLE public.payment_orders
  ALTER COLUMN organization_id DROP NOT NULL;

ALTER TABLE public.payment_orders
  DROP CONSTRAINT IF EXISTS payment_orders_organization_id_fkey;
ALTER TABLE public.payment_orders
  ADD CONSTRAINT payment_orders_organization_id_fkey
  FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE SET NULL;

-- 2) Snapshot, consent, transaction details, retention.
ALTER TABLE public.payment_orders
  -- Who paid, as it was at checkout (still readable after the org is gone).
  ADD COLUMN IF NOT EXISTS org_name              TEXT,
  ADD COLUMN IF NOT EXISTS billing_country       TEXT,
  ADD COLUMN IF NOT EXISTS ge_resident           BOOLEAN,
  ADD COLUMN IF NOT EXISTS payer_email           TEXT,
  -- Consent given on the checkout confirmation.
  ADD COLUMN IF NOT EXISTS terms_version         TEXT,      -- LEGAL_UPDATED.terms at checkout
  ADD COLUMN IF NOT EXISTS consent_at            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS consent_ip            TEXT,
  -- From Flitt's signed callback (never the full card number; Flitt masks it).
  ADD COLUMN IF NOT EXISTS paid_at               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS masked_card           TEXT,
  ADD COLUMN IF NOT EXISTS card_type             TEXT,
  ADD COLUMN IF NOT EXISTS rrn                   TEXT,
  ADD COLUMN IF NOT EXISTS approval_code         TEXT,
  ADD COLUMN IF NOT EXISTS reversal_amount_minor INTEGER,
  ADD COLUMN IF NOT EXISTS reversed_at           TIMESTAMPTZ,
  -- Purged by the purge-deleted cron after this date (5 years from the last
  -- transaction on the row; the callback moves it forward).
  ADD COLUMN IF NOT EXISTS retain_until          TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 years');

CREATE INDEX IF NOT EXISTS idx_payment_orders_retain_until
  ON public.payment_orders (retain_until);

-- 3) Column grants: members keep reading their org's history (RLS policy
--    unchanged), but never the recurring card token or the consent IP.
REVOKE SELECT ON public.payment_orders FROM anon, authenticated;
GRANT SELECT (
  id, organization_id, order_id, plan_code, billing_cycle, currency, amount_minor,
  status, flitt_payment_id, created_by, created_at, updated_at,
  org_name, billing_country, ge_resident, payer_email, terms_version, consent_at,
  paid_at, masked_card, card_type, rrn, approval_code, reversal_amount_minor,
  reversed_at, retain_until
) ON public.payment_orders TO authenticated;

-- 4) Register of personal-data disclosures. Written only by server code with
--    the service role; owners/admins can read their own org's entries.
CREATE TABLE IF NOT EXISTS public.data_disclosures (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID        REFERENCES public.organizations(id) ON DELETE SET NULL,
  subject_type     TEXT        NOT NULL,   -- 'payer' | 'member' | 'candidate' | 'other'
  subject_ref      TEXT,                   -- e.g. the payer's email or a candidate id
  data_categories  TEXT[]      NOT NULL,   -- e.g. {email}
  recipient        TEXT        NOT NULL,   -- e.g. 'Flitt (TPAY LLC)'
  purpose          TEXT        NOT NULL,
  legal_basis      TEXT        NOT NULL,   -- 'contract' | 'legal_obligation' | 'consent' | 'legitimate_interest' | 'vital_interest' | 'public_task'
  related_ref      TEXT,                   -- e.g. payment order id, request reference
  disclosed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by      UUID,                   -- profiles.id, or NULL for automatic entries
  retain_until     TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '5 years'),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_data_disclosures_org
  ON public.data_disclosures (organization_id, disclosed_at DESC);
CREATE INDEX IF NOT EXISTS idx_data_disclosures_retain_until
  ON public.data_disclosures (retain_until);

ALTER TABLE public.data_disclosures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_admins_read_data_disclosures" ON public.data_disclosures;
CREATE POLICY "org_admins_read_data_disclosures"
  ON public.data_disclosures FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

REVOKE INSERT, UPDATE, DELETE ON public.data_disclosures FROM anon, authenticated;

-- Check afterwards:
--   select pg_get_constraintdef(oid) from pg_constraint where conname = 'payment_orders_organization_id_fkey';
--     → ... ON DELETE SET NULL
--   select count(*) from information_schema.column_privileges
--   where table_name = 'payment_orders' and grantee = 'authenticated'
--     and column_name in ('flitt_rectoken', 'consent_ip') and privilege_type = 'SELECT';
--     → 0
--   select policyname from pg_policies where tablename = 'data_disclosures';
