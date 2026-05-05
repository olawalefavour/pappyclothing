-- 1) Stop validate_referral_code from leaking owner_user_id and revoke public RPC access
CREATE OR REPLACE FUNCTION public.validate_referral_code(_code text)
RETURNS TABLE(valid boolean, code_id uuid, discount_percent integer, owner_user_id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    (rc.id IS NOT NULL AND rc.active AND (rc.max_uses IS NULL OR rc.uses_count < rc.max_uses)) AS valid,
    rc.id,
    rc.discount_percent,
    NULL::uuid AS owner_user_id
  FROM public.referral_codes rc
  WHERE rc.code = upper(_code)
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_referral_code(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.validate_referral_code(text) TO service_role;

-- 2) Explicit restrictive policies on user_roles to make admin-only mutation unambiguous
CREATE POLICY "Only admins may insert roles"
  ON public.user_roles AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins may update roles"
  ON public.user_roles AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins may delete roles"
  ON public.user_roles AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3) Explicit restrictive policy on referral_codes for inserts (only admins)
CREATE POLICY "Only admins may insert referral codes"
  ON public.referral_codes AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));