ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "Anyone views active products" ON public.products;

CREATE POLICY "Anyone views catalog products"
ON public.products
FOR SELECT
USING (active = true OR archived = true OR public.has_role(auth.uid(), 'admin'));