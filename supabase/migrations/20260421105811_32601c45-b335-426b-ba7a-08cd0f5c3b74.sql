
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'influencer', 'customer');
CREATE TYPE public.order_status AS ENUM ('pending', 'paid', 'failed', 'cancelled');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer to avoid RLS recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

-- ============ PRODUCTS ============
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  price_kobo BIGINT NOT NULL CHECK (price_kobo >= 0),
  colors TEXT[] NOT NULL DEFAULT '{}',
  sizes TEXT[] NOT NULL DEFAULT '{}',
  images TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- ============ REFERRAL CODES ============
CREATE TABLE public.referral_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  discount_percent INTEGER NOT NULL DEFAULT 10 CHECK (discount_percent BETWEEN 0 AND 100),
  uses_count INTEGER NOT NULL DEFAULT 0,
  max_uses INTEGER,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_referral_codes_owner ON public.referral_codes(owner_user_id);
CREATE INDEX idx_referral_codes_code ON public.referral_codes(code);

-- ============ REFERRAL USES ============
CREATE TABLE public.referral_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id UUID NOT NULL REFERENCES public.referral_codes(id) ON DELETE CASCADE,
  used_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id UUID,
  discount_applied_kobo BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.referral_uses ENABLE ROW LEVEL SECURITY;

-- ============ ORDERS ============
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status order_status NOT NULL DEFAULT 'pending',
  subtotal_kobo BIGINT NOT NULL,
  discount_kobo BIGINT NOT NULL DEFAULT 0,
  total_kobo BIGINT NOT NULL,
  referral_code_id UUID REFERENCES public.referral_codes(id) ON DELETE SET NULL,
  shipping_address JSONB NOT NULL,
  items JSONB NOT NULL,
  paystack_reference TEXT UNIQUE,
  paystack_access_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_orders_user ON public.orders(user_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_paystack_ref ON public.orders(paystack_reference);

-- ============ TIMESTAMP TRIGGER ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ NEW USER HANDLER ============
-- Creates profile, assigns role (first user = admin, rest = customer), generates referral code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INTEGER;
  new_role app_role;
  new_code TEXT;
  attempts INTEGER := 0;
BEGIN
  -- Profile
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone');

  -- First signup becomes admin
  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN new_role := 'admin'; ELSE new_role := 'customer'; END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, new_role);

  -- Auto-generate unique referral code (e.g. PPY-A3F9X2)
  LOOP
    new_code := 'PPY-' || upper(substr(md5(random()::text || NEW.id::text || clock_timestamp()::text), 1, 6));
    BEGIN
      INSERT INTO public.referral_codes (code, owner_user_id, discount_percent)
      VALUES (new_code, NEW.id, 10);
      EXIT;
    EXCEPTION WHEN unique_violation THEN
      attempts := attempts + 1;
      IF attempts > 5 THEN EXIT; END IF;
    END;
  END LOOP;

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ RLS POLICIES ============

-- profiles
CREATE POLICY "View own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- user_roles
CREATE POLICY "View own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- products: public read of active, admin full
CREATE POLICY "Anyone views active products" ON public.products FOR SELECT USING (active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage products" ON public.products FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- referral_codes
CREATE POLICY "View own codes" ON public.referral_codes FOR SELECT USING (auth.uid() = owner_user_id);
CREATE POLICY "Admins view all codes" ON public.referral_codes FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage codes" ON public.referral_codes FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- referral_uses
CREATE POLICY "Owners view their code uses" ON public.referral_uses FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.referral_codes WHERE id = code_id AND owner_user_id = auth.uid())
);
CREATE POLICY "Users view own usages" ON public.referral_uses FOR SELECT USING (auth.uid() = used_by_user_id);
CREATE POLICY "Admins view all uses" ON public.referral_uses FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- orders
CREATE POLICY "Users view own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins view all orders" ON public.orders FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update orders" ON public.orders FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
-- Note: order INSERT and status updates happen via edge functions with service role

-- ============ PUBLIC REFERRAL VALIDATION ============
-- Lets unauthenticated/checkout flow validate a code without exposing the table
CREATE OR REPLACE FUNCTION public.validate_referral_code(_code TEXT)
RETURNS TABLE(valid BOOLEAN, code_id UUID, discount_percent INTEGER, owner_user_id UUID)
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    (rc.id IS NOT NULL AND rc.active AND (rc.max_uses IS NULL OR rc.uses_count < rc.max_uses)) AS valid,
    rc.id, rc.discount_percent, rc.owner_user_id
  FROM public.referral_codes rc
  WHERE rc.code = upper(_code)
  LIMIT 1;
$$;

-- ============ SEED PRODUCT ============
INSERT INTO public.products (name, description, price_kobo, colors, sizes, images, active) VALUES (
  'BORN ABOVE Hoodie',
  'The debut limited-edition hoodie from PAPPY Clothing. Heavyweight 500gsm fleece, oversized fit, embroidered crest. Limited to 200 units worldwide.',
  4500000,
  ARRAY['Heather Charcoal', 'Oxblood Burgundy', 'Emerald'],
  ARRAY['S', 'M', 'L', 'XL'],
  ARRAY['/site/assets/pappy-hoodie.png'],
  true
);
