import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const dynamic = "force-dynamic";

function redirigir(request: Request, ruta: string) {
  const respuesta = NextResponse.redirect(new URL(ruta, request.url));

  respuesta.headers.set("Cache-Control", "private, no-store");
  respuesta.headers.set("Referrer-Policy", "no-referrer");

  return respuesta;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const codigo = url.searchParams.get("code");

  if (!codigo || url.searchParams.has("error")) {
    return redirigir(request, "/auth/error");
  }

  try {
    const supabase = await crearClienteServidor();

    const { error } = await supabase.auth.exchangeCodeForSession(codigo);

    if (error) {
      return redirigir(request, "/auth/error");
    }

    return redirigir(request, "/login");
  } catch {
    return redirigir(request, "/auth/error");
  }
}