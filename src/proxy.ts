import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error("Falta configurar Supabase en .env.local");
  }

  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },

      setAll(cookiesActualizadas) {
        // Entregar las cookies renovadas al código del servidor.
        cookiesActualizadas.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        respuesta = NextResponse.next({ request });

        // Entregar las mismas cookies al navegador.
        cookiesActualizadas.forEach(({ name, value, options }) => {
          respuesta.cookies.set(name, value, options);
        });
      },
    },
  });

  // Verificar el token y renovar la sesión cuando sea necesario.
  await supabase.auth.getClaims();

  // Evitar que se almacenen respuestas con cookies de sesión.
  respuesta.headers.set("Cache-Control", "private, no-store");
  respuesta.headers.set("Pragma", "no-cache");
  respuesta.headers.set("Expires", "0");

  return respuesta;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};