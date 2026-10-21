-- Georgian-residency declaration for billing.
--
-- Georgian law (Organic Law on the National Bank, art. 34) lets residents of
-- Georgia be charged only in GEL; the NBG exceptions allow a foreign currency
-- for non-residents. Before the first payment an owner/admin answers the
-- required "I am a resident of Georgia (individual or legal entity)" yes/no on
-- the billing page. A yes forces GEL; a no allows GEL/EUR/USD. Who answered and
-- when is kept here (and in audit_logs) as the customer's declaration.
--
-- APPLY BEFORE the code deploys: the billing page selects these columns, and a
-- failed select sends a locked org from billing to /pipeline and back.
-- Apply on BOTH staging (quotchdymcnjlnwtjmgu) and production (fnpyfwhvgzoxgyjafbsg).
-- Safe to re-run.
--
-- No FK on billing_residency_declared_by on purpose: profiles ⇄ organizations
-- already has two FKs, and a third would add to the PostgREST embed ambiguity.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS billing_ge_resident           BOOLEAN,      -- NULL = not answered yet
  ADD COLUMN IF NOT EXISTS billing_residency_declared_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_residency_declared_by UUID;          -- profiles.id of the owner/admin who answered
