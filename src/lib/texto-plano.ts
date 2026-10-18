const ENTIDADES_HTML: Record<string, string> = {
  amp: "&",
  AMP: "&",
  apos: "'",
  bull: "•",
  copy: "©",
  eacute: "é",
  Eacute: "É",
  aacute: "á",
  Aacute: "Á",
  iacute: "í",
  Iacute: "Í",
  oacute: "ó",
  Oacute: "Ó",
  uacute: "ú",
  Uacute: "Ú",
  ntilde: "ñ",
  Ntilde: "Ñ",
  uuml: "ü",
  Uuml: "Ü",
  iexcl: "¡",
  iquest: "¿",
  hellip: "…",
  ldquo: "“",
  lsquo: "‘",
  mdash: "—",
  nbsp: " ",
  ndash: "–",
  quot: '"',
  rdquo: "”",
  reg: "®",
  rsquo: "’",
  lt: "<",
  LT: "<",
  gt: ">",
  GT: ">",
  QUOT: '"',
};

function decodificarEntidad(entidad: string): string {
  const numerica = entidad.match(/^&#(?:x([0-9a-f]+)|([0-9]+));$/i);

  if (numerica) {
    const codigo = numerica[1]
      ? Number.parseInt(numerica[1], 16)
      : Number.parseInt(numerica[2], 10);

    return Number.isSafeInteger(codigo) && codigo > 0 && codigo <= 0x10ffff
      ? String.fromCodePoint(codigo)
      : "";
  }

  const nombrada = entidad.match(/^&([a-z]+);$/i);
  return nombrada
    ? ENTIDADES_HTML[nombrada[1]] ?? entidad
    : entidad;
}

function normalizarEspacios(valor: string): string {
  return valor
    .split(/\r?\n/)
    .map((linea) => linea.replace(/[ \t\f\v]+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

function esTextoGenerico(valor: string): boolean {
  const normalizado = valor
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[.!:]+$/g, "")
    .toLocaleLowerCase("es");

  return [
    "no se encontro informacion",
    "no se encontro informacion en las fuentes consultadas",
    "sin datos publicados",
    "informacion pendiente",
    "pendiente",
    "no disponible",
    "datos no disponibles",
  ].includes(normalizado);
}

export function textoPlano(valor: unknown): string | null {
  if (typeof valor !== "string") {
    return null;
  }

  let limpio = valor;
  for (let intento = 0; intento < 2; intento += 1) {
    limpio = limpio.replace(
      /&(?:#(?:x[0-9a-f]+|[0-9]+)|[a-z]+);/gi,
      decodificarEntidad
    );
  }

  limpio = limpio
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\/\s*(?:p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]*>/g, " ");

  const texto = normalizarEspacios(limpio);
  return texto && !esTextoGenerico(texto) ? texto : null;
}
