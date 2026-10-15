import type { crearClienteServidor } from "@/lib/supabase/servidor";

export interface EspecieHomogenea {
  id: string | null;
  taxon_id: number | null;
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

function normalizarEtiqueta(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function obtenerSeccionesWikipedia(
  extracto: string
): Record<string, string> {
  const contenido: Record<string, string[]> = {
    caracteristicas: [],
    habitat: [],
    distribucion: [],
    alimentacion: [],
    temporada: [],
    conservacion: [],
    distribucion_habitat: [],
  };
  const encabezados: Record<string, string[]> = {
    descripcion: ["caracteristicas"],
    morfologia: ["caracteristicas"],
    caracteristicas: ["caracteristicas"],
    habitat: ["habitat"],
    distribucion: ["distribucion"],
    "distribucion y habitat": ["distribucion_habitat"],
    "habitat y distribucion": ["distribucion_habitat"],
    "distribucion y ecologia": ["distribucion_habitat"],
    alimentacion: ["alimentacion"],
    dieta: ["alimentacion"],
    nutricion: ["alimentacion"],
    fenologia: ["temporada"],
    floracion: ["temporada"],
    reproduccion: ["temporada"],
    "ciclo de vida": ["temporada"],
    "estado de conservacion": ["conservacion"],
    conservacion: ["conservacion"],
  };
  const introduccion: string[] = [];
  let seccionesActivas: string[] = [];
  let antesDelPrimerEncabezado = true;
  let parrafoActual: string[] = [];

  const guardarParrafo = () => {
    const parrafo = parrafoActual.join(" ").replace(/\s+/g, " ").trim();
    if (!parrafo) {
      return;
    }

    if (antesDelPrimerEncabezado) {
      introduccion.push(parrafo);
    }
    for (const seccion of seccionesActivas) {
      contenido[seccion].push(parrafo);
    }
    parrafoActual = [];
  };

  for (const linea of extracto.split(/\r?\n/)) {
    const lineaLimpia = linea.replace(/\s+/g, " ").trim();
    if (!lineaLimpia) {
      guardarParrafo();
      continue;
    }

    const clave = encabezados[normalizarEtiqueta(lineaLimpia)];
    if (clave) {
      guardarParrafo();
      seccionesActivas = clave;
      antesDelPrimerEncabezado = false;
      continue;
    }

    const pareceEncabezado =
      lineaLimpia.length <= 70 &&
      !/[.!?;:]$/.test(lineaLimpia) &&
      lineaLimpia.split(/\s+/).length <= 8;

    if (pareceEncabezado) {
      guardarParrafo();
      seccionesActivas = [];
      antesDelPrimerEncabezado = false;
      continue;
    }

    parrafoActual.push(lineaLimpia);
  }
  guardarParrafo();

  const frasesDistribucion = contenido.distribucion_habitat
    .flatMap((parrafo) =>
      parrafo.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ])/u)
    )
    .map((frase) => frase.trim())
    .filter(Boolean);
  const frasesHabitat = frasesDistribucion.filter((frase) =>
    /\b(?:habitat|bioma|bosque|matorral|desierto|desertico|valle|prepuna|altitud|altura|crece|vive|se desarrolla|vegetacion|humedal|selva)\b/i.test(
      normalizarEtiqueta(frase)
    )
  );
  const frasesRango = frasesDistribucion.filter((frase) =>
    /\b(?:distribucion|distribuye|nativa|nativo|endemica|endemico|localiza|localizado|se encuentra|presente en|originaria|originario|bolivia|argentina|brasil|chile|ecuador|peru|paraguay|uruguay|sudamerica)\b/i.test(
      normalizarEtiqueta(frase)
    )
  );
  const distribucionEspecifica = contenido.distribucion.join("\n\n");
  const habitatEspecifico = contenido.habitat.join("\n\n");

  return {
    descripcion: introduccion.join("\n\n") || "",
    caracteristicas: contenido.caracteristicas.join("\n\n"),
    habitat:
      habitatEspecifico ||
      (frasesHabitat.length ? frasesHabitat.join(" ") : ""),
    distribucion:
      distribucionEspecifica ||
      (frasesRango.length ? frasesRango.join(" ") : ""),
    alimentacion: contenido.alimentacion.join("\n\n"),
    temporada: contenido.temporada.join("\n\n"),
    conservacion: contenido.conservacion.join("\n\n"),
  };
}

async function consultarWikipedia(
  scientificName: string
): Promise<Record<string, unknown> | null> {
  const busquedaUrl = new URL("https://es.wikipedia.org/w/api.php");
  busquedaUrl.search = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: `"${scientificName}"`,
    srnamespace: "0",
    srlimit: "5",
    format: "json",
    utf8: "1",
  }).toString();

  const respuestaBusqueda = await consultarApi(
    busquedaUrl.toString(),
    "la búsqueda de artículos de Wikipedia"
  );
  const query = esRegistro(respuestaBusqueda?.query)
    ? respuestaBusqueda.query
    : null;
  const resultados = Array.isArray(query?.search)
    ? query.search.filter(esRegistro)
    : [];
  const articulo = resultados.find(
    (resultado) =>
      typeof resultado.title === "string" &&
      normalizarEtiqueta(resultado.title) ===
        normalizarEtiqueta(scientificName)
  );
  const titulo = texto(articulo?.title);

  if (!titulo) {
    return null;
  }

  const articuloUrl = new URL("https://es.wikipedia.org/w/api.php");
  articuloUrl.search = new URLSearchParams({
    action: "query",
    prop: "extracts|pageimages",
    explaintext: "1",
    exsectionformat: "plain",
    piprop: "thumbnail",
    pithumbsize: "1000",
    titles: titulo,
    format: "json",
    formatversion: "2",
  }).toString();

  const respuestaArticulo = await consultarApi(
    articuloUrl.toString(),
    "el artículo de Wikipedia en español"
  );
  const articuloQuery = esRegistro(respuestaArticulo?.query)
    ? respuestaArticulo.query
    : null;
  const paginas = Array.isArray(articuloQuery?.pages)
    ? articuloQuery.pages.filter(esRegistro)
    : [];
  const pagina = paginas.find(
    (resultado) =>
      normalizarEtiqueta(texto(resultado.title) ?? "") ===
      normalizarEtiqueta(titulo)
  );

  return pagina ?? null;
}

async function consultarGBIF(
  scientificName: string
): Promise<{
  taxon: Record<string, unknown> | null;
  distribuciones: Record<string, unknown>[];
}> {
  const matchUrl = new URL("https://api.gbif.org/v1/species/match");
  matchUrl.searchParams.set("name", scientificName);
  matchUrl.searchParams.set("strict", "true");

  const match = await consultarApi(
    matchUrl.toString(),
    "la API de taxonomía de GBIF"
  );
  const confidence =
    typeof match?.confidence === "number" ? match.confidence : 0;
  const key =
    typeof match?.acceptedUsageKey === "number"
      ? match.acceptedUsageKey
      : typeof match?.usageKey === "number"
        ? match.usageKey
        : null;

  if (!match || confidence < 90 || !key) {
    return { taxon: null, distribuciones: [] };
  }

  const [taxon, datosDistribucion] = await Promise.all([
    consultarApi(
      `https://api.gbif.org/v1/species/${key}`,
      "la clasificación taxonómica de GBIF"
    ),
    consultarApi(
      `https://api.gbif.org/v1/species/${key}/distributions`,
      "la distribución geográfica de GBIF"
    ),
  ]);
  const resultados = Array.isArray(datosDistribucion?.results)
    ? datosDistribucion.results.filter(esRegistro)
    : [];

  return { taxon: taxon ?? match, distribuciones: resultados };
}

function leerEstadoConservacion(
  valor: unknown,
  seccionWikipedia: string
): string | null {
  const estado = texto(valor);
  const normalizado = normalizarEtiqueta(estado ?? "");
  const categorias: Array<{ patron: RegExp; etiqueta: string }> = [
    {
      patron: /^(lc|least concern|preocupacion menor)/,
      etiqueta: "Preocupación menor (UICN)",
    },
    {
      patron: /^(nt|near threatened|casi amenazada)/,
      etiqueta: "Casi amenazada (UICN)",
    },
    {
      patron: /^(vu|vulnerable)/,
      etiqueta: "Vulnerable (UICN)",
    },
    {
      patron: /^(en|endangered|en peligro$)/,
      etiqueta: "En peligro (UICN)",
    },
    {
      patron: /^(cr|critically endangered|en peligro critico)/,
      etiqueta: "En peligro crítico (UICN)",
    },
    {
      patron: /^(ew|extinct in the wild|extinta en estado silvestre)/,
      etiqueta: "Extinta en estado silvestre (UICN)",
    },
    {
      patron: /^(ex|extinct|extinta)/,
      etiqueta: "Extinta (UICN)",
    },
    {
      patron: /^(dd|data deficient|datos insuficientes)/,
      etiqueta: "Datos insuficientes (UICN)",
    },
    {
      patron: /^(ne|not evaluated|no evaluada)/,
      etiqueta: "No evaluada (UICN)",
    },
  ];
  const categoria = categorias.find(({ patron }) =>
    patron.test(normalizado)
  );

  if (categoria) {
    return categoria.etiqueta;
  }

  const coincidenciaWikipedia = seccionWikipedia.match(
    /(?:preocupaci[oó]n menor|casi amenazada|vulnerable|en peligro cr[ií]tico|en peligro|datos insuficientes|no evaluada)(?:\s*\([^)]{1,30}\))?/i
  );

  return estado ?? coincidenciaWikipedia?.[0] ?? null;
}

function leerDistribucionGBIF(
  distribuciones: Record<string, unknown>[]
): string | null {
  const nombres = new Set<string>();
  const etiquetasRegion = new Intl.DisplayNames(["es"], { type: "region" });

  for (const distribucion of distribuciones) {
    const establecimiento = texto(distribucion.establishmentMeans);
    if (establecimiento?.toLowerCase() === "managed") {
      continue;
    }

    const localidad = texto(distribucion.locality);
    const pais = texto(distribucion.country);
    const nombrePais =
      !localidad && pais
        ? etiquetasRegion.of(pais.toUpperCase()) ?? pais
        : null;
    const nombre = localidad ?? nombrePais;

    if (nombre && normalizarEtiqueta(nombre) !== "global") {
      nombres.add(nombre);
    }
  }

  return nombres.size
    ? `Registros de distribución reportados por GBIF: ${Array.from(nombres)
        .slice(0, 8)
        .join(", ")}.`
    : null;
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

  const [respuestaTaxon, resumenWikipedia, datosGBIF] = await Promise.all([
    consultarApi(taxonUrl.toString(), "la API de taxa de iNaturalist"),
    consultarWikipedia(scientificName),
    consultarGBIF(scientificName),
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
  const extractoWikipedia = texto(resumenWikipedia?.extract) ?? "";
  const seccionesWikipedia = obtenerSeccionesWikipedia(extractoWikipedia);
  const descripcionWiki =
    seccionesWikipedia.descripcion || extractoWikipedia || null;
  const caracteristicasWiki = seccionesWikipedia.caracteristicas || null;
  const habitatWiki = seccionesWikipedia.habitat || null;
  const distribucionWiki = seccionesWikipedia.distribucion || null;
  const conservacionINaturalist = esRegistro(taxon?.conservation_status)
    ? texto(taxon.conservation_status.status_name) ??
      texto(taxon.conservation_status.name) ??
      texto(taxon.conservation_status.status)
    : null;
  const estadoConservacion = leerEstadoConservacion(
    datosGBIF.distribuciones.find((dato) => texto(dato.threatStatus))
      ?.threatStatus ?? conservacionINaturalist,
    seccionesWikipedia.conservacion
  );
  const nombreComun = texto(taxon?.preferred_common_name) ?? scientificName;
  const tipo = tipoEspecie(taxon, ancestros);
  const distribucionGBIF = leerDistribucionGBIF(
    datosGBIF.distribuciones
  );
  const taxonomiaINaturalist = leerTaxonomia(
    taxon,
    ancestros,
    scientificName
  );
  const taxonGBIF = datosGBIF.taxon;
  const taxonomia = {
    reino:
      taxonomiaINaturalist.reino ?? texto(taxonGBIF?.kingdom),
    filo_division:
      taxonomiaINaturalist.filo_division ?? texto(taxonGBIF?.phylum),
    clase: taxonomiaINaturalist.clase ?? texto(taxonGBIF?.class),
    orden: taxonomiaINaturalist.orden ?? texto(taxonGBIF?.order),
    familia: taxonomiaINaturalist.familia ?? texto(taxonGBIF?.family),
    genero: taxonomiaINaturalist.genero ?? texto(taxonGBIF?.genus),
    especie: taxonomiaINaturalist.especie ?? texto(taxonGBIF?.species),
  };
  const foto = esRegistro(taxon?.default_photo)
    ? taxon.default_photo
    : null;
  const miniaturaWiki = esRegistro(resumenWikipedia?.thumbnail)
    ? resumenWikipedia.thumbnail
    : null;

  return {
    id: null,
    taxon_id: taxonId,
    nombre_comun: nombreComun,
    nombre_cientifico:
      texto(taxon?.name) ??
      texto(taxonGBIF?.canonicalName) ??
      scientificName,
    tipo,
    descripcion: descripcionWiki ?? resumenINaturalist,
    habitat: habitatWiki,
    distribucion: distribucionWiki ?? distribucionGBIF,
    alimentacion:
      seccionesWikipedia.alimentacion ||
      (tipo === "PLANTA"
        ? "Autótrofa: produce nutrientes mediante la fotosíntesis."
        : null),
    temporada: seccionesWikipedia.temporada || null,
    caracteristicas: caracteristicasWiki,
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
    taxonomia,
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
