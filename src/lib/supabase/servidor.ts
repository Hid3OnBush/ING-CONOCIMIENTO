import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function crearClienteServidor() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Falta configurar Supabase en .env.local");
  }

  const almacenCookies = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return almacenCookies.getAll();
      },

      setAll(cookiesActualizadas) {
        try {
          cookiesActualizadas.forEach(({ name, value, options }) => {
            almacenCookies.set(name, value, options);
          });
        } catch {
          // Durante el renderizado de Server Components no se pueden
          // escribir cookies. El Proxy se encargará de renovarlas.
        }
      },
    },
  });
}