import { NextResponse } from "next/server";
import { verificarAdministrador } from "@/lib/auth/administrador";

export const dynamic = "force-dynamic";

function responder(datos: unknown, estado = 200) {
  return NextResponse.json(datos, {
    status: estado,
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}

// Consultar catálogo administrativo.
export async function GET() {
  try {
    const acceso = await verificarAdministrador();

    if (!acceso.autorizado) {
      return acceso.respuesta;
    }

    const { data, count, error } = await acceso.supabase
      .from("especies")
      .select(
        "id, nombre_comun, nombre_cientifico, tipo, activa",
        { count: "exact" }
      )
      .order("nombre_comun", { ascending: true })
      .order("id", { ascending: true })
      .limit(100);

    if (error) {
      console.error(
        "Error al consultar catálogo administrativo:",
        error.message
      );

      return responder(
        { error: "No se pudo consultar el catálogo administrativo." },
        500
      );
    }

    return responder({
      total: count ?? 0,
      mostradas: data?.length ?? 0,
      especies: data ?? [],
    });
  } catch {
    console.error("Error inesperado en GET /api/admin/especies.");

    return responder(
      { error: "Ocurrió un error al consultar el catálogo." },
      500
    );
  }
}

// Registrar una especie como ficha inactiva.
export async function POST(request: Request) {
  try {
    const acceso = await verificarAdministrador();

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
      return responder(
        { error: "Debes enviar un objeto JSON." },
        400
      );
    }

    const datos = cuerpo as Record<string, unknown>;

    const camposPermitidos = new Set([
      "nombre_comun",
      "nombre_cientifico",
      "tipo",
      "descripcion",
      "habitat",
    ]);

    if (
      Object.keys(datos).some(
        (campo) => !camposPermitidos.has(campo)
      )
    ) {
      return responder(
        { error: "La solicitud contiene campos no permitidos." },
        400
      );
    }

    if (
      typeof datos.nombre_comun !== "string" ||
      typeof datos.nombre_cientifico !== "string"
    ) {
      return responder(
        { error: "Los nombres común y científico son obligatorios." },
        400
      );
    }

    const normalizarNombre = (valor: string) =>
      valor.normalize("NFC").trim().replace(/\s+/g, " ");

    const nombreComun = normalizarNombre(datos.nombre_comun);
    const nombreCientifico = normalizarNombre(
      datos.nombre_cientifico
    );

    if (
      nombreComun.length < 2 ||
      nombreComun.length > 100 ||
      nombreCientifico.length < 2 ||
      nombreCientifico.length > 100
    ) {
      return responder(
        { error: "Cada nombre debe tener entre 2 y 100 caracteres." },
        400
      );
    }

    if (datos.tipo !== "PLANTA" && datos.tipo !== "ANIMAL") {
      return responder(
        { error: "El tipo debe ser PLANTA o ANIMAL." },
        400
      );
    }

    for (const campo of ["descripcion", "habitat"] as const) {
      const valor = datos[campo];

      if (
        valor !== undefined &&
        valor !== null &&
        (typeof valor !== "string" || valor.length > 5000)
      ) {
        return responder(
          {
            error:
              `${campo} debe ser texto de hasta 5000 caracteres o null.`,
          },
          400
        );
      }
    }

    const textoOpcional = (valor: unknown): string | null =>
      typeof valor === "string" ? valor.trim() || null : null;

    const { data: especie, error } = await acceso.supabase
      .from("especies")
      .insert({
        nombre_comun: nombreComun,
        nombre_cientifico: nombreCientifico,
        tipo: datos.tipo,
        descripcion: textoOpcional(datos.descripcion),
        habitat: textoOpcional(datos.habitat),
        peligrosa: null,
        toxica: null,
        venenosa: null,
        protegida: null,
        activa: false,
        created_by: acceso.usuarioId,
      })
      .select(
        "id, nombre_comun, nombre_cientifico, tipo, descripcion, habitat, activa"
      )
      .single();

    if (error) {
      if (error.code === "23505") {
        return responder(
          {
            error:
              "Ya existe una especie con ese nombre científico.",
          },
          409
        );
      }

      console.error("Error al registrar especie:", error.code);

      return responder(
        { error: "No se pudo registrar la especie." },
        500
      );
    }

    return responder({ especie }, 201);
  } catch {
    console.error("Error inesperado en POST /api/admin/especies.");

    return responder(
      { error: "Ocurrió un error al registrar la especie." },
      500
    );
  }
}