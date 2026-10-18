import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import {
  BUCKET_IDENTIFICACIONES,
  validarArchivoImagen,
} from "@/lib/identificaciones/archivo";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function responder(datos: unknown, estado = 200) {
  return NextResponse.json(datos, {
    status: estado,
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}

async function leerJSONLimitado(request: Request): Promise<unknown> {
  if (!request.body) {
    throw new Error("CUERPO_INVALIDO");
  }

  const lector = request.body.getReader();
  const fragmentos: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await lector.read();

      if (done) {
        break;
      }

      total += value.byteLength;

      if (total > 2048) {
        await lector.cancel();
        throw new Error("CUERPO_GRANDE");
      }

      fragmentos.push(value);
    }
  } finally {
    lector.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let posicion = 0;

  for (const fragmento of fragmentos) {
    bytes.set(fragmento, posicion);
    posicion += fragmento.byteLength;
  }

  return JSON.parse(new TextDecoder().decode(bytes));
}

// Registrar una fotografía del usuario autenticado.
export async function POST(request: Request) {
  try {
    const supabase = await crearClienteServidor();

    const {
      data: { user },
      error: errorAuth,
    } = await supabase.auth.getUser();

    if (errorAuth) {
      if (!errorAuth.status || errorAuth.status >= 500) {
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

    const { data: perfil, error: errorPerfil } = await supabase
      .from("perfiles")
      .select("activo")
      .eq("id", user.id)
      .maybeSingle();

    if (errorPerfil) {
      console.error("Error al verificar perfil:", errorPerfil.code);

      return responder(
        { error: "No se pudo verificar tu cuenta." },
        500
      );
    }

    if (!perfil || !perfil.activo) {
      return responder(
        { error: "Tu cuenta no está disponible para subir fotografías." },
        403
      );
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
        { error: "Debes enviar application/json." },
        415
      );
    }

    let cuerpo: unknown;

    try {
      cuerpo = await leerJSONLimitado(request);
    } catch (error) {
      const demasiadoGrande =
        error instanceof Error && error.message === "CUERPO_GRANDE";

      return responder(
        {
          error: demasiadoGrande
            ? "La solicitud es demasiado grande."
            : "El JSON no es válido.",
        },
        demasiadoGrande ? 413 : 400
      );
    }

    if (
      typeof cuerpo !== "object" ||
      cuerpo === null ||
      Array.isArray(cuerpo)
    ) {
      return responder({ error: "Debes enviar un objeto JSON." }, 400);
    }

    const datos = cuerpo as Record<string, unknown>;

    if (
      Object.keys(datos).some(
        (campo) => campo !== "id" && campo !== "extension"
      )
    ) {
      return responder(
        { error: "La solicitud contiene campos no permitidos." },
        400
      );
    }

    if (typeof datos.id !== "string" || !UUID_V4.test(datos.id)) {
      return responder(
        { error: "El identificador de la solicitud no es válido." },
        400
      );
    }

    if (
      datos.extension !== "jpg" &&
      datos.extension !== "png" &&
      datos.extension !== "webp"
    ) {
      return responder(
        { error: "El formato de la fotografía no es válido." },
        400
      );
    }

    const id = datos.id;
    const extension = datos.extension;
    const ruta = `${user.id}/${id}.${extension}`;

    const consultarExistente = () =>
      supabase
        .from("identificaciones")
        .select("id, estado, created_at")
        .eq("id", id)
        .eq("usuario_id", user.id)
        .eq("imagen_url", ruta)
        .maybeSingle();

    const { data: existente, error: errorConsulta } =
      await consultarExistente();

    if (errorConsulta) {
      console.error(
        "Error al consultar solicitud:",
        errorConsulta.code
      );

      return responder(
        { error: "No se pudo comprobar la solicitud." },
        500
      );
    }

    if (existente) {
      return responder({ identificacion: existente });
    }

    const { data: archivo, error: errorArchivo } = await supabase.storage
      .from(BUCKET_IDENTIFICACIONES)
      .download(ruta);

    if (errorArchivo || !archivo) {
      return responder(
        {
          error: "No se pudo comprobar la fotografía. Reintenta el envío.",
        },
        422
      );
    }

    try {
      const formato = await validarArchivoImagen(archivo);

      if (formato.extension !== extension) {
        return responder(
          { error: "El formato del archivo no coincide con su extensión." },
          422
        );
      }
    } catch (error) {
      return responder(
        {
          error:
            error instanceof Error
              ? error.message
              : "La fotografía no es válida.",
        },
        422
      );
    }

    const { data: identificacion, error: errorRegistro } = await supabase
      .from("identificaciones")
      .insert({
        id,
        usuario_id: user.id,
        imagen_url: ruta,
      })
      .select("id, estado, created_at")
      .single();

    if (errorRegistro) {
      // Si otra petición registró el mismo UUID, devolver el registro
      // propio evita crear una solicitud duplicada.
      if (errorRegistro.code === "23505") {
        const { data: repetida, error: errorRepetida } =
          await consultarExistente();

        if (!errorRepetida && repetida) {
          return responder({ identificacion: repetida });
        }

        return responder(
          { error: "No se pudo utilizar ese identificador." },
          409
        );
      }

      console.error(
        "Error al registrar fotografía:",
        errorRegistro.code
      );

      return responder(
        {
          error:
            "No se pudo registrar la solicitud. Reintenta en esta pantalla.",
        },
        500
      );
    }

    return responder({ identificacion }, 201);
  } catch {
    console.error("Error inesperado en POST /api/identificaciones.");

    return responder(
      {
        error:
          "No se pudo confirmar el registro. Reintenta en esta pantalla.",
      },
      500
    );
  }
}

// Consultar únicamente el historial del usuario autenticado.
export async function GET(request: Request) {
  try {
    const supabase = await crearClienteServidor();

    const {
      data: { user },
      error: errorAuth,
    } = await supabase.auth.getUser();

    if (errorAuth) {
      if (!errorAuth.status || errorAuth.status >= 500) {
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

    const { data: perfil, error: errorPerfil } = await supabase
      .from("perfiles")
      .select("activo")
      .eq("id", user.id)
      .maybeSingle();

    if (errorPerfil) {
      console.error("Error al verificar perfil:", errorPerfil.code);

      return responder(
        { error: "No se pudo verificar tu cuenta." },
        500
      );
    }

    if (!perfil || !perfil.activo) {
      return responder(
        { error: "Tu cuenta no está disponible." },
        403
      );
    }

    const parametros = new URL(request.url).searchParams;
    const paginaTexto = parametros.get("pagina") ?? "1";

    if (!/^[1-9]\d{0,4}$/.test(paginaTexto)) {
      return responder(
        { error: "La página debe ser un número entero positivo." },
        400
      );
    }

    const pagina = Number(paginaTexto);

    if (pagina > 10000) {
      return responder(
        { error: "La página está fuera de rango." },
        400
      );
    }

    const porPagina = 12;
    const desde = (pagina - 1) * porPagina;

    const estadoFiltro = parametros.get("estado") ?? "todas";
    if (
      estadoFiltro !== "todas" &&
      estadoFiltro !== "completadas" &&
      estadoFiltro !== "pendientes"
    ) {
      return responder(
        { error: "El filtro de estado no es válido." },
        400
      );
    }

    const orden = parametros.get("orden") ?? "recientes";
    if (orden !== "recientes" && orden !== "antiguas") {
      return responder({ error: "El orden no es válido." }, 400);
    }

    const buscar = (parametros.get("buscar") ?? "")
      .normalize("NFC")
      .trim()
      .replace(/\s+/g, " ");
    if (
      buscar.length > 100 ||
      (buscar && !/^[\p{L}\p{M}\p{N} '-]+$/u.test(buscar))
    ) {
      return responder(
        { error: "La búsqueda contiene caracteres no permitidos." },
        400
      );
    }

    let consulta = supabase
      .from("identificaciones")
      .select(
        "id, estado, imagen_url, created_at, resultado_detalles",
        { count: "exact" }
      )
      .eq("usuario_id", user.id);

    if (estadoFiltro === "completadas") {
      consulta = consulta.eq("estado", "COMPLETADA");
    } else if (estadoFiltro === "pendientes") {
      consulta = consulta.in("estado", ["PENDIENTE", "PROCESANDO", "ERROR"]);
    }

    if (buscar) {
      consulta = consulta.or(
        `resultado_detalles->>nombre_comun.ilike.%${buscar}%,resultado_detalles->>nombre_cientifico.ilike.%${buscar}%`
      );
    }

    const { data, count, error } = await consulta
      .order("created_at", { ascending: orden === "antiguas" })
      .order("id", { ascending: orden === "antiguas" })
      .range(desde, desde + porPagina - 1);

    if (error) {
      console.error(
        "Error al consultar historial:",
        error.code,
        error.message
      );

      return responder(
        { error: "No se pudo consultar tu historial." },
        500
      );
    }

    const registros = data ?? [];

    // Firmar solo rutas propias que coincidan con el UUID del registro.
    const rutas = registros
      .filter((registro) =>
        ["jpg", "png", "webp"].some(
          (extension) =>
            registro.imagen_url ===
            `${user.id}/${registro.id}.${extension}`
        )
      )
      .map((registro) => registro.imagen_url);

    const enlaces = new Map<string, string>();

    if (rutas.length > 0) {
      const { data: firmadas, error: errorFirmas } =
        await supabase.storage
          .from(BUCKET_IDENTIFICACIONES)
          .createSignedUrls(rutas, 15 * 60);

      if (errorFirmas) {
        console.error("No se pudieron generar las vistas del historial.");
      } else {
        for (const firmada of firmadas ?? []) {
          if (
            !firmada.error &&
            typeof firmada.path === "string" &&
            typeof firmada.signedUrl === "string"
          ) {
            enlaces.set(firmada.path, firmada.signedUrl);
          }
        }
      }
    }

    const identificaciones = registros.map((registro) => ({
      id: registro.id,
      estado: registro.estado,
      created_at: registro.created_at,
      imagen_temporal_url: enlaces.get(registro.imagen_url) ?? null,
      nombre_comun:
        typeof registro.resultado_detalles === "object" &&
        registro.resultado_detalles !== null &&
        !Array.isArray(registro.resultado_detalles) &&
        typeof registro.resultado_detalles.nombre_comun === "string"
          ? registro.resultado_detalles.nombre_comun
          : null,
    }));

    const faltanImagenes = identificaciones.some(
      (registro) => registro.imagen_temporal_url === null
    );

    return responder({
      total: count ?? 0,
      pagina,
      por_pagina: porPagina,
      total_paginas: Math.max(
        1,
        Math.ceil((count ?? 0) / porPagina)
      ),
      identificaciones,
      aviso: faltanImagenes
        ? "Algunas fotografías no están disponibles. Intenta actualizar."
        : null,
    });
  } catch {
    console.error("Error inesperado en GET /api/identificaciones.");

    return responder(
      { error: "Ocurrió un error al consultar tu historial." },
      500
    );
  }
}