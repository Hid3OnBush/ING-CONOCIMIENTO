import type { crearClienteServidor } from "@/lib/supabase/servidor";

export interface EspecieHomogenea {
  id: string | null;
  nombre_comun: string;
  nombre_cientifico: string;
  tipo: "PLANTA" | "ANIMAL" | null;
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
  imagen_url: string | null;
  taxonomia: {
    reino: string | null;
    filo_division: string | null;
    clase: string | null;
    orden: string | null;
    familia: string | null;
    genero: string | null;
    especie: string | null;
  };
}

type ClienteServidor = Awaited<ReturnType<typeof crearClienteServidor>>;

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return (
    typeof valor === "object" &&
    valor !== null &&
    !Array.isArray(valor)
  );
}

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim()
    ? valor.trim()
    : null;
}

function urlSegura(valor: unknown): string | null {
  const valorTexto = texto(valor);

  if (!valorTexto) {
    return null;
  }

  try {
    const url = new URL(valorTexto);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

async function consultarApi(
  url: string,
  proveedor: string
): Promise<Record<string, unknown> | null> {
  try {
    const respuesta = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!respuesta.ok) {
      await respuesta.body?.cancel();
      if (respuesta.status !== 404) {
        console.warn(`${proveedor} respondió con HTTP ${respuesta.status}.`);
      }
      return null;
    }

    const datos: unknown = await respuesta.json();
    return esRegistro(datos) ? datos : null;
  } catch (error) {
    console.warn(
      `No se pudo consultar ${proveedor}:`,
      error instanceof Error ? error.message : "Error desconocido"
    );
    return null;
  }
}

function tipoEspecie(
  taxon: Record<string, unknown> | null,
  ancestros: Record<string, unknown>[]
): "PLANTA" | "ANIMAL" | null {
  const nombresTaxonomicos = [
    taxon?.iconic_taxon_name,
    ...ancestros.map((ancestro) => ancestro.name),
  ]
    .filter((nombre): nombre is string => typeof nombre === "string")
    .map((nombre) => nombre.toLowerCase());

  if (
    nombresTaxonomicos.some((nombre) =>
      ["plantae", "plants", "planta"].includes(nombre)
    )
  ) {
    return "PLANTA";
  }

  if (
    nombresTaxonomicos.some((nombre) =>
      [
        "animalia",
        "animals",
        "aves",
        "mammalia",
        "reptilia",
        "amphibia",
        "insecta",
      ].includes(nombre)
    )
  ) {
    return "ANIMAL";
  }

  return null;
}

function leerTaxonomia(
  taxon: Record<string, unknown> | null,
  ancestros: Record<string, unknown>[],
  scientificName: string
): EspecieHomogenea["taxonomia"] {
  const taxonomia: EspecieHomogenea["taxonomia"] = {
    reino: null,
    filo_division: null,
    clase: null,
    orden: null,
    familia: null,
    genero: null,
    especie: null,
  };
  const niveles: Record<string, keyof typeof taxonomia> = {
    kingdom: "reino",
    phylum: "filo_division",
    division: "filo_division",
    class: "clase",
    order: "orden",
    family: "familia",
    genus: "genero",
    species: "especie",
  };

  for (const ancestro of [...ancestros, ...(taxon ? [taxon] : [])]) {
    const rango = texto(ancestro.rank)?.toLowerCase();
    const nombre = texto(ancestro.name);
    const campo = rango ? niveles[rango] : null;

    if (campo && nombre) {
      taxonomia[campo] = nombre;
    }
  }

  if (!taxonomia.genero) {
    taxonomia.genero = scientificName.split(/\s+/)[0] ?? null;
  }
  if (!taxonomia.especie && texto(taxon?.rank)?.toLowerCase() === "species") {
    taxonomia.especie = texto(taxon?.name) ?? scientificName;
  }

  return taxonomia;
}

export async function obtenerDetallesEspecieExterna(
  taxonId: number,
  scientificName: string
): Promise<EspecieHomogenea> {
  const taxonUrl = new URL(
    `https://api.inaturalist.org/v1/taxa/${encodeURIComponent(String(taxonId))}`
  );
  taxonUrl.searchParams.set("locale", "es");
  taxonUrl.searchParams.append("include[]", "ancestors");

  const wikipediaName = scientificName.trim().replace(/\s+/g, "_");
  const wikipediaUrl =
    `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikipediaName)}`;

  const [respuestaTaxon, resumenWikipedia] = await Promise.all([
    consultarApi(taxonUrl.toString(), "la API de taxa de iNaturalist"),
    consultarApi(wikipediaUrl, "la API REST de Wikipedia"),
  ]);

  const resultadosTaxon = respuestaTaxon?.results;
  const taxon =
    Array.isArray(resultadosTaxon) && esRegistro(resultadosTaxon[0])
      ? resultadosTaxon[0]
      : null;
  const ancestros = Array.isArray(taxon?.ancestors)
    ? taxon.ancestors.filter(esRegistro)
    : [];
  const resumenINaturalist = texto(taxon?.wikipedia_summary);
  const resumenWiki = texto(resumenWikipedia?.extract);
  const descripcion =
    (resumenINaturalist && resumenINaturalist.length >= 120
      ? resumenINaturalist
      : resumenWiki) ?? resumenINaturalist;
  const estadoConservacion = esRegistro(taxon?.conservation_status)
    ? texto(taxon.conservation_status.status_name) ??
      texto(taxon.conservation_status.name) ??
      texto(taxon.conservation_status.status)
    : null;
  const foto = esRegistro(taxon?.default_photo)
    ? taxon.default_photo
    : null;
  const miniaturaWiki = esRegistro(resumenWikipedia?.thumbnail)
    ? resumenWikipedia.thumbnail
    : null;

  return {
    id: null,
    nombre_comun:
      texto(taxon?.preferred_common_name) ?? scientificName,
    nombre_cientifico: texto(taxon?.name) ?? scientificName,
    tipo: tipoEspecie(taxon, ancestros),
    descripcion,
    habitat: null,
    distribucion: null,
    alimentacion: null,
    temporada: null,
    caracteristicas: null,
    nivel_riesgo: estadoConservacion,
    estado_conservacion: estadoConservacion,
    peligrosa: null,
    toxica: null,
    venenosa: null,
    protegida: null,
    imagen_url:
      urlSegura(foto?.medium_url) ??
      urlSegura(foto?.url) ??
      urlSegura(miniaturaWiki?.source),
    taxonomia: leerTaxonomia(taxon, ancestros, scientificName),
  };
}

export async function guardarEspecieEnSupabase(
  supabase: ClienteServidor,
  especie: EspecieHomogenea,
  usuarioId: string
): Promise<EspecieHomogenea> {
  const { data: existente, error: errorExistente } = await supabase
    .from("especies")
    .select("id, activa")
    .eq("nombre_cientifico", especie.nombre_cientifico)
    .maybeSingle();

  if (errorExistente) {
    console.error(
      "No se pudo comprobar si la especie enriquecida ya existe:",
      errorExistente.code
    );
    return especie;
  }

  if (existente) {
    return {
      ...especie,
      id: existente.activa ? String(existente.id) : null,
    };
  }

  if (!especie.tipo) {
    console.warn(
      "No se guardó la especie enriquecida porque iNaturalist no permitió determinar si es planta o animal."
    );
    return especie;
  }

  const { data: insertada, error: errorInsercion } = await supabase
    .from("especies")
    .insert({
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
      reino: especie.taxonomia.reino,
      filo_division: especie.taxonomia.filo_division,
      clase: especie.taxonomia.clase,
      orden_taxonomico: especie.taxonomia.orden,
      familia: especie.taxonomia.familia,
      genero: especie.taxonomia.genero,
      especie_taxonomica: especie.taxonomia.especie,
      activa: false,
      created_by: usuarioId,
    })
    .select("id, activa")
    .single();

  if (errorInsercion) {
    if (errorInsercion.code === "23505") {
      const { data: duplicada, error: errorDuplicada } = await supabase
        .from("especies")
        .select("id, activa")
        .eq("nombre_cientifico", especie.nombre_cientifico)
        .maybeSingle();

      if (!errorDuplicada && duplicada) {
        return {
          ...especie,
          id: duplicada.activa ? String(duplicada.id) : null,
        };
      }
    }

    console.error(
      "No se pudo guardar la especie enriquecida en Supabase:",
      errorInsercion.code
    );
    return especie;
  }

  return {
    ...especie,
    id: insertada.activa ? String(insertada.id) : null,
  };
}
