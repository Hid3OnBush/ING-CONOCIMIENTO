"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

type Estado = "PENDIENTE" | "PROCESANDO" | "COMPLETADA" | "ERROR";

type Identificacion = {
  id: string;
  estado: Estado;
  created_at: string;
  imagen_temporal_url: string | null;
};

type Historial = {
  total: number;
  pagina: number;
  total_paginas: number;
  identificaciones: Identificacion[];
  aviso: string | null;
};

const estados: Record<
  Estado,
  { titulo: string; descripcion: string; clases: string }
> = {
  PENDIENTE: {
    titulo: "Pendiente",
    descripcion: "Fotografía guardada. Todavía no tiene un resultado.",
    clases: "border-amber-200/20 bg-amber-200/10 text-amber-100",
  },
  PROCESANDO: {
    titulo: "Procesando",
    descripcion: "La solicitud está en procesamiento.",
    clases: "border-sky-200/20 bg-sky-200/10 text-sky-100",
  },
  COMPLETADA: {
    titulo: "Completada",
    descripcion: "La solicitud tiene un resultado registrado.",
    clases: "border-emerald-200/20 bg-emerald-200/10 text-emerald-100",
  },
  ERROR: {
    titulo: "Error",
    descripcion: "La solicitud no pudo completarse.",
    clases: "border-red-200/20 bg-red-200/10 text-red-100",
  },
};

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return (
    typeof valor === "object" &&
    valor !== null &&
    !Array.isArray(valor)
  );
}

function esIdentificacion(valor: unknown): valor is Identificacion {
  if (!esObjeto(valor)) {
    return false;
  }

  return (
    typeof valor.id === "string" &&
    typeof valor.created_at === "string" &&
    (
      valor.estado === "PENDIENTE" ||
      valor.estado === "PROCESANDO" ||
      valor.estado === "COMPLETADA" ||
      valor.estado === "ERROR"
    ) &&
    (
      valor.imagen_temporal_url === null ||
      typeof valor.imagen_temporal_url === "string"
    )
  );
}

function leerHistorial(valor: unknown): Historial | null {
  if (
    !esObjeto(valor) ||
    typeof valor.total !== "number" ||
    !Number.isInteger(valor.total) ||
    valor.total < 0 ||
    typeof valor.pagina !== "number" ||
    !Number.isInteger(valor.pagina) ||
    valor.pagina < 1 ||
    typeof valor.total_paginas !== "number" ||
    !Number.isInteger(valor.total_paginas) ||
    valor.total_paginas < 1 ||
    !Array.isArray(valor.identificaciones) ||
    !valor.identificaciones.every(esIdentificacion) ||
    (valor.aviso !== null && typeof valor.aviso !== "string")
  ) {
    return null;
  }

  return {
    total: valor.total,
    pagina: valor.pagina,
    total_paginas: valor.total_paginas,
    identificaciones: valor.identificaciones,
    aviso: valor.aviso,
  };
}

function formatearFecha(valor: string) {
  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return "Fecha no disponible";
  }

  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  }).format(fecha);
}

function TarjetaFotografia({
  identificacion,
}: {
  identificacion: Identificacion;
}) {
  const [falloImagen, setFalloImagen] = useState(false);
  const estado = estados[identificacion.estado];

  return (
    <article className="overflow-hidden rounded-3xl border border-white/10 bg-[#0d211b]">
      <div className="relative aspect-[4/3] bg-black/25">
        {identificacion.imagen_temporal_url && !falloImagen ? (
          <Image
            src={identificacion.imagen_temporal_url}
            alt="Fotografía guardada en tu historial"
            fill
            unoptimized
            referrerPolicy="no-referrer"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-contain"
            onError={() => setFalloImagen(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-white/45">
            Fotografía no disponible. Pulsa Actualizar para volver a cargarla.
          </div>
        )}
      </div>

      <div className="p-5">
        <span
          className={`inline-flex rounded-full border px-3 py-1 text-xs font-medium ${estado.clases}`}
        >
          {estado.titulo}
        </span>

        <p className="mt-4 text-sm font-medium">
          {formatearFecha(identificacion.created_at)}
        </p>

        <p className="mt-2 text-sm leading-6 text-white/55">
          {estado.descripcion}
        </p>

        <p className="mt-4 break-all border-t border-white/10 pt-4 text-[11px] text-white/35">
          Solicitud: {identificacion.id}
        </p>
      </div>
    </article>
  );
}

export default function HistorialPage() {
  const [historial, setHistorial] = useState<Historial | null>(null);
  const [pagina, setPagina] = useState(1);
  const [intento, setIntento] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [sinSesion, setSinSesion] = useState(false);

  useEffect(() => {
    const controlador = new AbortController();

    async function consultar() {
      try {
        const respuesta = await fetch(
          `/api/identificaciones?pagina=${pagina}`,
          {
            cache: "no-store",
            signal: controlador.signal,
          }
        );

        const datos: unknown = await respuesta.json();

        if (!respuesta.ok) {
          if (!controlador.signal.aborted) {
            setSinSesion(respuesta.status === 401);
          }

          throw new Error(
            esObjeto(datos) && typeof datos.error === "string"
              ? datos.error
              : "No se pudo consultar tu historial."
          );
        }

        const nuevoHistorial = leerHistorial(datos);

        if (!nuevoHistorial) {
          throw new Error("La respuesta del historial no es válida.");
        }

        if (!controlador.signal.aborted) {
          setHistorial(nuevoHistorial);
          setSinSesion(false);
          setError("");
        }
      } catch (errorConsulta) {
        if (!controlador.signal.aborted) {
          setHistorial(null);
          setError(
            errorConsulta instanceof Error
              ? errorConsulta.message
              : "No se pudo consultar tu historial."
          );
        }
      } finally {
        if (!controlador.signal.aborted) {
          setCargando(false);
        }
      }
    }

    void consultar();

    return () => controlador.abort();
  }, [pagina, intento]);

  function actualizar() {
    setError("");
    setCargando(true);
    setIntento((valor) => valor + 1);
  }

  function cambiarPagina(nueva: number) {
    setError("");
    setCargando(true);
    setPagina(nueva);
  }

  return (
    <main className="min-h-screen bg-[#071411] text-white">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                className="h-6 w-6"
                aria-hidden="true"
              >
                <path d="M20 4c-8-1-14 2-14 8a6 6 0 0 0 6 6c6 0 9-6 8-14Z" />
                <path d="m4 20 11-11" />
              </svg>
            </span>

            <span>
              <span className="block text-sm font-semibold tracking-wide">
                NATURA GO
              </span>
              <span className="text-[10px] uppercase tracking-[0.25em] text-emerald-200/60">
                Puebla
              </span>
            </span>
          </Link>

          <nav className="flex gap-5 text-sm text-white/65">
            <Link href="/" className="transition hover:text-white">
              Catálogo
            </Link>
            <Link href="/perfil" className="transition hover:text-white">
              Mi perfil
            </Link>
          </nav>
        </header>

        <section className="flex flex-wrap items-end justify-between gap-6 pb-9 pt-12">
          <div>
            <span className="text-xs uppercase tracking-[0.2em] text-emerald-200/65">
              Tus encuentros con la naturaleza
            </span>

            <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
              Mi historial
            </h1>

            <p className="mt-4 max-w-xl text-sm leading-7 text-white/55">
              Consulta las fotografías y solicitudes guardadas en tu cuenta.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={actualizar}
              disabled={cargando}
              className="rounded-xl border border-white/15 px-5 py-3 text-sm font-medium transition hover:bg-white/5 disabled:opacity-40"
            >
              {cargando ? "Cargando…" : "Actualizar"}
            </button>

            <Link
              href="/identificar"
              className="rounded-xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-[#071411] transition hover:bg-emerald-200"
            >
              Nueva fotografía
            </Link>
          </div>
        </section>

        {cargando ? (
          <div
            role="status"
            className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white/60"
          >
            Cargando tu historial…
          </div>
        ) : error ? (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <h2 className="text-xl font-semibold">
              {sinSesion ? "Inicia sesión para continuar" : "No se pudo cargar"}
            </h2>

            <p role="alert" className="mt-3 text-sm text-white/60">
              {error}
            </p>

            {sinSesion ? (
              <Link
                href="/login"
                className="mt-6 inline-flex rounded-xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-[#071411]"
              >
                Iniciar sesión
              </Link>
            ) : (
              <button
                type="button"
                onClick={actualizar}
                className="mt-6 rounded-xl border border-white/15 px-5 py-3 text-sm"
              >
                Reintentar
              </button>
            )}
          </section>
        ) : historial ? (
          <>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 text-sm text-white/50">
              <p>
                {historial.total}{" "}
                {historial.total === 1 ? "solicitud guardada" : "solicitudes guardadas"}
              </p>
              <p>Las fotografías permanecen en tu cuenta privada.</p>
            </div>

            {historial.aviso && (
              <p
                role="status"
                className="mb-6 rounded-xl border border-amber-200/20 bg-amber-200/5 px-4 py-3 text-sm text-amber-100"
              >
                {historial.aviso}
              </p>
            )}

            {historial.total === 0 ? (
              <section className="rounded-3xl border border-dashed border-emerald-200/20 bg-emerald-300/5 px-6 py-16 text-center">
                <h2 className="text-2xl font-semibold">
                  Tu historial empieza con una fotografía
                </h2>
                <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-white/55">
                  Todavía no tienes solicitudes guardadas.
                  Selecciona una fotografía para comenzar.
                </p>
                <Link
                  href="/identificar"
                  className="mt-7 inline-flex rounded-xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-[#071411]"
                >
                  Subir mi primera fotografía
                </Link>
              </section>
            ) : (
              <>
                {historial.identificaciones.length === 0 ? (
                  <p className="rounded-2xl border border-white/10 p-6 text-white/60">
                    No hay solicitudes en esta página.
                  </p>
                ) : (
                  <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {historial.identificaciones.map((identificacion) => (
                      <TarjetaFotografia
                        key={`${identificacion.id}-${intento}-${pagina}`}
                        identificacion={identificacion}
                      />
                    ))}
                  </div>
                )}

                <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
                  <button
                    type="button"
                    disabled={pagina <= 1}
                    onClick={() => cambiarPagina(pagina - 1)}
                    className="rounded-xl border border-white/15 px-4 py-2 text-sm transition hover:bg-white/5 disabled:opacity-30"
                  >
                    Anterior
                  </button>

                  <span className="text-sm text-white/55">
                    Página {historial.pagina} de {historial.total_paginas}
                  </span>

                  <button
                    type="button"
                    disabled={pagina >= historial.total_paginas}
                    onClick={() => cambiarPagina(pagina + 1)}
                    className="rounded-xl border border-white/15 px-4 py-2 text-sm transition hover:bg-white/5 disabled:opacity-30"
                  >
                    Siguiente
                  </button>
                </div>
              </>
            )}
          </>
        ) : null}

        <footer className="mt-12 border-t border-white/10 py-6 text-xs text-white/35">
          NATURA GO · Flora y fauna de Puebla
        </footer>
      </div>
    </main>
  );
}