-- Revoke EXECUTE on internal trigger helpers (they're invoked by triggers, not by API callers)
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;

-- has_role is used inside RLS policies and must remain callable by signed-in users,
-- but anon callers should never invoke it directly.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;

-- Remove broad public SELECT on storage.objects for product-images (prevents listing).
-- The bucket's public flag still allows direct reads of individual object URLs.
DROP POLICY IF EXISTS "Public read product images" ON storage.objects;