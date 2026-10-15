import Image from "next/image";
import Link from "next/link";
import { obtenerDetallesEspecieExterna } from "@/lib/identificaciones/enriquecerEspecie";

type Contexto = {
  params: Promise<{ taxonId: string }>;
  searchParams: Promise<{ nombre?: string | string[] }>;
};

function texto(valor: string | null) {
  return valor || "No se encontró información en las fuentes consultadas.";
}

function indicador(valor: boolean | null) {
  if (valor === true) return "Sí";
  if (valor === false) return "No";
  return "Sin datos publicados";
}

export default async function PaginaEspecieINaturalist({
  params,
  searchParams,
}: Contexto) {
  const [{ taxonId: taxonIdParametro }, parametros] = await Promise.all([
    params,
    searchParams,
  ]);
  const nombreParametro = parametros.nombre;
  const taxonId = Number(taxonIdParametro);
  const nombreCientifico = Array.isArray(nombreParametro)
    ? nombreParametro[0]
    : nombreParametro;

  let especie = null;
  let error = "";

  if (
    !/^[1-9]\d{0,14}$/.test(taxonIdParametro) ||
    !Number.isSafeInteger(taxonId)
  ) {
    error = "El identificador de iNaturalist no es válido.";
  } else if (
    !nombreCientifico ||
    nombreCientifico.length > 150 ||
    !/^[\p{L}\p{M}\p{N} .'-]+$/u.test(nombreCientifico)
  ) {
    error = "El nombre científico no es válido.";
  } else {
    try {
      especie = await obtenerDetallesEspecieExterna(
        taxonId,
        nombreCientifico
      );
    } catch (fallo) {
      console.error(
        "Error al cargar la ficha externa de iNaturalist:",
        fallo instanceof Error ? fallo.message : "Error desconocido"
      );
      error = "No se pudieron cargar los detalles de esta especie.";
    }
  }

  const taxonomia = especie
    ? [
        ["Reino", especie.taxonomia.reino],
        ["Filo / división", especie.taxonomia.filo_division],
        ["Clase", especie.taxonomia.clase],
        ["Orden", especie.taxonomia.orden],
        ["Familia", especie.taxonomia.familia],
        ["Género", especie.taxonomia.genero],
        ["Especie", especie.taxonomia.especie],
      ]
    : [];
  const riesgos: Array<[string, boolean | null]> = especie
    ? [
        ["Peligrosa", especie.peligrosa],
        ["Tóxica", especie.toxica],
        ["Venenosa", especie.venenosa],
        ["Protegida", especie.protegida],
      ]
    : [];

  return (
    <main className="min-h-screen bg-[#071411] text-slate-100">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5 lg:px-10">
          <Link href="/" className="rounded-lg">
            <span className="block text-sm font-semibold tracking-tight">
              NATURA GO
            </span>
            <span className="block text-[10px] uppercase tracking-[0.28em] text-emerald-200/60">
              Puebla
            </span>
          </Link>
          <Link
            href="/identificar"
            className="rounded-full border border-white/15 px-4 py-2.5 text-xs font-medium transition hover:bg-white/5 sm:text-sm"
          >
            ← Volver a identificar
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10 lg:py-14">
        {error || !especie ? (
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-8">
            <h1 className="text-2xl font-semibold">
              No se pudo mostrar la ficha.
            </h1>
            <p role="alert" className="mt-4 text-sm leading-6 text-slate-400">
              {error || "La especie no está disponible."}
            </p>
          </section>
        ) : (
          <>
            <div className="mb-8">
              <span className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs text-emerald-200">
                {especie.tipo === "PLANTA"
                  ? "Flora · Planta"
                  : especie.tipo === "ANIMAL"
                    ? "Fauna · Animal"
                    : "Especie identificada"}
              </span>
              <h1 className="mt-5 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                {especie.nombre_comun}
              </h1>
              <p className="mt-3 text-lg italic text-emerald-200/70 sm:text-xl">
                {especie.nombre_cientifico}
              </p>
            </div>

            <div className="grid items-start gap-8 lg:grid-cols-[1.3fr_1fr]">
              <div>
                <figure className="relative aspect-[4/3] overflow-hidden rounded-[2rem] border border-white/10 bg-[#10241b]">
                  {especie.imagen_url ? (
                    <Image
                      src={especie.imagen_url}
                      alt={`Imagen de ${especie.nombre_comun}`}
                      fill
                      unoptimized
                      sizes="(max-width: 1024px) 100vw, 60vw"
                      className="object-cover"
                    />
                  ) : (
                    <figcaption className="flex h-full items-center justify-center text-sm text-emerald-200/50">
                      Imagen no disponible
                    </figcaption>
                  )}
                  {especie.imagen_url && (
                    <figcaption className="border-t border-white/10 px-6 py-4 text-xs leading-6 text-slate-400">
                      Imagen: iNaturalist
                    </figcaption>
                  )}
                </figure>

                <div className="mt-8 grid gap-5 sm:grid-cols-2">
                  <Bloque
                    titulo="Sobre esta especie"
                    valor={especie.descripcion}
                    amplio
                  />
                  <Bloque titulo="Hábitat" valor={especie.habitat} />
                  <Bloque
                    titulo="Distribución"
                    valor={especie.distribucion}
                  />
                  <Bloque
                    titulo="Características"
                    valor={especie.caracteristicas}
                    amplio
                  />
                  <Bloque
                    titulo="Alimentación"
                    valor={especie.alimentacion}
                  />
                  <Bloque titulo="Temporada" valor={especie.temporada} />
                </div>
              </div>

              <aside
                aria-label="Clasificación y conservación"
                className="space-y-6"
              >
                <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-300">
                    Identidad biológica
                  </p>
                  <h2 className="mt-3 text-xl font-semibold tracking-tight">
                    Clasificación taxonómica
                  </h2>
                  <dl className="mt-5 divide-y divide-white/10">
                    {taxonomia.map(([etiqueta, valor]) => (
                      <div
                        key={etiqueta}
                        className="grid grid-cols-[1fr_1.2fr] gap-4 py-3 text-sm leading-6"
                      >
                        <dt className="text-slate-500">{etiqueta}</dt>
                        <dd className="break-words text-slate-200">
                          {texto(valor)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </section>

                <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-300">
                    Información registrada
                  </p>
                  <h2 className="mt-3 text-xl font-semibold tracking-tight">
                    Riesgo y conservación
                  </h2>
                  <dl className="mt-5 grid grid-cols-2 gap-3">
                    {riesgos.map(([etiqueta, valor]) => (
                      <div
                        key={String(etiqueta)}
                        className="rounded-2xl border border-white/10 bg-black/10 p-4"
                      >
                        <dt className="text-xs text-slate-500">
                          {String(etiqueta)}
                        </dt>
                        <dd className="mt-2 text-sm font-medium text-emerald-100">
                          {indicador(valor)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-5 space-y-4 border-t border-white/10 pt-5">
                    <div>
                      <h3 className="text-xs font-medium text-slate-500">
                        Nivel de riesgo
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {texto(especie.nivel_riesgo)}
                      </p>
                    </div>
                    <div>
                      <h3 className="text-xs font-medium text-slate-500">
                        Estado de conservación
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {texto(especie.estado_conservacion)}
                      </p>
                    </div>
                  </div>
                </section>

                <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
                  <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-300">
                    Fuente de información
                  </p>
                  <h2 className="mt-3 text-xl font-semibold tracking-tight">
                    Fuentes y referencias
                  </h2>
                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    Datos taxonómicos e imagen proporcionados por iNaturalist.
                    La descripción puede incluir información de Wikipedia en
                    español. La distribución y el estado de conservación
                    también pueden incluir registros de GBIF.
                  </p>
                  <a
                    href={`https://www.inaturalist.org/taxa/${taxonId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex rounded-full border border-emerald-300/25 px-4 py-2.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-300/10"
                  >
                    Consultar en iNaturalist ↗
                  </a>
                </section>
              </aside>
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function Bloque({
  titulo,
  valor,
  amplio = false,
}: {
  titulo: string;
  valor: string | null;
  amplio?: boolean;
}) {
  return (
    <section
      className={`rounded-3xl border border-white/10 bg-white/[0.025] p-6 ${
        amplio ? "sm:col-span-2" : ""
      }`}
    >
      <h2 className="text-lg font-semibold tracking-tight">{titulo}</h2>
      <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-400">
        {texto(valor)}
      </p>
    </section>
  );
}
