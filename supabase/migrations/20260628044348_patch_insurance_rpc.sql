CREATE OR REPLACE FUNCTION public.patch_insurance(
  p_object_id            UUID,
  p_purchase_price       NUMERIC   DEFAULT NULL,
  p_purchase_currency    TEXT      DEFAULT 'EUR',
  p_purchase_date        DATE      DEFAULT NULL,
  p_insured              BOOLEAN   DEFAULT false,
  p_insurance_type       TEXT      DEFAULT NULL,
  p_insurance_coverage   NUMERIC   DEFAULT NULL,
  p_insurance_policy_ref TEXT      DEFAULT NULL,
  p_insurance_provider   TEXT      DEFAULT NULL,
  p_insurance_expires_at DATE      DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, extensions
AS $$
DECLARE
  v_row_count INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  UPDATE public.objects
  SET
    purchase_price       = p_purchase_price,
    purchase_currency    = COALESCE(p_purchase_currency, 'EUR'),
    purchase_date        = p_purchase_date,
    insured              = COALESCE(p_insured, false),
    insurance_type       = p_insurance_type,
    insurance_coverage   = p_insurance_coverage,
    insurance_policy_ref = p_insurance_policy_ref,
    insurance_provider   = p_insurance_provider,
    insurance_expires_at = p_insurance_expires_at,
    updated_at           = now()
  WHERE id = p_object_id
    AND user_id = auth.uid();

  GET DIAGNOSTICS v_row_count = ROW_COUNT;
  RETURN v_row_count > 0;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.patch_insurance FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.patch_insurance TO authenticated;
