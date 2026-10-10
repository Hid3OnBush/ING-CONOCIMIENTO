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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const acceso = await verificarAdministrador();

    if (!acceso.autorizado) {
      return acceso.respuesta;
    }

    const { id } = await params;

    if (
      !/^[1-9]\d{0,18}$/.test(id) ||
      BigInt(id) > BigInt("9223372036854775807")
    ) {
      return responder({ error: "El ID no es válido." }, 400);
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
    const campos = Object.keys(datos);

    const camposPermitidos = new Set([
      "nombre_comun",
      "nombre_cientifico",
      "tipo",
      "descripcion",
      "habitat",
      "activa",
    ]);

    if (campos.length === 0) {
      return responder(
        { error: "Debes enviar al menos un campo para actualizar." },
        400
      );
    }

    if (campos.some((campo) => !camposPermitidos.has(campo))) {
      return responder(
        { error: "La solicitud contiene campos no permitidos." },
        400
      );
    }

    const cambios: Record<string, string | boolean | null> = {};

    for (const campo of ["nombre_comun", "nombre_cientifico"] as const) {
      if (!(campo in datos)) {
        continue;
      }

      const valor = datos[campo];

      if (typeof valor !== "string") {
        return responder(
          { error: `${campo} debe ser texto.` },
          400
        );
      }

      const nombre = valor
        .normalize("NFC")
        .trim()
        .replace(/\s+/g, " ");

      if (nombre.length < 2 || nombre.length > 100) {
        return responder(
          { error: `${campo} debe tener entre 2 y 100 caracteres.` },
          400
        );
      }

      cambios[campo] = nombre;
    }

    if ("tipo" in datos) {
      if (datos.tipo !== "PLANTA" && datos.tipo !== "ANIMAL") {
        return responder(
          { error: "El tipo debe ser PLANTA o ANIMAL." },
          400
        );
      }

      cambios.tipo = datos.tipo;
    }

    for (const campo of ["descripcion", "habitat"] as const) {
      if (!(campo in datos)) {
        continue;
      }

      const valor = datos[campo];

      if (valor === null) {
        cambios[campo] = null;
        continue;
      }

      if (typeof valor !== "string" || valor.length > 5000) {
        return responder(
          {
            error:
              `${campo} debe ser texto de hasta 5000 caracteres o null.`,
          },
          400
        );
      }

      cambios[campo] = valor.trim() || null;
    }

    if ("activa" in datos) {
      if (typeof datos.activa !== "boolean") {
        return responder(
          { error: "activa debe ser true o false, sin comillas." },
          400
        );
      }

      cambios.activa = datos.activa;
    }

    const { data: especie, error } = await acceso.supabase
      .from("especies")
      .update(cambios)
      .eq("id", id)
      .select(
        "id, nombre_comun, nombre_cientifico, tipo, descripcion, habitat, activa"
      )
      .maybeSingle();

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

      console.error("Error al actualizar especie:", error.code);

      return responder(
        { error: "No se pudo actualizar la especie." },
        500
      );
    }

    if (!especie) {
      return responder(
        { error: "No se encontró la especie." },
        404
      );
    }

    return responder({ especie });
  } catch {
    console.error("Error inesperado en PATCH /api/admin/especies/[id].");

    return responder(
      { error: "Ocurrió un error al actualizar la especie." },
      500
    );
  }
}