ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS receipt_uploaded_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS receipt_verified_at timestamp with time zone;