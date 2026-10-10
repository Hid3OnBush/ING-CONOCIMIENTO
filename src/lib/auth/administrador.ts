import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/servidor";

function rechazar(mensaje: string, estado: number) {
  return NextResponse.json(
    { error: mensaje },
    {
      status: estado,
      headers: {
        "Cache-Control": "private, no-store",
      },
    }
  );
}

export async function verificarAdministrador() {
  const supabase = await crearClienteServidor();

  const {
    data: { user },
    error: errorAuth,
  } = await supabase.auth.getUser();

  if (errorAuth) {
    if (!errorAuth.status || errorAuth.status >= 500) {
      return {
        autorizado: false as const,
        respuesta: rechazar("No se pudo verificar la sesión.", 503),
      };
    }

    return {
      autorizado: false as const,
      respuesta: rechazar("Debes iniciar sesión.", 401),
    };
  }

  if (!user) {
    return {
      autorizado: false as const,
      respuesta: rechazar("Debes iniciar sesión.", 401),
    };
  }

  const { data: perfil, error } = await supabase
    .from("perfiles")
    .select("id, rol, activo")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Error al verificar permisos:", error.message);

    return {
      autorizado: false as const,
      respuesta: rechazar("No se pudieron verificar tus permisos.", 500),
    };
  }

  if (!perfil || !perfil.activo || perfil.rol !== "ADMIN") {
    return {
      autorizado: false as const,
      respuesta: rechazar(
        "No tienes permisos de administrador.",
        403
      ),
    };
  }

  return {
    autorizado: true as const,
    supabase,
    usuarioId: user.id,
  };
}