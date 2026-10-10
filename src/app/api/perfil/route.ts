import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const dynamic = "force-dynamic";

const columnas =
  "id, nombre, apellido_paterno, apellido_materno, rol, activo, avatar_url";

function responder(datos: unknown, estado = 200) {
  return NextResponse.json(datos, {
    status: estado,
    headers: { "Cache-Control": "private, no-store" },
  });
}

async function verificarAcceso() {
  const supabase = await crearClienteServidor();

  const {
    data: { user },
    error: errorAuth,
  } = await supabase.auth.getUser();

  if (errorAuth) {
    if (!errorAuth.status || errorAuth.status >= 500) {
      console.error("Error al verificar sesión:", errorAuth.status);

      return {
        autorizado: false as const,
        respuesta: responder(
          { error: "No se pudo verificar la sesión. Intenta nuevamente." },
          503
        ),
      };
    }

    return {
      autorizado: false as const,
      respuesta: responder({ error: "Debes iniciar sesión." }, 401),
    };
  }

  if (!user) {
    return {
      autorizado: false as const,
      respuesta: responder({ error: "Debes iniciar sesión." }, 401),
    };
  }

  const { data: perfil, error } = await supabase
    .from("perfiles")
    .select(columnas)
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Error al consultar perfil:", error.code);

    return {
      autorizado: false as const,
      respuesta: responder(
        { error: "No se pudo consultar tu perfil." },
        500
      ),
    };
  }

  if (!perfil) {
    return {
      autorizado: false as const,
      respuesta: responder({ error: "No se encontró tu perfil." }, 404),
    };
  }

  if (!perfil.activo) {
    return {
      autorizado: false as const,
      respuesta: responder({ error: "Tu cuenta está inactiva." }, 403),
    };
  }

  return {
    autorizado: true as const,
    supabase,
    user,
    perfil,
  };
}

export async function GET() {
  try {
    const acceso = await verificarAcceso();

    if (!acceso.autorizado) {
      return acceso.respuesta;
    }

    return responder({
      perfil: {
        ...acceso.perfil,
        correo: acceso.user.email ?? null,
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

export async function PATCH(request: Request) {
  try {
    const acceso = await verificarAcceso();

    if (!acceso.autorizado) {
      return acceso.respuesta;
    }

    const origen = request.headers.get("origin");

    if (origen && origen !== new URL(request.url).origin) {
      return responder({ error: "Origen no permitido." }, 403);
    }

    const tipoContenido = request.headers
      .get("content-type")
      ?.split(";")[0]
      .trim()
      .toLowerCase();

    if (tipoContenido !== "application/json") {
      return responder(
        { error: "Debes enviar los datos como application/json." },
        415
      );
    }

    let cuerpo: unknown;

    try {
      cuerpo = await request.json();
    } catch {
      return responder({ error: "El JSON no es válido." }, 400);
    }

    if (
      typeof cuerpo !== "object" ||
      cuerpo === null ||
      Array.isArray(cuerpo)
    ) {
      return responder({ error: "Debes enviar un objeto JSON." }, 400);
    }

    const datos = cuerpo as Record<string, unknown>;
    const campos = [
      "nombre",
      "apellido_paterno",
      "apellido_materno",
    ] as const;

    const claves = Object.keys(datos);

    if (claves.length === 0) {
      return responder({ error: "No enviaste campos para actualizar." }, 400);
    }

    if (
      claves.some(
        (clave) => !campos.some((campo) => campo === clave)
      )
    ) {
      return responder(
        { error: "La solicitud contiene campos no permitidos." },
        400
      );
    }

    const cambios: {
      nombre?: string;
      apellido_paterno?: string | null;
      apellido_materno?: string | null;
    } = {};

    for (const campo of campos) {
      if (!Object.prototype.hasOwnProperty.call(datos, campo)) continue;

      const valor = datos[campo];

      if (valor === null && campo !== "nombre") {
        cambios[campo] = null;
        continue;
      }

      if (typeof valor !== "string") {
        return responder(
          { error: `${campo} debe contener texto.` },
          400
        );
      }

      const texto = valor.normalize("NFC").trim().replace(/\s+/g, " ");

      if (texto.length > 100) {
        return responder(
          { error: `${campo} no puede superar los 100 caracteres.` },
          400
        );
      }

      if (campo === "nombre") {
        if (texto.length < 2) {
          return responder(
            { error: "El nombre debe tener al menos 2 caracteres." },
            400
          );
        }

        cambios.nombre = texto;
      } else {
        cambios[campo] = texto || null;
      }
    }

    const { data: perfil, error } = await acceso.supabase
      .from("perfiles")
      .update(cambios)
      .eq("id", acceso.user.id)
      .eq("activo", true)
      .select(columnas)
      .maybeSingle();

    if (error) {
      console.error("Error al actualizar perfil:", error.code);

      return responder(
        { error: "No se pudo actualizar tu perfil." },
        500
      );
    }

    if (!perfil) {
      return responder(
        { error: "Tu perfil ya no está disponible para actualizar." },
        403
      );
    }

    return responder({
      perfil: {
        ...perfil,
        correo: acceso.user.email ?? null,
      },
    });
  } catch {
    console.error("Error inesperado en PATCH /api/perfil.");

    return responder(
      { error: "Ocurrió un error al actualizar tu perfil." },
      500
    );
  }
}