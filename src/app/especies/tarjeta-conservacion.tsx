type EstadoConservacion = {
  codigo: string;
  nombre: string;
  resumen: string;
  estilo: string;
};

type IndicadorSeguridad = {
  nombre: string;
  valor: boolean | null | undefined;
};

type TarjetaConservacionProps = {
  nivelRiesgo?: string | null;
  estadoConservacion?: string | null;
  indicadores?: IndicadorSeguridad[];
  notas?: string[];
};

const ESTADOS: Record<string, EstadoConservacion> = {
  least_concern: {
    codigo: "LC",
    nombre: "Preocupación menor",
    resumen:
      "La evaluación disponible la ubica en una categoría de menor preocupación; esto no descarta amenazas locales.",
    estilo: "border-emerald-300/25 bg-emerald-300/10 text-emerald-100",
  },
  near_threatened: {
    codigo: "NT",
    nombre: "Casi amenazada",
    resumen: "Está cerca de cumplir los criterios de una categoría amenazada.",
    estilo: "border-yellow-300/25 bg-yellow-300/10 text-yellow-100",
  },
  vulnerable: {
    codigo: "VU",
    nombre: "Vulnerable",
    resumen:
      "La evaluación indica un riesgo alto de extinción en estado silvestre.",
    estilo: "border-orange-300/25 bg-orange-300/10 text-orange-100",
  },
  endangered: {
    codigo: "EN",
    nombre: "En peligro",
    resumen:
      "La evaluación indica un riesgo muy alto de extinción en estado silvestre.",
    estilo: "border-orange-400/25 bg-orange-400/10 text-orange-100",
  },
  critically_endangered: {
    codigo: "CR",
    nombre: "En peligro crítico",
    resumen:
      "La evaluación indica un riesgo extremadamente alto de extinción en estado silvestre.",
    estilo: "border-red-300/25 bg-red-300/10 text-red-100",
  },
  extinct_in_the_wild: {
    codigo: "EW",
    nombre: "Extinta en estado silvestre",
    resumen:
      "Solo se conoce su supervivencia bajo cuidado humano o fuera de su distribución natural.",
    estilo: "border-slate-300/25 bg-slate-300/10 text-slate-100",
  },
  extinct: {
    codigo: "EX",
    nombre: "Extinta",
    resumen: "No se conocen individuos vivos de esta especie.",
    estilo: "border-slate-300/25 bg-slate-300/10 text-slate-100",
  },
  data_deficient: {
    codigo: "DD",
    nombre: "Datos insuficientes",
    resumen: "No hay información suficiente para evaluar su riesgo.",
    estilo: "border-sky-300/25 bg-sky-300/10 text-sky-100",
  },
  not_evaluated: {
    codigo: "NE",
    nombre: "No evaluada",
    resumen: "No cuenta con una evaluación de conservación registrada.",
    estilo: "border-slate-300/25 bg-slate-300/10 text-slate-100",
  },
};

const ALIAS_ESTADOS: Record<string, string> = {
  lc: "least_concern",
  preocupacion_menor: "least_concern",
  nt: "near_threatened",
  casi_amenazada: "near_threatened",
  vu: "vulnerable",
  en: "endangered",
  en_peligro: "endangered",
  cr: "critically_endangered",
  en_peligro_critico: "critically_endangered",
  ew: "extinct_in_the_wild",
  extinta_en_estado_silvestre: "extinct_in_the_wild",
  ex: "extinct",
  extinta: "extinct",
  dd: "data_deficient",
  datos_insuficientes: "data_deficient",
  ne: "not_evaluated",
  no_evaluada: "not_evaluated",
};

function normalizarClave(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\([^)]*\)/g, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");
}

function normalizarEstado(valor: string | null | undefined) {
  if (!valor?.trim()) {
    return null;
  }

  const clave = normalizarClave(valor);
  const canonica = ALIAS_ESTADOS[clave] ?? clave;

  return {
    clave: canonica,
    estado: ESTADOS[canonica] ?? null,
    etiqueta:
      ESTADOS[canonica]?.nombre ??
      clave
        .split("_")
        .map((palabra) => palabra.charAt(0).toUpperCase() + palabra.slice(1))
        .join(" "),
  };
}

export default function TarjetaConservacion({
  nivelRiesgo,
  estadoConservacion,
  indicadores = [],
  notas = [],
}: TarjetaConservacionProps) {
  const estado = normalizarEstado(estadoConservacion);
  const nivel = normalizarEstado(nivelRiesgo);
  const nivelDistinto = nivel && nivel.clave !== estado?.clave;
  const indicadoresDisponibles = indicadores.filter(
    (indicador) => typeof indicador.valor === "boolean"
  );
  const hayDatos =
    estado || nivelDistinto || indicadoresDisponibles.length > 0 || notas.length > 0;

  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
      <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-300">
        Información registrada
      </p>
      <h2 className="mt-3 text-xl font-semibold tracking-tight">
        Conservación y seguridad
      </h2>

      <div className="mt-5 border-t border-white/10 pt-5">
        {estado ? (
          <>
            <p className="text-xs font-medium text-slate-500">
              Estado de conservación
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium ${
                  estado.estado?.estilo ??
                  "border-white/15 bg-white/5 text-slate-200"
                }`}
              >
                {estado.estado?.codigo && (
                  <span className="text-[10px] font-semibold tracking-wide opacity-75">
                    {estado.estado.codigo}
                  </span>
                )}
                {estado.etiqueta}
              </span>
              <span className="text-xs text-slate-500">
                Categoría de conservación
              </span>
            </div>
            {estado.estado && (
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {estado.estado.resumen}
              </p>
            )}
          </>
        ) : (
          <div>
            <p className="text-xs font-medium text-slate-500">
              Estado de conservación
            </p>
            <p className="mt-2 text-sm text-slate-400">
              No se encontró un estado de conservación registrado.
            </p>
          </div>
        )}
      </div>

      {nivelDistinto && (
        <div className="mt-5 border-t border-white/10 pt-5">
          <p className="text-xs font-medium text-slate-500">
            Otro nivel de riesgo registrado
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-300">
            {nivel.etiqueta}
          </p>
        </div>
      )}

      {indicadoresDisponibles.length > 0 && (
        <div className="mt-5 border-t border-white/10 pt-5">
          <p className="text-xs font-medium text-slate-500">
            Indicadores de seguridad
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-3">
            {indicadoresDisponibles.map(({ nombre, valor }) => (
              <div
                key={nombre}
                className="rounded-2xl border border-white/10 bg-black/10 p-4"
              >
                <dt className="text-xs text-slate-500">{nombre}</dt>
                <dd
                  className={`mt-2 text-sm font-medium ${
                    valor ? "text-amber-100" : "text-slate-300"
                  }`}
                >
                  {valor ? "Sí" : "No"}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Estos indicadores reflejan lo registrado en la ficha; la ausencia
            de una alerta no descarta otros riesgos.
          </p>
        </div>
      )}

      {notas.length > 0 && (
        <ul className="mt-5 space-y-2 border-t border-white/10 pt-5 text-sm leading-6 text-amber-100/80">
          {notas.map((nota) => (
            <li key={nota}>{nota}</li>
          ))}
        </ul>
      )}

      {!hayDatos && (
        <p className="mt-5 border-t border-white/10 pt-5 text-sm leading-6 text-slate-400">
          Aún no hay datos registrados sobre amenazas o seguridad. Consulta las
          fuentes antes de manipular ejemplares.
        </p>
      )}
    </section>
  );
}
