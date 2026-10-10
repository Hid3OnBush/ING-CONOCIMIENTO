import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const dynamic = "force-dynamic";

function responder(datos: unknown, estado = 200) {
  return NextResponse.json(datos, {
    status: estado,
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}

export async function GET() {
  try {
    const supabase = await crearClienteServidor();

    const {
      data: { user },
      error: errorAuth,
    } = await supabase.auth.getUser();

    if (errorAuth) {
      if (!errorAuth.status || errorAuth.status >= 500) {
        console.error("Error al verificar sesión:", errorAuth.message);

        return responder(
          { error: "No se pudo verificar la sesión. Intenta nuevamente." },
          503
        );
      }

      return responder({ error: "Debes iniciar sesión." }, 401);
    }

    if (!user) {
      return responder({ error: "Debes iniciar sesión." }, 401);
    }

    const { data: perfil, error } = await supabase
      .from("perfiles")
      .select(`
        id,
        nombre,
        apellido_paterno,
        apellido_materno,
        rol,
        activo,
        avatar_url
      `)
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error al consultar perfil:", error.message);

      return responder(
        { error: "No se pudo consultar tu perfil." },
        500
      );
    }

    if (!perfil) {
      return responder({ error: "No se encontró tu perfil." }, 404);
    }

    if (!perfil.activo) {
      return responder({ error: "Tu cuenta está inactiva." }, 403);
    }

    return responder({
      perfil: {
        ...perfil,
        correo: user.email ?? null,
      },
    });
  } catch {
    console.error("Error inesperado en GET /api/perfil.");

    return responder(
      { error: "Ocurrió un error al consultar tu perfil." },
      500
    );
  }
}