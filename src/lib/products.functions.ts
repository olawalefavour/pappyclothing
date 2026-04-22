import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface CatalogProduct {
  id: string;
  name: string;
  description: string | null;
  price_kobo: number;
  colors: string[];
  sizes: string[];
  images: string[];
  active: boolean;
  archived: boolean;
  created_at: string;
}

export const getCatalogProducts = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select("id, name, description, price_kobo, colors, sizes, images, active, archived, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Failed to load catalog");
  }

  return (data ?? []) as CatalogProduct[];
});