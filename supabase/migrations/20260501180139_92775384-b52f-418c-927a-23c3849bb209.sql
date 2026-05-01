
-- Add receipt URL to orders
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_proof_url TEXT;

-- Create receipts bucket (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-receipts', 'payment-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Users can upload to their own folder: {user_id}/...
CREATE POLICY "Users upload own receipts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'payment-receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Users can view their own receipts
CREATE POLICY "Users view own receipts"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Admins can view all receipts
CREATE POLICY "Admins view all receipts"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'payment-receipts'
  AND public.has_role(auth.uid(), 'admin')
);
