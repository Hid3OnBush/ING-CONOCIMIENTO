import { NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { crearClienteServicio } from "@/lib/supabase/servicio";
import {
  BUCKET_IDENTIFICACIONES,
  validarArchivoImagen,
} from "@/lib/identificaciones/archivo";
import {
  esRegistro,
  UMBRAL_MARGEN_MODELO_PUEBLA,
  UMBRAL_MODELO_PUEBLA,
  type AlternativaReconocimiento,
  type FichaEspecieReconocida,
  type ResultadoReconocimiento,
} from "@/lib/identificaciones/reconocimiento";
import {
  aliasCatalogoModeloLocal,
  predecirModeloLocal,
  type EtiquetaModeloLocal,
} from "@/lib/identificaciones/modeloLocal";
import {
  guardarEspecieEnSupabase,
  obtenerDetallesEspecieExterna,
} from "@/lib/identificaciones/enriquecerEspecie";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CAMPOS_ESPECIE =
  "id, nombre_comun, nombre_cientifico, tipo, descripcion, habitat, distribucion, alimentacion, temporada, caracteristicas, nivel_riesgo, estado_conservacion, peligrosa, toxica, venenosa, protegida, reino, filo_division, clase, orden_taxonomico, familia, genero, especie_taxonomica";

type Contexto = {
  params: Promise<{ id: string }>;
};

type EspecieCatalogo = {
  id: number | string;
  activa?: boolean;
  nombre_comun: string;
  nombre_cientifico: string;
  tipo: "PLANTA" | "ANIMAL";
  descripcion: string | null;
  habitat: string | null;
  distribucion: string | null;
  alimentacion: string | null;
  temporada: string | null;
  caracteristicas: string | null;
  nivel_riesgo: string | null;
  estado_conservacion: string | null;
  peligrosa: boolean | null;
  toxica: boolean | null;
  venenosa: boolean | null;
  protegida: boolean | null;
  reino: string | null;
  filo_division: string | null;
  clase: string | null;
  orden_taxonomico: string | null;
  familia: string | null;
  genero: string | null;
  especie_taxonomica: string | null;
};

function responder(datos: unknown, estado = 200) {
  return NextResponse.json(datos, {
    status: estado,
    headers: { "Cache-Control": "private, no-store" },
  });
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim()
    ? valor.trim()
    : null;
}

function crearFicha(
  especie: EspecieCatalogo
): FichaEspecieReconocida {
  return {
    id: especie.activa === false ? null : String(especie.id),
    taxon_id: null,
    nombre_comun: especie.nombre_comun,
    nombre_cientifico: especie.nombre_cientifico,
    tipo: especie.tipo,
    descripcion: especie.descripcion,
    habitat: especie.habitat,
    distribucion: especie.distribucion,
    alimentacion: especie.alimentacion,
    temporada: especie.temporada,
    caracteristicas: especie.caracteristicas,
    nivel_riesgo: especie.nivel_riesgo,
    estado_conservacion: especie.estado_conservacion,
    peligrosa: especie.peligrosa,
    toxica: especie.toxica,
    venenosa: especie.venenosa,
    protegida: especie.protegida,
    imagen_url: null,
    taxonomia: {
      reino: especie.reino,
      filo_division: especie.filo_division,
      clase: especie.clase,
      orden: especie.orden_taxonomico,
      familia: especie.familia,
      genero: especie.genero,
      especie: especie.especie_taxonomica,
    },
  };
}

async function buscarEspecieModeloLocal(
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>,
  etiqueta: EtiquetaModeloLocal
): Promise<EspecieCatalogo | null> {
  const { data, error } = await supabase
    .from("especies")
    .select(CAMPOS_ESPECIE)
    .eq("activa", true)
    .in("nombre_comun", [...aliasCatalogoModeloLocal(etiqueta)])
    .limit(2);

  if (error) {
    throw new Error("No se pudo validar la especie del modelo local.");
  }

  return data?.length === 1
    ? (data[0] as EspecieCatalogo)
    : null;
}

type TaxonExterno = {
  id?: number;
  name?: string;
  preferred_common_name?: string;
  iconic_taxon_name?: string;
  rank?: string;
  conservation_status?: {
    status_name?: string;
    name?: string;
  };
  default_photo?: {
    medium_url?: string;
    url?: string;
  };
};

function leerPuntajeINaturalist(resultado: Record<string, unknown>) {
  const puntaje = resultado.combined_score ?? resultado.vision_score;

  if (
    typeof puntaje !== "number" ||
    !Number.isFinite(puntaje) ||
    puntaje < 0 ||
    puntaje > 100
  ) {
    return null;
  }

  return puntaje / 100;
}

async function consultarINaturalist(
  bytes: ArrayBuffer,
  mime: string
): Promise<Array<{ taxon: TaxonExterno; score: number }>> {
  const oauthAccessToken =
    process.env.INATURALIST_OAUTH_ACCESS_TOKEN?.trim();
  const apiTokenAnterior = process.env.INATURALIST_API_TOKEN?.trim();

  if (!oauthAccessToken && !apiTokenAnterior) {
    throw new Error(
      "Falta configurar INATURALIST_OAUTH_ACCESS_TOKEN para renovar automáticamente el token de iNaturalist."
    );
  }

  let apiToken = apiTokenAnterior;

  if (oauthAccessToken) {
    const respuestaToken = await fetch(
      "https://www.inaturalist.org/users/api_token",
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${oauthAccessToken}`,
          Accept: "application/json",
        },
        cache: "no-store",
        redirect: "manual",
        signal: AbortSignal.timeout(10000),
      }
    );

    if (!respuestaToken.ok || respuestaToken.redirected) {
      await respuestaToken.body?.cancel();
      throw new Error(
        `iNaturalist no pudo renovar el token de Computer Vision (HTTP ${respuestaToken.status}). Reautoriza la aplicación de Natura Go.`
      );
    }

    const datosToken: unknown = await respuestaToken.json();
    if (
      !esRegistro(datosToken) ||
      typeof datosToken.api_token !== "string" ||
      !datosToken.api_token.trim()
    ) {
      throw new Error(
        "iNaturalist devolvió una respuesta de autenticación no válida."
      );
    }

    apiToken = datosToken.api_token.trim();
  }

  if (!apiToken) {
    throw new Error(
      "iNaturalist no proporcionó un token para Computer Vision."
    );
  }

  const formulario = new FormData();
  formulario.set(
    "image",
    new Blob([bytes], { type: mime }),
    "fotografia"
  );
  const respuesta = await fetch(
    "https://api.inaturalist.org/v1/computervision/score_image",
    {
      method: "POST",
      headers: {
        Authorization: apiToken,
        Accept: "application/json",
      },
      body: formulario,
      cache: "no-store",
      signal: AbortSignal.timeout(20000),
    }
  );

  if (!respuesta.ok) {
    const cuerpo = await respuesta.text();
    const detalle = cuerpo.match(/<pre>([^<]+)<\/pre>/i)?.[1];
    if (respuesta.status === 401) {
      throw new Error(
        "iNaturalist rechazó INATURALIST_API_TOKEN (HTTP 401). El token es inválido o expiró; los JWT de iNaturalist vencen a las 24 horas y deben renovarse."
      );
    }
    if (respuesta.status === 403) {
      throw new Error(
        "iNaturalist no autorizó el acceso a Computer Vision (HTTP 403). Verifica los permisos de la cuenta y del token."
      );
    }
    throw new Error(
      `iNaturalist respondió con HTTP ${respuesta.status}${detalle ? `: ${detalle}` : "."}`
    );
  }

  const datos: unknown = await respuesta.json();

  if (!esRegistro(datos) || !Array.isArray(datos.results)) {
    throw new Error("iNaturalist devolvió una respuesta no válida.");
  }

  return datos.results
    .filter(
      (resultado): resultado is Record<string, unknown> =>
        esRegistro(resultado) &&
        esRegistro(resultado.taxon) &&
        typeof resultado.taxon.name === "string" &&
        leerPuntajeINaturalist(resultado) !== null
    )
    .map((resultado) => ({
      taxon: resultado.taxon as TaxonExterno,
      score: leerPuntajeINaturalist(resultado) ?? 0,
    }))
    .slice(0, 5);
}

function describirErrorIntegracion(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Error desconocido";
  }

  const causa = esRegistro(error.cause) ? error.cause : null;
  const codigo =
    causa && typeof causa.code === "string" ? causa.code : null;

  return codigo ? `${error.message} (${codigo})` : error.message;
}

function tipoTaxon(valor: unknown): "PLANTA" | "ANIMAL" | null {
  if (typeof valor !== "string") {
    return null;
  }

  const nombre = valor.toLowerCase();
  if (nombre === "plantae" || nombre === "plants") {
    return "PLANTA";
  }
  if (
    nombre === "animalia" ||
    nombre === "animals" ||
    nombre === "aves" ||
    nombre === "mammalia" ||
    nombre === "reptilia" ||
    nombre === "amphibia" ||
    nombre === "insecta"
  ) {
    return "ANIMAL";
  }

  return null;
}

function crearFichaExterna(
  taxon: TaxonExterno,
  catalogo: EspecieCatalogo | null
): FichaEspecieReconocida {
  if (catalogo) {
    return crearFicha(catalogo);
  }

  return {
    id: null,
    taxon_id:
      typeof taxon.id === "number" && Number.isSafeInteger(taxon.id)
        ? taxon.id
        : null,
    nombre_comun:
      texto(taxon.preferred_common_name) ??
      texto(taxon.name) ??
      "Nombre común no disponible",
    nombre_cientifico: texto(taxon.name) ?? "Taxón no disponible",
    tipo: tipoTaxon(taxon.iconic_taxon_name),
    descripcion: null,
    habitat: null,
    distribucion: null,
    alimentacion: null,
    temporada: null,
    caracteristicas: null,
    nivel_riesgo: null,
    estado_conservacion:
      texto(taxon.conservation_status?.status_name) ??
      texto(taxon.conservation_status?.name),
    peligrosa: null,
    toxica: null,
    venenosa: null,
    protegida: null,
    imagen_url:
      texto(taxon.default_photo?.medium_url) ??
      texto(taxon.default_photo?.url),
    taxonomia: {
      reino: null,
      filo_division: null,
      clase: null,
      orden: null,
      familia: null,
      genero: null,
      especie: null,
    },
  };
}

async function crearResultadoExterno(
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>,
  supabaseServicio: ReturnType<typeof crearClienteServicio>,
  candidatos: Array<{ taxon: TaxonExterno; score: number }>,
  usuarioId: string
): Promise<ResultadoReconocimiento> {
  const nombres = candidatos
    .map(({ taxon }) => taxon.name)
    .filter((nombre): nombre is string => typeof nombre === "string");
  const { data: especies, error } = nombres.length
    ? await supabase
        .from("especies")
        .select(`${CAMPOS_ESPECIE}, activa`)
        .in("nombre_cientifico", nombres)
    : { data: [], error: null };

  if (error) {
    throw new Error(
      "No se pudieron complementar los resultados con el catálogo local."
    );
  }

  const registrosCatalogo = (especies ?? []) as EspecieCatalogo[];
  const nombresExistentes = new Set(
    registrosCatalogo.map((especie) => especie.nombre_cientifico)
  );
  const locales = new Map(
    registrosCatalogo.map((especie) => [
      especie.nombre_cientifico,
      especie,
    ])
  );
  const alternativas: AlternativaReconocimiento[] = candidatos.map(
    ({ taxon, score }) => ({
      confianza: score,
      especie: crearFichaExterna(
        taxon,
        typeof taxon.name === "string"
          ? locales.get(taxon.name) ?? null
          : null
      ),
    })
  );
  let principal = alternativas[0] ?? null;

  if (
    principal &&
    !nombresExistentes.has(principal.especie.nombre_cientifico)
  ) {
    const candidatoPrincipal = candidatos[0];

    if (
      candidatoPrincipal &&
      typeof candidatoPrincipal.taxon.id === "number" &&
      Number.isSafeInteger(candidatoPrincipal.taxon.id) &&
      candidatoPrincipal.taxon.id > 0
    ) {
      const enriquecida = await obtenerDetallesEspecieExterna(
        candidatoPrincipal.taxon.id,
        principal.especie.nombre_cientifico
      );
      const almacenada = await guardarEspecieEnSupabase(
        supabaseServicio,
        enriquecida,
        usuarioId
      );

      principal = {
        ...principal,
        especie: almacenada,
      };
      alternativas[0] = principal;
    }
  }

  return {
    fuente: "inaturalist",
    umbral_modelo_puebla: UMBRAL_MODELO_PUEBLA,
    confianza: principal?.confianza ?? null,
    identificada: Boolean(principal),
    especie: principal?.especie ?? null,
    alternativas,
    mensaje: principal
      ? "Resultado sugerido por iNaturalist; confirma la identificación con una fuente experta."
      : "No se encontró una coincidencia en la imagen.",
  };
}

export async function POST(
  request: Request,
  { params }: Contexto
) {
  const { id } = await params;

  if (!UUID_V4.test(id)) {
    return responder({ error: "El ID de identificación no es válido." }, 400);
  }

  const origen = request.headers.get("origin");
  if (origen && origen !== new URL(request.url).origin) {
    return responder({ error: "Origen no permitido." }, 403);
  }

  let cliente: Awaited<ReturnType<typeof crearClienteServidor>> | null =
    null;
  let usuarioId: string | null = null;

  try {
    const supabase = await crearClienteServidor();
    cliente = supabase;
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
    usuarioId = user.id;

    const { data: perfil, error: errorPerfil } = await supabase
      .from("perfiles")
      .select("activo")
      .eq("id", user.id)
      .maybeSingle();

    if (errorPerfil) {
      console.error("Error al verificar perfil para reconocimiento:", errorPerfil.code);
      return responder({ error: "No se pudo verificar tu cuenta." }, 500);
    }
    if (!perfil?.activo) {
      return responder({ error: "Tu cuenta no está disponible." }, 403);
    }

    const { data: identificacion, error: errorIdentificacion } =
      await supabase
        .from("identificaciones")
        .select("id, imagen_url")
        .eq("id", id)
        .eq("usuario_id", user.id)
        .maybeSingle();

    if (errorIdentificacion) {
      console.error("Error al consultar identificación:", errorIdentificacion.code);
      return responder({ error: "No se pudo consultar la identificación." }, 500);
    }
    if (!identificacion) {
      return responder({ error: "No se encontró la identificación." }, 404);
    }

    const supabaseServicio = crearClienteServicio();

    const rutaPermitida = new RegExp(
      `^${user.id}/${id}\\.(jpg|png|webp)$`,
      "i"
    );
    const coincidenciaRuta = rutaPermitida.exec(identificacion.imagen_url);
    if (!coincidenciaRuta) {
      return responder({ error: "La fotografía asociada no es válida." }, 422);
    }

    const { data: archivo, error: errorArchivo } = await supabase.storage
      .from(BUCKET_IDENTIFICACIONES)
      .download(identificacion.imagen_url);

    if (errorArchivo || !archivo) {
      console.error("Error al descargar imagen para reconocimiento.");
      return responder({ error: "No se pudo acceder a la fotografía." }, 422);
    }

    const formato = await validarArchivoImagen(archivo);
    if (formato.extension !== coincidenciaRuta[1].toLowerCase()) {
      return responder(
        { error: "El formato de la fotografía no coincide con su extensión." },
        422
      );
    }
    const mime = formato.mime;
    const bytes = await archivo.arrayBuffer();

    const { data: identificacionProcesando, error: errorProcesando } =
      await supabase
      .from("identificaciones")
      .update({
        estado: "PROCESANDO",
        error_mensaje: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("usuario_id", user.id)
      .select("id")
      .maybeSingle();

    if (errorProcesando) {
      console.error("Error al iniciar el reconocimiento:", {
        code: errorProcesando.code,
        message: errorProcesando.message,
        details: errorProcesando.details,
        hint: errorProcesando.hint,
      });
      throw new Error(
        "Supabase rechazó la actualización del estado. Revisa el enum estado_identificacion y los permisos de UPDATE/RLS."
      );
    }
    if (!identificacionProcesando) {
      console.error(
        "No se actualizó la identificación; revisa las políticas RLS de UPDATE."
      );
      throw new Error(
        "Supabase no permitió actualizar esta identificación. Revisa la política RLS de UPDATE para que el usuario propietario pueda actualizarla."
      );
    }

    let resultado: ResultadoReconocimiento | null = null;
    let resultadoLocal: ResultadoReconocimiento | null = null;

    try {
      const prediccion = await predecirModeloLocal(bytes);

      if (
        prediccion.confianza >= UMBRAL_MODELO_PUEBLA &&
        prediccion.margen >= UMBRAL_MARGEN_MODELO_PUEBLA
      ) {
        const especie = await buscarEspecieModeloLocal(
          supabase,
          prediccion.etiqueta
        );

        if (especie) {
          const ficha = crearFicha(especie);
          resultadoLocal = {
            fuente: "modelo_puebla",
            umbral_modelo_puebla: UMBRAL_MODELO_PUEBLA,
            confianza: prediccion.confianza,
            identificada: true,
            especie: ficha,
            alternativas: [
              { confianza: prediccion.confianza, especie: ficha },
            ],
            mensaje: "Identificación sugerida por el modelo local.",
          };
        }
      }
    } catch (errorModeloLocal) {
      console.error(
        "El modelo local no pudo completar la inferencia; se usará iNaturalist:",
        describirErrorIntegracion(errorModeloLocal)
      );
    }

    try {
      const candidatos = await consultarINaturalist(bytes, mime);
      const principal = candidatos[0];
      const coincideConModeloLocal =
        resultadoLocal?.especie &&
        principal?.taxon.name ===
          resultadoLocal.especie.nombre_cientifico;

      if (coincideConModeloLocal && resultadoLocal) {
        resultado = {
          ...resultadoLocal,
          mensaje:
            "El modelo local y iNaturalist coinciden en esta identificación.",
        };
      } else {
        resultado = await crearResultadoExterno(
          supabase,
          supabaseServicio,
          candidatos,
          user.id
        );
      }
    } catch (errorExterno) {
      console.error(
        "No se pudo completar el reconocimiento externo:",
        describirErrorIntegracion(errorExterno)
      );

      const { error: errorEstado } = await supabaseServicio
        .from("identificaciones")
        .update({
          estado: "ERROR",
          error_mensaje: "No se pudo completar el reconocimiento.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("usuario_id", user.id);
      if (errorEstado) {
        console.error("No se pudo registrar el fallo del proveedor:", {
          code: errorEstado.code,
          message: errorEstado.message,
          details: errorEstado.details,
          hint: errorEstado.hint,
        });
      }

      return responder(
        {
          error: errorExterno instanceof Error
            ? `La fotografía se guardó, pero el reconocimiento falló: ${errorExterno.message}`
            : "La fotografía se guardó, pero el servicio de reconocimiento no está disponible. Puedes reintentar el análisis.",
        },
        503
      );
    }

    const predicciones = resultado.alternativas
      .filter((alternativa) => alternativa.especie.id !== null)
      .map((alternativa, posicion) => ({
        identificacion_id: id,
        especie_id: alternativa.especie.id,
        confianza: alternativa.confianza,
        posicion: posicion + 1,
      }));
    let advertenciaPredicciones: string | null = null;

    const { error: errorBorrado } = await supabaseServicio
      .from("predicciones")
      .delete()
      .eq("identificacion_id", id);

    if (errorBorrado) {
      console.error("Error al reemplazar predicciones:", {
        code: errorBorrado.code,
        message: errorBorrado.message,
        details: errorBorrado.details,
        hint: errorBorrado.hint,
      });
      advertenciaPredicciones =
        "La identificación se completó, pero no se pudieron actualizar las alternativas.";
    } else if (predicciones.length > 0) {
      const { error: errorPredicciones } = await supabaseServicio
        .from("predicciones")
        .insert(predicciones);

      if (errorPredicciones) {
        console.error("Error al guardar predicciones:", {
          code: errorPredicciones.code,
          message: errorPredicciones.message,
          details: errorPredicciones.details,
          hint: errorPredicciones.hint,
        });
        advertenciaPredicciones =
          "La identificación se completó, pero no se pudieron guardar las alternativas.";
      }
    }

    const mensajeResultado = advertenciaPredicciones
      ? `${resultado.mensaje} ${advertenciaPredicciones}`
      : resultado.mensaje;

    const { error: errorActualizacion } = await supabaseServicio
      .from("identificaciones")
      .update({
        estado: "COMPLETADA",
        especie_resultado_id: resultado.especie?.id ?? null,
        confianza: resultado.confianza,
        mensaje_resultado: mensajeResultado,
        resultado_detalles: resultado.especie,
        error_mensaje: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("usuario_id", user.id);

    if (errorActualizacion) {
      console.error("Error al guardar el resultado:", {
        code: errorActualizacion.code,
        message: errorActualizacion.message,
        details: errorActualizacion.details,
        hint: errorActualizacion.hint,
      });
      throw new Error("No se pudo guardar el resultado del reconocimiento.");
    }

    return responder({
      identificacion: { id, estado: "COMPLETADA" },
      resultado: { ...resultado, mensaje: mensajeResultado },
    });
  } catch (error) {
    console.error(
      "Error en POST /api/identificaciones/[id]/resultado:",
      error instanceof Error ? error.message : "Error desconocido"
    );

    if (cliente && usuarioId) {
      const { error: errorEstado } = await cliente
        .from("identificaciones")
        .update({
          estado: "ERROR",
          error_mensaje: "No se pudo completar el reconocimiento.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("usuario_id", usuarioId);

      if (errorEstado) {
        console.error(
          "No se pudo registrar el estado de error:",
          errorEstado.code
        );
      }
    }

    return responder(
      {
        error:
          error instanceof Error
            ? error.message
            : "Ocurrió un error al analizar la fotografía.",
      },
      500
    );
  }
}
