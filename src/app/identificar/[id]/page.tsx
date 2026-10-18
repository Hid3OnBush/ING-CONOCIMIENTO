"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { FichaEspecieReconocida } from "@/lib/identificaciones/reconocimiento";

type Estado = "PENDIENTE" | "PROCESANDO" | "COMPLETADA" | "ERROR";

type IdentificacionDetalle = {
  id: string;
  estado: Estado;
  created_at: string;
  confianza: number | null;
  mensaje_resultado: string | null;
  error_mensaje: string | null;
  imagen_temporal_url: string | null;
  especie: FichaEspecieReconocida | null;
};

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return (
    typeof valor === "object" &&
    valor !== null &&
    !Array.isArray(valor)
  );
}

function esEstado(valor: unknown): valor is Estado {
  return (
    valor === "PENDIENTE" ||
    valor === "PROCESANDO" ||
    valor === "COMPLETADA" ||
    valor === "ERROR"
  );
}

function esFicha(valor: unknown): valor is FichaEspecieReconocida {
  if (!esObjeto(valor) || !esObjeto(valor.taxonomia)) return false;

  return (
    typeof valor.nombre_comun === "string" &&
    typeof valor.nombre_cientifico === "string"
  );
}

function leerDetalle(valor: unknown): IdentificacionDetalle | null {
  if (!esObjeto(valor) || !esObjeto(valor.identificacion)) return null;
  const registro = valor.identificacion;

  if (
    typeof registro.id !== "string" ||
    typeof registro.created_at !== "string" ||
    !esEstado(registro.estado) ||
    (registro.confianza !== null &&
      typeof registro.confianza !== "number") ||
    (registro.mensaje_resultado !== null &&
      typeof registro.mensaje_resultado !== "string") ||
    (registro.error_mensaje !== null &&
      typeof registro.error_mensaje !== "string") ||
    (registro.imagen_temporal_url !== null &&
      typeof registro.imagen_temporal_url !== "string") ||
    (registro.especie !== null && !esFicha(registro.especie))
  ) {
    return null;
  }

  return {
    id: registro.id,
    estado: registro.estado,
    created_at: registro.created_at,
    confianza: registro.confianza,
    mensaje_resultado: registro.mensaje_resultado,
    error_mensaje: registro.error_mensaje,
    imagen_temporal_url: registro.imagen_temporal_url,
    especie: registro.especie,
  };
}

function texto(valor: string | null | undefined) {
  return valor || "Sin información disponible.";
}

function formatearFecha(valor: string) {
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime())
    ? "Fecha no disponible"
    : new Intl.DateTimeFormat("es-MX", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "America/Mexico_City",
      }).format(fecha);
}

export default function DetalleIdentificacionPage() {
  const { id } = useParams<{ id: string }>();
  const [detalle, setDetalle] = useState<IdentificacionDetalle | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    const controlador = new AbortController();

    async function consultar() {
      try {
        const respuesta = await fetch(
          `/api/identificaciones/${encodeURIComponent(id)}`,
          { cache: "no-store", signal: controlador.signal }
        );
        const datos: unknown = await respuesta.json();

        if (!respuesta.ok) {
          throw new Error(
            esObjeto(datos) && typeof datos.error === "string"
              ? datos.error
              : "No se pudo cargar esta identificación."
          );
        }

        const identificacion = leerDetalle(datos);
        if (!identificacion) {
          throw new Error("La respuesta de detalle no es válida.");
        }
        if (!controlador.signal.aborted) {
          setDetalle(identificacion);
          setError("");
        }
      } catch (fallo) {
        if (!controlador.signal.aborted) {
          setError(
            fallo instanceof Error
              ? fallo.message
              : "No se pudo cargar esta identificación."
          );
        }
      } finally {
        if (!controlador.signal.aborted) setCargando(false);
      }
    }

    void consultar();
    return () => controlador.abort();
  }, [id, intento]);

  const campos = detalle?.especie
    ? [
        ["Hábitat", detalle.especie.habitat],
        ["Distribución", detalle.especie.distribucion],
        ["Características", detalle.especie.caracteristicas],
        ["Alimentación", detalle.especie.alimentacion],
        ["Temporada", detalle.especie.temporada],
      ]
    : [];
  const taxonomia = detalle?.especie
    ? [
        ["Reino", detalle.especie.taxonomia.reino],
        ["Filo / división", detalle.especie.taxonomia.filo_division],
        ["Clase", detalle.especie.taxonomia.clase],
        ["Orden", detalle.especie.taxonomia.orden],
        ["Familia", detalle.especie.taxonomia.familia],
        ["Género", detalle.especie.taxonomia.genero],
        ["Especie", detalle.especie.taxonomia.especie],
      ]
    : [];

  return (
    <main className="min-h-screen bg-[#071411] text-white">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between gap-4 border-b border-white/10 pb-6">
          <Link href="/historial" className="text-sm text-emerald-200">
            ← Volver a mi historial
          </Link>
          <Link href="/" className="text-sm font-semibold tracking-wide">
            NATURA GO · PUEBLA
          </Link>
        </header>

        {cargando ? (
          <p role="status" className="py-16 text-center text-white/60">
            Cargando los detalles de tu identificación…
          </p>
        ) : error || !detalle ? (
          <section className="mt-12 rounded-3xl border border-white/10 bg-white/[0.03] p-8">
            <h1 className="text-2xl font-semibold">
              No se pudo cargar el detalle
            </h1>
            <p role="alert" className="mt-3 text-sm text-white/60">
              {error || "La identificación no está disponible."}
            </p>
            <button
              type="button"
              onClick={() => {
                setCargando(true);
                setIntento((actual) => actual + 1);
              }}
              className="mt-6 rounded-xl border border-white/15 px-5 py-3 text-sm"
            >
              Reintentar
            </button>
          </section>
        ) : (
          <>
            <section className="py-10">
              <p className="text-xs uppercase tracking-[0.2em] text-emerald-200/65">
                Ficha de identificación
              </p>
              <h1 className="mt-3 text-3xl font-semibold sm:text-5xl">
                {detalle.especie?.nombre_comun ?? "Registro fotográfico"}
              </h1>
              {detalle.especie?.nombre_cientifico && (
                <p className="mt-2 text-lg italic text-emerald-100/65">
                  {detalle.especie.nombre_cientifico}
                </p>
              )}
              <p className="mt-4 text-sm text-white/50">
                {formatearFecha(detalle.created_at)} · Estado:{" "}
                {detalle.estado.toLowerCase()}
              </p>
              {detalle.confianza !== null && (
                <p className="mt-2 text-sm text-white/50">
                  Confianza registrada:{" "}
                  {(detalle.confianza * 100).toFixed(1)}%
                </p>
              )}
              {detalle.mensaje_resultado && (
                <p className="mt-4 max-w-3xl text-sm leading-6 text-white/65">
                  {detalle.mensaje_resultado}
                </p>
              )}
              {detalle.error_mensaje && (
                <p role="alert" className="mt-4 text-sm text-amber-100">
                  {detalle.error_mensaje}
                </p>
              )}
            </section>

            <div className="grid items-start gap-8 lg:grid-cols-[1.1fr_1fr]">
              <div>
                <figure className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-white/10 bg-black/20">
                  {detalle.imagen_temporal_url ? (
                    <Image
                      src={detalle.imagen_temporal_url}
                      alt="Fotografía original de la identificación"
                      fill
                      unoptimized
                      referrerPolicy="no-referrer"
                      sizes="(max-width: 1024px) 100vw, 55vw"
                      className="object-contain"
                    />
                  ) : (
                    <figcaption className="flex h-full items-center justify-center text-sm text-white/50">
                      Fotografía original no disponible.
                    </figcaption>
                  )}
                </figure>

                {detalle.especie ? (
                  <div className="mt-6 grid gap-4 sm:grid-cols-2">
                    <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:col-span-2">
                      <h2 className="font-semibold">Descripción</h2>
                      <p className="mt-3 whitespace-pre-line text-sm leading-7 text-white/60">
                        {texto(detalle.especie.descripcion)}
                      </p>
                    </section>
                    {campos.map(([etiqueta, valor]) => (
                      <section
                        key={etiqueta}
                        className="rounded-2xl border border-white/10 bg-white/[0.025] p-5"
                      >
                        <h2 className="font-semibold">{etiqueta}</h2>
                        <p className="mt-3 whitespace-pre-line text-sm leading-7 text-white/60">
                          {texto(valor)}
                        </p>
                      </section>
                    ))}
                  </div>
                ) : (
                  <section className="mt-6 rounded-2xl border border-amber-200/15 bg-amber-200/5 p-5">
                    <h2 className="font-semibold">Sin ficha guardada</h2>
                    <p className="mt-2 text-sm leading-6 text-white/60">
                      Este registro se creó antes de guardar los detalles del
                      reconocimiento. Las nuevas identificaciones conservarán
                      su ficha completa.
                    </p>
                  </section>
                )}
              </div>

              {detalle.especie && (
                <aside className="space-y-5">
                  <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
                    <h2 className="text-xl font-semibold">
                      Clasificación taxonómica
                    </h2>
                    <dl className="mt-4 divide-y divide-white/10">
                      {taxonomia.map(([etiqueta, valor]) => (
                        <div
                          key={etiqueta}
                          className="grid grid-cols-[1fr_1.2fr] gap-4 py-3 text-sm"
                        >
                          <dt className="text-white/45">{etiqueta}</dt>
                          <dd className="break-words text-white/80">
                            {texto(valor)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>

                  <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">
                    <h2 className="text-xl font-semibold">
                      Riesgo y conservación
                    </h2>
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      {[
                        ["Nivel de riesgo", detalle.especie.nivel_riesgo],
                        [
                          "Estado de conservación",
                          detalle.especie.estado_conservacion,
                        ],
                        ["Peligrosa", detalle.especie.peligrosa],
                        ["Tóxica", detalle.especie.toxica],
                        ["Venenosa", detalle.especie.venenosa],
                        ["Protegida", detalle.especie.protegida],
                      ].map(([etiqueta, valor]) => (
                        <div
                          key={String(etiqueta)}
                          className="rounded-xl border border-white/10 p-3"
                        >
                          <dt className="text-xs text-white/45">
                            {String(etiqueta)}
                          </dt>
                          <dd className="mt-2 text-white/80">
                            {typeof valor === "boolean"
                              ? valor
                                ? "Sí"
                                : "No"
                              : texto(valor)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                </aside>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
