import { createBrowserClient } from "@supabase/ssr";

export function crearClienteNavegador() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Falta configurar Supabase en .env.local");
  }

  return createBrowserClient(url, key);
}