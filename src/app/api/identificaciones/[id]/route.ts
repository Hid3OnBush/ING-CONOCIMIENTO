import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { BUCKET_IDENTIFICACIONES } from "@/lib/identificaciones/archivo";
import type { FichaEspecieReconocida } from "@/lib/identificaciones/reconocimiento";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Contexto = {
  params: Promise<{ id: string }>;
};

function responder(datos: unknown, estado = 200) {
  return NextResponse.json(datos, {
    status: estado,
    headers: { "Cache-Control": "private, no-store" },
  });
}

async function obtenerUsuarioActivo() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
    error: errorAuth,
  } = await supabase.auth.getUser();

  if (errorAuth) {
    if (!errorAuth.status || errorAuth.status >= 500) {
      return {
        supabase,
        usuario: null,
        respuesta: responder(
          { error: "No se pudo verificar la sesión. Intenta nuevamente." },
          503
        ),
      };
    }
    return {
      supabase,
      usuario: null,
      respuesta: responder({ error: "Debes iniciar sesión." }, 401),
    };
  }

  if (!user) {
    return {
      supabase,
      usuario: null,
      respuesta: responder({ error: "Debes iniciar sesión." }, 401),
    };
  }

  const { data: perfil, error: errorPerfil } = await supabase
    .from("perfiles")
    .select("activo")
    .eq("id", user.id)
    .maybeSingle();

  if (errorPerfil) {
    console.error("No se pudo verificar el perfil:", errorPerfil.code);
    return {
      supabase,
      usuario: null,
      respuesta: responder({ error: "No se pudo verificar tu cuenta." }, 500),
    };
  }

  if (!perfil?.activo) {
    return {
      supabase,
      usuario: null,
      respuesta: responder({ error: "Tu cuenta no está disponible." }, 403),
    };
  }

  return { supabase, usuario: user, respuesta: null };
}

function crearFichaDesdeCatalogo(
  especie: Record<string, unknown>
): FichaEspecieReconocida {
  const texto = (valor: unknown) =>
    typeof valor === "string" ? valor : null;
  const booleano = (valor: unknown) =>
    typeof valor === "boolean" ? valor : null;

  return {
    id:
      typeof especie.id === "number" || typeof especie.id === "string"
        ? String(especie.id)
        : null,
    taxon_id: null,
    nombre_comun: texto(especie.nombre_comun) ?? "Nombre no disponible",
    nombre_cientifico:
      texto(especie.nombre_cientifico) ?? "Nombre no disponible",
    tipo:
      especie.tipo === "PLANTA" || especie.tipo === "ANIMAL"
        ? especie.tipo
        : null,
    descripcion: texto(especie.descripcion),
    habitat: texto(especie.habitat),
    distribucion: texto(especie.distribucion),
    alimentacion: texto(especie.alimentacion),
    temporada: texto(especie.temporada),
    caracteristicas: texto(especie.caracteristicas),
    nivel_riesgo: texto(especie.nivel_riesgo),
    estado_conservacion: texto(especie.estado_conservacion),
    peligrosa: booleano(especie.peligrosa),
    toxica: booleano(especie.toxica),
    venenosa: booleano(especie.venenosa),
    protegida: booleano(especie.protegida),
    imagen_url: null,
    taxonomia: {
      reino: texto(especie.reino),
      filo_division: texto(especie.filo_division),
      clase: texto(especie.clase),
      orden: texto(especie.orden_taxonomico),
      familia: texto(especie.familia),
      genero: texto(especie.genero),
      especie: texto(especie.especie_taxonomica),
    },
  };
}

function esFichaGuardada(valor: unknown): valor is FichaEspecieReconocida {
  if (
    typeof valor !== "object" ||
    valor === null ||
    Array.isArray(valor)
  ) {
    return false;
  }

  const ficha = valor as Record<string, unknown>;
  return (
    typeof ficha.nombre_comun === "string" &&
    typeof ficha.nombre_cientifico === "string" &&
    typeof ficha.taxonomia === "object" &&
    ficha.taxonomia !== null
  );
}

async function restaurarFotografia(
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>,
  ruta: string,
  archivo: Blob | null
) {
  if (!archivo) return;

  const extension = ruta.split(".").pop()?.toLowerCase();
  const tipo =
    archivo.type ||
    (extension === "png"
      ? "image/png"
      : extension === "webp"
        ? "image/webp"
        : "image/jpeg");
  const { error } = await supabase.storage
    .from(BUCKET_IDENTIFICACIONES)
    .upload(ruta, archivo, { contentType: tipo, upsert: true });

  if (error) {
    console.error("No se pudo restaurar la fotografía durante la compensación.");
  }
}

export async function GET(_request: Request, { params }: Contexto) {
  const { id } = await params;

  if (!UUID_V4.test(id)) {
    return responder({ error: "El ID de identificación no es válido." }, 400);
  }

  try {
    const acceso = await obtenerUsuarioActivo();
    if (!acceso.usuario) return acceso.respuesta;

    const { data: registro, error } = await acceso.supabase
      .from("identificaciones")
      .select(
        "id, usuario_id, estado, imagen_url, created_at, confianza, mensaje_resultado, error_mensaje, especie_resultado_id, resultado_detalles"
      )
      .eq("id", id)
      .eq("usuario_id", acceso.usuario.id)
      .maybeSingle();

    if (error) {
      console.error("No se pudo consultar la identificación:", error.code);
      return responder(
        { error: "No se pudo consultar el detalle de la identificación." },
        500
      );
    }
    if (!registro) {
      return responder({ error: "No se encontró la identificación." }, 404);
    }

    const rutasValidas = ["jpg", "png", "webp"].some(
      (extension) =>
        registro.imagen_url ===
        `${acceso.usuario.id}/${registro.id}.${extension}`
    );
    let imagenTemporalUrl: string | null = null;

    if (rutasValidas) {
      const { data: firmada, error: errorFirma } = await acceso.supabase.storage
        .from(BUCKET_IDENTIFICACIONES)
        .createSignedUrl(registro.imagen_url, 15 * 60);

      if (errorFirma) {
        console.error("No se pudo firmar la fotografía del detalle.");
      } else {
        imagenTemporalUrl = firmada.signedUrl;
      }
    }

    let resultadoDetalles = esFichaGuardada(registro.resultado_detalles)
      ? registro.resultado_detalles
      : null;

    if (!resultadoDetalles && registro.especie_resultado_id !== null) {
      const { data: especie, error: errorEspecie } = await acceso.supabase
        .from("especies")
        .select(
          "id, nombre_comun, nombre_cientifico, tipo, descripcion, habitat, distribucion, alimentacion, temporada, caracteristicas, nivel_riesgo, estado_conservacion, peligrosa, toxica, venenosa, protegida, reino, filo_division, clase, orden_taxonomico, familia, genero, especie_taxonomica"
        )
        .eq("id", registro.especie_resultado_id)
        .maybeSingle();

      if (errorEspecie) {
        console.error("No se pudo cargar la ficha local:", errorEspecie.code);
      } else if (especie) {
        resultadoDetalles = crearFichaDesdeCatalogo(especie);
      }
    }

    return responder({
      identificacion: {
        id: registro.id,
        estado: registro.estado,
        created_at: registro.created_at,
        confianza: registro.confianza,
        mensaje_resultado: registro.mensaje_resultado,
        error_mensaje: registro.error_mensaje,
        imagen_temporal_url: imagenTemporalUrl,
        especie: resultadoDetalles,
      },
    });
  } catch (error) {
    console.error(
      "Error en GET /api/identificaciones/[id]:",
      error instanceof Error ? error.message : "Error desconocido"
    );
    return responder(
      { error: "Ocurrió un error al consultar esta identificación." },
      500
    );
  }
}

export async function DELETE(request: Request, { params }: Contexto) {
  const { id } = await params;

  if (!UUID_V4.test(id)) {
    return responder({ error: "El ID de identificación no es válido." }, 400);
  }

  const origen = request.headers.get("origin");
  if (origen && origen !== new URL(request.url).origin) {
    return responder({ error: "Origen no permitido." }, 403);
  }

  try {
    const acceso = await obtenerUsuarioActivo();
    if (!acceso.usuario) return acceso.respuesta;

    const { data: registro, error: errorConsulta } = await acceso.supabase
      .from("identificaciones")
      .select("id, imagen_url")
      .eq("id", id)
      .eq("usuario_id", acceso.usuario.id)
      .maybeSingle();

    if (errorConsulta) {
      console.error("No se pudo cargar el registro para eliminar:", errorConsulta.code);
      return responder({ error: "No se pudo eliminar la identificación." }, 500);
    }
    if (!registro) {
      return responder({ error: "No se encontró la identificación." }, 404);
    }

    const rutaValida = ["jpg", "png", "webp"].some(
      (extension) =>
        registro.imagen_url ===
        `${acceso.usuario.id}/${registro.id}.${extension}`
    );
    if (!rutaValida) {
      return responder(
        { error: "La ruta de la fotografía no coincide con el registro." },
        422
      );
    }

    const { data: predicciones, error: errorConsultaPredicciones } =
      await acceso.supabase
        .from("predicciones")
        .select("especie_id, confianza, posicion")
        .eq("identificacion_id", id);

    if (errorConsultaPredicciones) {
      console.error(
        "No se pudieron consultar resultados relacionados:",
        errorConsultaPredicciones.code
      );
      return responder(
        { error: "No se pudieron preparar los datos relacionados para borrar." },
        500
      );
    }

    const { data: archivoCopia, error: errorDescarga } =
      await acceso.supabase.storage
        .from(BUCKET_IDENTIFICACIONES)
        .download(registro.imagen_url);

    if (errorDescarga) {
      console.warn(
        "No se pudo respaldar la fotografía antes de borrarla; se intentará eliminar el registro igualmente."
      );
    }

    const { error: errorArchivo } = await acceso.supabase.storage
      .from(BUCKET_IDENTIFICACIONES)
      .remove([registro.imagen_url]);

    if (errorArchivo) {
      console.error("No se pudo eliminar la fotografía privada.");
      return responder(
        { error: "No se pudo eliminar la fotografía. No se borró el registro." },
        500
      );
    }

    const { error: errorPredicciones } = await acceso.supabase
      .from("predicciones")
      .delete()
      .eq("identificacion_id", id);

    if (errorPredicciones) {
      console.error("No se pudieron eliminar las predicciones:", errorPredicciones.code);
      await restaurarFotografia(
        acceso.supabase,
        registro.imagen_url,
        archivoCopia
      );
      return responder(
        { error: "No se pudieron eliminar los resultados relacionados." },
        500
      );
    }

    const { data: eliminada, error: errorEliminacion } = await acceso.supabase
      .from("identificaciones")
      .delete()
      .eq("id", id)
      .eq("usuario_id", acceso.usuario.id)
      .select("id")
      .maybeSingle();

    if (errorEliminacion) {
      console.error("No se pudo eliminar la identificación:", errorEliminacion.code);
      if (predicciones && predicciones.length > 0) {
        const { error: errorRestauracionPredicciones } =
          await acceso.supabase.from("predicciones").insert(predicciones);
        if (errorRestauracionPredicciones) {
          console.error(
            "No se pudieron restaurar las predicciones:",
            errorRestauracionPredicciones.code
          );
        }
      }
      await restaurarFotografia(
        acceso.supabase,
        registro.imagen_url,
        archivoCopia
      );
      return responder(
        { error: "No se pudo eliminar el registro de identificación." },
        500
      );
    }
    if (!eliminada) {
      if (predicciones && predicciones.length > 0) {
        const { error: errorRestauracionPredicciones } =
          await acceso.supabase.from("predicciones").insert(predicciones);
        if (errorRestauracionPredicciones) {
          console.error(
            "No se pudieron restaurar las predicciones:",
            errorRestauracionPredicciones.code
          );
        }
      }
      await restaurarFotografia(
        acceso.supabase,
        registro.imagen_url,
        archivoCopia
      );
      return responder({ error: "No se encontró la identificación." }, 404);
    }

    return responder({ eliminada: true });
  } catch (error) {
    console.error(
      "Error en DELETE /api/identificaciones/[id]:",
      error instanceof Error ? error.message : "Error desconocido"
    );
    return responder(
      { error: "Ocurrió un error al eliminar esta identificación." },
      500
    );
  }
}
