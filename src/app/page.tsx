"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import HeroCarrusel from "@/app/ui/hero-carrusel";

type Tipo = "TODAS" | "PLANTA" | "ANIMAL";

type ImagenEspecie = {
  id: number;
  imagen_url: string;
  autor: string | null;
  licencia: string | null;
  fuente_url: string | null;
  licencia_url: string | null;
  es_principal: boolean;
};

type Especie = {
  id: number;
  nombre_comun: string;
  nombre_cientifico: string;
  tipo: "PLANTA" | "ANIMAL";
  descripcion: string | null;
  habitat: string | null;
  imagenes_especies: ImagenEspecie[];
};

const filtros: { valor: Tipo; etiqueta: string }[] = [
  { valor: "TODAS", etiqueta: "Todas" },
  { valor: "PLANTA", etiqueta: "Plantas" },
  { valor: "ANIMAL", etiqueta: "Animales" },
];

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export default function Home() {
  const [especies, setEspecies] = useState<Especie[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [tipo, setTipo] = useState<Tipo>("TODAS");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);
  useEffect(() => {
    const controlador = new AbortController();

    async function cargarCatalogo() {
      try {
        const respuesta = await fetch("/api/especies", {
          cache: "no-store",
          signal: controlador.signal,
        });

        if (!respuesta.ok) {
          throw new Error("No se pudo consultar el catálogo.");
        }

        const datos = await respuesta.json();

        if (!Array.isArray(datos.especies)) {
          throw new Error("El catálogo devolvió una respuesta inesperada.");
        }

        if (!controlador.signal.aborted) {
          setEspecies(datos.especies);
          setError("");
        }
      } catch {
        if (!controlador.signal.aborted) {
          setError(
            "No pudimos cargar las especies. Revisa tu conexión e intenta nuevamente."
          );
        }
      } finally {
        if (!controlador.signal.aborted) {
          setCargando(false);
        }
      }
    }

    void cargarCatalogo();

    return () => controlador.abort();
  }, [intento]);

  const consulta = normalizar(busqueda);

  const visibles = especies.filter((especie) => {
    const coincideTipo = tipo === "TODAS" || especie.tipo === tipo;

    const coincideNombre = normalizar(
      `${especie.nombre_comun} ${especie.nombre_cientifico}`
    ).includes(consulta);

    return coincideTipo && coincideNombre;
  });

  const plantas = especies.filter((especie) => especie.tipo === "PLANTA").length;
  const animales = especies.filter((especie) => especie.tipo === "ANIMAL").length;

  function reintentar() {
    setCargando(true);
    setError("");
    setIntento((valor) => valor + 1);
  }

  return (
    <main className="min-h-screen bg-[#071411] text-slate-100">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-5 px-6 py-5 lg:px-10">
          <Link
            href="/"
            aria-label="Natura Go, inicio"
            className="flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-300">
              <Hoja />
            </span>

            <span>
              <span className="block text-sm font-semibold tracking-tight">
                NATURA GO
              </span>
              <span className="block text-[10px] uppercase tracking-[0.28em] text-emerald-200/60">
                Puebla
              </span>
            </span>
          </Link>

          <nav
            aria-label="Navegación principal"
            className="flex flex-wrap items-center gap-2"
          >
            <Link
              href="/identificar"
              className="rounded-full px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-emerald-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300"
            >
              Subir fotografía
            </Link>

            <Link
              href="/historial"
              className="rounded-full px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-emerald-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300"
            >
              Mi historial
            </Link>

            <Link
              href="/perfil"
              className="rounded-full px-4 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-emerald-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300"
            >
              Mi perfil
            </Link>

            <Link
              href="/login"
              className="rounded-full border border-white/15 px-5 py-2.5 text-sm font-medium transition hover:border-emerald-300/40 hover:bg-emerald-300/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300"
            >
              Mi cuenta
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 lg:px-10">
        <section className="relative grid gap-10 py-14 lg:grid-cols-[1.15fr_1fr] lg:items-center lg:gap-16 lg:py-20">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -left-32 top-0 h-80 w-80 rounded-full bg-emerald-500/10 blur-[100px]"
          />

          <div className="relative">
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/5 px-3 py-1.5 text-xs text-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              DISCOVER THE WILD
            </p>

            <h1 className="max-w-xl text-5xl font-semibold leading-[1.08] tracking-tight sm:text-6xl">
              La naturaleza
              <br />
              está más cerca
              <br />
              <span className="text-emerald-300">de lo que crees.</span>
            </h1>

            <p className="mt-6 max-w-lg text-base leading-7 text-slate-400">
              Explora nuestro catálogo de plantas y animales relacionados
              con Puebla. Descubre sus características, hábitats y
              clasificación.
            </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#catalogo"
              className="inline-flex items-center gap-3 rounded-full bg-emerald-300 px-6 py-3.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300"
            >
              Explorar especies
              <span aria-hidden="true">↓</span>
            </a>

            <Link
              href="/identificar"
              className="inline-flex items-center gap-3 rounded-full border border-emerald-300/25 bg-emerald-300/5 px-6 py-3.5 text-sm font-semibold text-emerald-100 transition hover:border-emerald-300/50 hover:bg-emerald-300/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300"
            >
              Subir fotografía
              <span aria-hidden="true">↗</span>
            </Link>
          </div>

          <p className="mt-4 max-w-lg text-xs leading-6 text-slate-500">
          Explora especies del catálogo regional o identifica otras con tu
          cámara.
          </p>
          </div>

          <HeroCarrusel />
        </section>

        <section
          aria-label="Resumen del catálogo"
          className="grid grid-cols-3 divide-x divide-white/10 rounded-3xl border border-white/10 bg-white/[0.025] py-6"
        >
          {[
            { etiqueta: "Especies ref.", valor: especies.length },
            { etiqueta: "Plantas ref.", valor: plantas },
            { etiqueta: "Animales ref.", valor: animales },
          ].map((dato) => (
            <div key={dato.etiqueta} className="px-3 text-center">
              <p className="text-3xl font-semibold tracking-tight text-emerald-200">
                {cargando || error ? "—" : dato.valor}
              </p>
              <p className="mt-1 text-xs text-slate-400 sm:text-sm">
                {dato.etiqueta}
              </p>
            </div>
          ))}
        </section>
        <p className="mt-3 text-center text-xs text-slate-500">
          Cifras del catálogo de referencia; no representan el total de
          especies que puedes explorar o identificar.
        </p>

        <section id="catalogo" className="scroll-mt-6 py-14">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.25em] text-emerald-300">
              Nuestro entorno
            </p>

            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Encuentra tu próxima curiosidad.
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-400">
              Selecciona una especie para abrir su ficha en una nueva pestaña.
            </p>
          </div>

          <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div
              role="group"
              aria-label="Filtrar por tipo de especie"
              className="flex w-fit gap-1 rounded-full border border-white/10 bg-white/[0.03] p-1"
            >
              {filtros.map((filtro) => (
                <button
                  key={filtro.valor}
                  type="button"
                  aria-pressed={tipo === filtro.valor}
                  onClick={() => setTipo(filtro.valor)}
                  className={`rounded-full px-5 py-2.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-emerald-300 ${
                    tipo === filtro.valor
                      ? "bg-emerald-300 text-emerald-950"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {filtro.etiqueta}
                </button>
              ))}
            </div>

            <div className="w-full lg:max-w-md">
              <label htmlFor="buscar" className="sr-only">
                Buscar por nombre común o científico
              </label>

              <input
                id="buscar"
                type="search"
                placeholder="Buscar por nombre común o científico…"
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                maxLength={100}
                className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-300/50 focus:ring-4 focus:ring-emerald-300/10"
              />
              <p className="mt-2 text-xs leading-5 text-slate-500">
                ¿No encuentras la especie que buscas?{" "}
                <Link
                  href="/identificar"
                  className="text-slate-400 underline decoration-white/20 underline-offset-4 transition hover:text-emerald-200"
                >
                  Usa la cámara para identificar cualquier otra.
                </Link>
              </p>
            </div>
          </div>

          {cargando ? (
            <div>
              <p role="status" className="mb-5 text-sm text-slate-400">
                Cargando catálogo…
              </p>

              <div
                aria-hidden="true"
                className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
              >
                {Array.from({ length: 6 }, (_, indice) => (
                  <div
                    key={indice}
                    className="h-96 rounded-3xl border border-white/10 bg-white/5 motion-safe:animate-pulse"
                  />
                ))}
              </div>
            </div>
          ) : error ? (
            <div
              role="alert"
              className="rounded-3xl border border-rose-300/20 bg-rose-400/5 p-8"
            >
              <p className="text-sm leading-6 text-rose-200">{error}</p>

              <button
                type="button"
                onClick={reintentar}
                className="mt-5 rounded-full bg-emerald-300 px-5 py-2.5 text-sm font-semibold text-emerald-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300"
              >
                Volver a intentar
              </button>
            </div>
          ) : (
            <>
              <p
                role="status"
                className="mb-5 text-xs tracking-wide text-slate-400"
              >
                {visibles.length} de {especies.length} especies
              </p>

              {visibles.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-white/15 p-10 text-center">
                  <h3 className="text-lg font-medium">
                    No encontramos coincidencias.
                  </h3>

                  <p className="mt-2 text-sm text-slate-400">
                    Prueba otro nombre o cambia el filtro.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      setBusqueda("");
                      setTipo("TODAS");
                    }}
                    className="mt-5 rounded-full border border-emerald-300/30 px-5 py-2.5 text-sm text-emerald-200 hover:bg-emerald-300/10 focus-visible:outline-2 focus-visible:outline-emerald-300"
                  >
                    Limpiar filtros
                  </button>
                </div>
              ) : (
                <div className="grid items-start gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  {visibles.map((especie) => (
                    <Tarjeta key={especie.id} especie={especie} />
                  ))}
                </div>
              )}
            </>
          )}
        </section>

        <footer className="flex flex-col gap-3 border-t border-white/10 py-8 text-xs leading-5 text-slate-500 sm:flex-row sm:justify-between">
          <p>NATURA GO · Flora y fauna de Puebla</p>
          <p>EXPLORA. IDENTIFICA. PROTEGE.</p>
        </footer>
      </div>
    </main>
  );
}

function Tarjeta({ especie }: { especie: Especie }) {
  const imagen = especie.imagenes_especies.find(
    (elemento) => elemento.es_principal
  );

  return (
    <article className="overflow-hidden rounded-3xl border border-white/10 bg-white/2.5 transition hover:border-emerald-300/30">
      <Link
        href={`/especies/${especie.id}`}
        target="_blank"
        rel="noopener noreferrer"
        prefetch={false}
        aria-label={`Ver ficha de ${especie.nombre_comun} en una nueva pestaña`}
        className="group block rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-300"
      >
        <div className="relative h-56 overflow-hidden bg-[#10241b]">
          <Foto
            key={imagen?.imagen_url ?? "sin-imagen"}
            url={imagen?.imagen_url}
            nombre={especie.nombre_comun}
          />

          <span className="absolute left-4 top-4 rounded-full border border-white/20 bg-[#071411]/80 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.15em] text-emerald-100 backdrop-blur">
            {especie.tipo === "PLANTA" ? "Planta" : "Animal"}
          </span>
        </div>

        <div className="p-5">
          <h3 className="text-lg font-semibold tracking-tight">
            {especie.nombre_comun}
          </h3>

          <p className="mt-1 text-sm italic text-emerald-200/65">
            {especie.nombre_cientifico}
          </p>

          <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-400">
            {especie.descripcion || "Descripción pendiente."}
          </p>

          <span className="mt-5 flex items-center justify-between border-t border-white/10 pt-4 text-xs font-medium text-emerald-200">
            Ver ficha completa
            <span aria-hidden="true">↗</span>
          </span>
        </div>
      </Link>

      {imagen && (
        <div className="border-t border-white/5 px-5 py-3 text-[11px] leading-5 text-slate-500">
          Foto:{" "}
          {imagen.fuente_url ? (
            <a
              href={imagen.fuente_url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-emerald-200"
            >
              {imagen.autor || "Consultar autor"}
            </a>
          ) : (
            imagen.autor || "Autor pendiente"
          )}
          {" · "}
          {imagen.licencia_url ? (
            <a
              href={imagen.licencia_url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4 hover:text-emerald-200"
            >
              {imagen.licencia || "Consultar licencia"}
            </a>
          ) : (
            imagen.licencia || "Licencia pendiente"
          )}
        </div>
      )}
    </article>
  );
}

function Foto({
  url,
  nombre,
}: {
  url?: string;
  nombre: string;
}) {
  const [fallo, setFallo] = useState(false);

  if (!url || fallo) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-emerald-200/50">
        Imagen no disponible
      </div>
    );
  }

  return (
    <Image
      src={url}
      alt={nombre}
      fill
      sizes="(max-width: 639px) 100vw, (max-width: 1023px) 50vw, 33vw"
      onError={() => setFallo(true)}
      className="object-cover transition duration-500 motion-safe:group-hover:scale-105"
    />
  );
}

function Hoja() {
  return (
    <svg
      aria-hidden="true"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
    >
      <path
        d="M20 4c-7-1-13 1-14 7-1 4 2 7 6 7 6-1 8-7 8-14Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 21 14 11"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}