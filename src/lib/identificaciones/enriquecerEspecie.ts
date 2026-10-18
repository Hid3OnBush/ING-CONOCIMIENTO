import type { crearClienteServidor } from "@/lib/supabase/servidor";
import { textoPlano } from "@/lib/texto-plano";

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
  notas_seguridad?: string[];
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
  return textoPlano(valor);
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
    descripcion: [],
    caracteristicas: [],
    habitat: [],
    distribucion: [],
    alimentacion: [],
    temporada: [],
    conservacion: [],
    distribucion_habitat: [],
  };
  const encabezados: Record<string, string[]> = {
    descripcion: ["descripcion"],
    introduccion: ["descripcion"],
    morfologia: ["caracteristicas"],
    caracteristicas: ["caracteristicas"],
    "descripcion fisica": ["caracteristicas"],
    "descripcion botanica": ["caracteristicas"],
    habitat: ["habitat"],
    distribucion: ["distribucion"],
    "distribucion y habitat": ["distribucion_habitat"],
    "habitat y distribucion": ["distribucion_habitat"],
    "distribucion y ecologia": ["distribucion_habitat"],
    taxonomia: [],
    etimologia: [],
    sinonimia: [],
    referencias: [],
    bibliografia: [],
    "enlaces externos": [],
    alimentacion: ["alimentacion"],
    dieta: ["alimentacion"],
    nutricion: ["alimentacion"],
    usos: ["caracteristicas"],
    "usos y propiedades": ["caracteristicas"],
    propiedades: ["caracteristicas"],
    toxicidad: ["conservacion"],
    peligrosidad: ["conservacion"],
    fenologia: ["temporada"],
    floracion: ["temporada"],
    reproduccion: ["temporada"],
    "ciclo de vida": ["temporada"],
    "estado de conservacion": ["conservacion"],
    conservacion: ["conservacion"],
  };
  let seccionesActivas = ["descripcion"];
  let parrafoActual: string[] = [];

  const guardarParrafo = () => {
    const parrafo = limpiarTextoFuente(parrafoActual.join(" "));
    if (!parrafo) {
      parrafoActual = [];
      return;
    }

    for (const seccion of seccionesActivas) {
      if (seccion in contenido) {
        contenido[seccion].push(parrafo);
      }
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
    if (Object.hasOwn(encabezados, normalizarEtiqueta(lineaLimpia))) {
      guardarParrafo();
      seccionesActivas = clave ?? [];
      continue;
    }

    const pareceEncabezado =
      lineaLimpia.length <= 70 &&
      !/[.!?;:]$/.test(lineaLimpia) &&
      lineaLimpia.split(/\s+/).length <= 8;

    if (pareceEncabezado) {
      guardarParrafo();
      seccionesActivas = [];
      continue;
    }

    parrafoActual.push(lineaLimpia);
  }
  guardarParrafo();

  return {
    descripcion: unirUnicos(contenido.descripcion),
    caracteristicas: unirUnicos(contenido.caracteristicas),
    habitat: unirUnicos([
      ...contenido.habitat,
      ...contenido.distribucion_habitat,
    ]),
    distribucion: unirUnicos(contenido.distribucion),
    alimentacion: unirUnicos(contenido.alimentacion),
    temporada: unirUnicos(contenido.temporada),
    conservacion: unirUnicos(contenido.conservacion),
  };
}

function limpiarTextoFuente(valor: string): string | null {
  const limpio = texto(valor);
  if (!limpio) {
    return null;
  }

  const frases = limpio
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/u)
    .map((frase) => frase.trim())
    .filter(Boolean)
    .filter((frase) => {
      const normalizada = normalizarEtiqueta(frase);
      return !/\b(?:doi:|isbn|issn|pp?\.?\s*\d|vol(?:umen)?\.?\s*\d|revista|journal|bibliografia|referencias|consultado el|recuperado el|descrito por|descrita por|publicado por|nomenclatura|sinonimo de|sinonimia|autoridad taxonomica)\b/i.test(
        normalizada
      ) &&
      !/^\(?[A-ZÁÉÍÓÚÑ][a-záéíóúñ-]+(?:\s+(?:ex|&|and|y)\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ-]+){0,3},?\s+\d{4}\)?\.?$/u.test(
        frase
      );
    });

  return frases.length ? unirUnicos(frases) : null;
}

function llaveDeduplicacion(valor: string): string {
  return normalizarEtiqueta(valor)
    .replace(/[^\p{L}\p{N} ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function unirUnicos(partes: string[]): string {
  const vistos = new Set<string>();
  const unicos: string[] = [];

  for (const parte of partes) {
    for (const frase of parte.split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/u)) {
      const limpia = texto(frase);
      if (!limpia) continue;
      const clave = llaveDeduplicacion(limpia);
      if (!vistos.has(clave)) {
        vistos.add(clave);
        unicos.push(limpia);
      }
    }
  }

  return unicos.join(" ");
}

function extraerFrases(textoFuente: string): string[] {
  return unirUnicos([textoFuente])
    .split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÑ¿¡])/u)
    .map((frase) => limpiarTextoFuente(frase))
    .filter((frase): frase is string => Boolean(frase));
}

function extraerDatosDeTexto(textoFuente: string): {
  habitat: string | null;
  distribucion: string | null;
  caracteristicas: string | null;
} {
  const frases = extraerFrases(textoFuente);
  const esDistribucion = (frase: string) =>
    /\b(?:distribu(?:ye|ida|ido|cion)|nativ[oa] de|originari[oa] de|endemica de|endemico de|se encuentra en|presente en|habita en|argentina|bolivia|brasil|chile|colombia|ecuador|estados unidos|mexico|peru|paraguay|uruguay|sudamerica|norte de|sur de|centro de)\b/i.test(
      normalizarEtiqueta(frase)
    );
  const esHabitat = (frase: string) =>
    /\b(?:habitat|bioma|bosque|matorral|desierto|selva|humedal|zona[s]? rocosas?|pradera|pastizal|sabana|clima (?:templado|tropical|arido|humedo)|vive en|crece en|se desarrolla en|habita en|altitud(?:es)? de)\b/i.test(
      normalizarEtiqueta(frase)
    );
  const esCaracteristica = (frase: string) =>
    /\b(?:alcanza(?:n)? hasta|mide(?:n)? hasta|puede(?:n)? alcanzar|presenta|se caracteriza|tallo[s]?|hoja[s]?|flor(?:es)?|fruto[s]?|espina[s]?|escama[s]?|plumaje|longitud|altura|coloraci[oó]n|morfolog[ií]a|cilindric[oa]s?|globos[oa]s?|blanc[oa]s?|roj[oa]s?|amarill[oa]s?|nocturn[oa]s?)\b/i.test(
      normalizarEtiqueta(frase)
    );
  const distribucion: string[] = [];
  const habitat: string[] = [];
  const caracteristicas: string[] = [];

  for (const frase of frases) {
    if (esDistribucion(frase)) {
      distribucion.push(frase);
    } else if (esHabitat(frase)) {
      habitat.push(frase);
    } else if (esCaracteristica(frase)) {
      caracteristicas.push(frase);
    }
  }

  return {
    habitat: habitat.length ? unirUnicos(habitat.slice(0, 3)) : null,
    distribucion: distribucion.length
      ? unirUnicos(distribucion.slice(0, 3))
      : null,
    caracteristicas: caracteristicas.length
      ? unirUnicos(caracteristicas.slice(0, 4))
      : null,
  };
}

function filtrarFrases(
  textoFuente: string,
  patron: RegExp,
  maxFrases: number
): string | null {
  const frases = extraerFrases(textoFuente).filter((frase) =>
    patron.test(normalizarEtiqueta(frase))
  );
  return frases.length ? unirUnicos(frases.slice(0, maxFrases)) : null;
}

function construirDescripcion(
  partes: Array<string | null | undefined>,
  limite = 250
): string | null {
  const frasesVistas = new Set<string>();
  let descripcion = "";
  const excluirPorRuido =
    /\b(?:taxonomia|sinonim|revista|journal|doi|descrito por|descrita por|publicado por|botanico|botanica|autoridad|siglo (?:xviii|xix|xx|xxi))\b/i;
  const clasificacion = extraerDatosDeTexto(partes.filter(Boolean).join(" "));
  const camposEspecializados = [
    clasificacion.caracteristicas,
    clasificacion.habitat,
    clasificacion.distribucion,
  ]
    .filter((parte): parte is string => Boolean(parte))
    .flatMap(extraerFrases)
    .map(llaveDeduplicacion);

  for (const parte of partes) {
    for (const frase of extraerFrases(parte ?? "")) {
      const clave = llaveDeduplicacion(frase);
      if (
        frasesVistas.has(clave) ||
        excluirPorRuido.test(normalizarEtiqueta(frase)) ||
        camposEspecializados.includes(clave)
      ) {
        continue;
      }

      const candidata = descripcion ? `${descripcion} ${frase}` : frase;
      if (candidata.length > limite) {
        continue;
      }

      frasesVistas.add(clave);
      descripcion = candidata;
      if (frasesVistas.size === 3) {
        return descripcion;
      }
    }
  }

  return descripcion || null;
}

function consolidarTexto(
  partes: Array<string | null | undefined>,
  maxCaracteres = 1800
): string | null {
  const vistos = new Set<string>();
  const seleccionadas: string[] = [];

  for (const parte of partes) {
    for (const frase of extraerFrases(parte ?? "")) {
      const clave = llaveDeduplicacion(frase);
      if (!vistos.has(clave)) {
        vistos.add(clave);
        seleccionadas.push(frase);
      }
    }
  }

  let salida = "";
  for (const frase of seleccionadas) {
    const candidata = salida ? `${salida} ${frase}` : frase;
    if (candidata.length > maxCaracteres) {
      break;
    }
    salida = candidata;
  }

  return salida || null;
}

function hayNegacionAntes(textoFuente: string, indice: number): boolean {
  const antes = normalizarEtiqueta(
    textoFuente.slice(Math.max(0, indice - 45), indice)
  );
  return /\b(?:no es|no resulta|no se considera|no presenta|no contiene|carece de|sin evidencia de|no se ha demostrado que sea)\b(?:\s+\w+){0,4}\s*$/i.test(
    antes
  );
}

function detectarSeguridad(textoFuente: string): {
  peligrosa: boolean | null;
  toxica: boolean | null;
  venenosa: boolean | null;
  protegida: boolean | null;
  notas: string[];
} {
  const notas: string[] = [];
  const detectar = (patron: RegExp) => {
    for (const coincidencia of textoFuente.matchAll(patron)) {
      if (!hayNegacionAntes(textoFuente, coincidencia.index ?? 0)) {
        return true;
      }
    }
    return false;
  };
  const toxica = detectar(
    /\b(?:t[oó]xic[oa]s?|venen[oa]s?|veneno|irritante[s]?|nociv[oa]s?|psicoactiv[oa]s?|alucin[oó]gen[oa]s?|ingerir(?:la|lo)?\s+(?:es\s+)?peligros[oa])\b/giu
  );
  const mencionaAlcaloides = detectar(/\balcaloides?\b/giu);
  const venenosa = detectar(
    /\b(?:venen[oa]s?|veneno|veneno[s]? potente[s]?|neurotoxina[s]?)\b/giu
  );
  const peligrosa = detectar(
    /\b(?:espinas? agudas?|mordedura[s]?|picadura[s]?|agresiv[oa]s?|alerg[eé]nic[oa]s?|irritante[s]?|peligro(?:so|sa)s?)\b/giu
  );
  const protegida = detectar(
    /\b(?:especie[s]? protegida[s]?|protegida[s]? por (?:la )?(?:ley|legislaci[oó]n|normativa)|protecci[oó]n legal)\b/giu
  );

  if (toxica) {
    notas.push(
      "La fuente consultada describe toxicidad o efectos nocivos; evita ingerirla o manipularla sin orientación experta."
    );
  } else if (mencionaAlcaloides) {
    notas.push(
      "La fuente menciona alcaloides; su presencia no determina por sí sola el riesgo ni la dosis peligrosa."
    );
  }
  if (venenosa) {
    notas.push(
      "La fuente menciona veneno o sustancias venenosas; evita el contacto directo."
    );
  }
  if (peligrosa && !toxica) {
    notas.push(
      "La fuente menciona un posible riesgo físico o alergénico; mantén distancia y consulta una fuente especializada."
    );
  }
  if (protegida) {
    notas.push(
      "La fuente indica protección legal; verifica la normativa local antes de manipular o recolectar ejemplares."
    );
  }

  return {
    peligrosa: peligrosa || toxica ? true : null,
    toxica: toxica || mencionaAlcaloides ? true : null,
    venenosa: venenosa ? true : null,
    protegida: protegida ? true : null,
    notas,
  };
}

async function consultarWikipedia(
  scientificName: string
): Promise<Record<string, unknown> | null> {
  const nombreLimpio = texto(scientificName) ?? scientificName.trim();
  const palabrasTaxonomicas = nombreLimpio
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const variantesBusqueda = Array.from(
    new Set([
      nombreLimpio,
      palabrasTaxonomicas.slice(0, 2).join(" "),
    ].filter(Boolean))
  );

  for (const variante of variantesBusqueda) {
    const busquedaUrl = new URL("https://es.wikipedia.org/w/api.php");
    busquedaUrl.search = new URLSearchParams({
      action: "query",
      list: "search",
      srsearch: `"${variante}"`,
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
    const articuloExacto = resultados.find(
      (resultado) =>
        typeof resultado.title === "string" &&
        normalizarEtiqueta(resultado.title) ===
          normalizarEtiqueta(variante)
    );
    const articuloRelacionado = resultados.find((resultado) => {
      const titulo = texto(resultado.title);
      const fragmento = texto(resultado.snippet);
      const nombreNormalizado = normalizarEtiqueta(variante);
      return Boolean(
        titulo &&
          (normalizarEtiqueta(titulo).startsWith(nombreNormalizado) ||
            (fragmento &&
              normalizarEtiqueta(fragmento).includes(nombreNormalizado)))
      );
    });
    const articulo = articuloExacto ?? articuloRelacionado;
    const titulo = texto(articulo?.title);

    if (!titulo) {
      continue;
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

    if (pagina) {
      return pagina;
    }
  }

  return null;
}

async function consultarWikidata(
  scientificName: string
): Promise<string | null> {
  const busquedaUrl = new URL(
    "https://www.wikidata.org/w/api.php"
  );
  busquedaUrl.search = new URLSearchParams({
    action: "wbsearchentities",
    search: scientificName,
    language: "es",
    uselang: "es",
    type: "item",
    limit: "5",
    format: "json",
  }).toString();
  const respuesta = await consultarApi(
    busquedaUrl.toString(),
    "la búsqueda de taxones en Wikidata"
  );
  const resultados = Array.isArray(respuesta?.search)
    ? respuesta.search.filter(esRegistro)
    : [];
  const nombreNormalizado = normalizarEtiqueta(scientificName);
  const entidad = resultados.find(
      (resultado) =>
        normalizarEtiqueta(texto(resultado.label) ?? "") ===
        nombreNormalizado
    ) ??
    resultados.find(
      (resultado) =>
        esRegistro(resultado.match) &&
        normalizarEtiqueta(texto(resultado.match.text) ?? "") ===
          nombreNormalizado
    );
  const descripcion = texto(entidad?.description);

  return descripcion && descripcion.length >= 35 ? descripcion : null;
}

async function consultarGBIF(
  scientificName: string
): Promise<{
  taxon: Record<string, unknown> | null;
  distribuciones: Record<string, unknown>[];
}> {
  const nombreCanonico = (texto(scientificName) ?? scientificName)
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
  let match: Record<string, unknown> | null = null;

  for (const nombre of Array.from(new Set([scientificName, nombreCanonico]))) {
    const matchUrl = new URL("https://api.gbif.org/v1/species/match");
    matchUrl.searchParams.set("name", nombre);
    matchUrl.searchParams.set("strict", "true");

    match = await consultarApi(
      matchUrl.toString(),
      "la API de taxonomía de GBIF"
    );
    if (typeof match?.confidence === "number" && match.confidence >= 90) {
      break;
    }
  }

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
    ? Array.from(nombres).slice(0, 8).join(", ")
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

  const [
    respuestaTaxon,
    resumenWikipedia,
    datosGBIF,
    descripcionWikidata,
  ] = await Promise.all([
    consultarApi(taxonUrl.toString(), "la API de taxa de iNaturalist"),
    consultarWikipedia(scientificName),
    consultarGBIF(scientificName),
    consultarWikidata(scientificName),
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
  const extractoCombinado = [extractoWikipedia, resumenINaturalist]
    .filter((parte): parte is string => Boolean(parte))
    .join("\n\n");
  const fuenteDatosTecnicos = [
    extractoCombinado,
    seccionesWikipedia.habitat,
    seccionesWikipedia.distribucion,
    seccionesWikipedia.distribucion_habitat,
    seccionesWikipedia.caracteristicas,
  ]
    .filter(Boolean)
    .join("\n\n");
  const datosTexto = extraerDatosDeTexto(fuenteDatosTecnicos);
  const habitatWiki = consolidarTexto(
    [
      filtrarFrases(
        seccionesWikipedia.habitat,
        /\b(?:habitat|bioma|bosque|matorral|desierto|selva|humedal|zona[s]? rocosas?|pradera|pastizal|sabana|clima|vive en|crece en|se desarrolla en|habita en|altitud)\b/i,
        3
      ),
      datosTexto.habitat,
    ],
    450
  );
  const caracteristicasWiki = consolidarTexto(
    [
      filtrarFrases(
        seccionesWikipedia.caracteristicas,
        /\b(?:alcanza|mide|altura|longitud|tallo|hoja|flor|fruto|espina|escama|plumaje|color|morfolog|cilindric|globos|blanc|roj|amarill|nocturn)\w*/i,
        4
      ),
      datosTexto.caracteristicas,
    ],
    600
  );
  const distribucionWiki = consolidarTexto(
    [
      filtrarFrases(
        seccionesWikipedia.distribucion,
        /\b(?:distribu|nativ[oa]|originari[oa]|endemica|endemico|se encuentra en|presente en|argentina|bolivia|brasil|chile|colombia|ecuador|estados unidos|mexico|peru|paraguay|uruguay|sudamerica|norte de|sur de|centro de)\b/i,
        4
      ),
      datosTexto.distribucion,
    ],
    450
  );
  const descripcionConsolidada = construirDescripcion(
    [
      seccionesWikipedia.descripcion,
      resumenINaturalist,
      descripcionWikidata,
    ],
    250
  );
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
  const corpusSeguridad = [
    extractoWikipedia,
    resumenINaturalist,
    descripcionWikidata,
    seccionesWikipedia.conservacion,
  ]
    .filter((parte): parte is string => Boolean(parte))
    .join("\n");
  const seguridad = detectarSeguridad(corpusSeguridad);
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
    descripcion: descripcionConsolidada,
    habitat: habitatWiki,
    distribucion: consolidarTexto(
      [distribucionWiki, distribucionGBIF],
      450
    ),
    alimentacion: texto(seccionesWikipedia.alimentacion),
    temporada: texto(seccionesWikipedia.temporada),
    caracteristicas: texto(caracteristicasWiki),
    nivel_riesgo: estadoConservacion,
    estado_conservacion: estadoConservacion,
    peligrosa: seguridad.peligrosa,
    toxica: seguridad.toxica,
    venenosa: seguridad.venenosa,
    protegida: seguridad.protegida,
    ...(seguridad.notas.length
      ? { notas_seguridad: seguridad.notas }
      : {}),
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
      {
        code: errorInsercion.code,
        message: errorInsercion.message,
        details: errorInsercion.details,
        hint: errorInsercion.hint,
      }
    );
    return especie;
  }

  return {
    ...especie,
    id: insertada.activa ? String(insertada.id) : null,
  };
}
