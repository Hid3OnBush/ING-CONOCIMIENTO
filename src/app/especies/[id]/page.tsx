"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { textoPlano } from "@/lib/texto-plano";
import TarjetaConservacion from "../tarjeta-conservacion";

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
  peligrosa: boolean | null;
  toxica: boolean | null;
  venenosa: boolean | null;
  protegida: boolean | null;
  imagenes_especies: ImagenEspecie[];
} & Record<string, unknown>;

export default function PaginaEspecie() {
  const { id } = useParams<{ id: string }>();

  return <FichaEspecie key={id} id={id} />;
}

function FichaEspecie({ id }: { id: string }) {
  const [especie, setEspecie] = useState<Especie | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    const controlador = new AbortController();

    async function cargar() {
      try {
        const respuesta = await fetch(
          `/api/especies/${encodeURIComponent(id)}`,
          {
            cache: "no-store",
            signal: controlador.signal,
          }
        );

        if (!respuesta.ok) {
          if (respuesta.status === 404) {
            throw new Error(
              "Esta especie no está disponible en el catálogo."
            );
          }

          if (respuesta.status === 400) {
            throw new Error("El identificador de la especie no es válido.");
          }

          throw new Error(
            "No pudimos cargar la ficha. Intenta nuevamente."
          );
        }

        const datos = await respuesta.json();

        if (!datos.especie || typeof datos.especie !== "object") {
          throw new Error("La ficha devolvió una respuesta inesperada.");
        }

        if (!controlador.signal.aborted) {
          setEspecie(datos.especie);
          setError("");
        }
      } catch (fallo) {
        if (!controlador.signal.aborted) {
          setError(
            fallo instanceof Error
              ? fallo.message
              : "No pudimos conectar con el servidor."
          );
        }
      } finally {
        if (!controlador.signal.aborted) {
          setCargando(false);
        }
      }
    }

    void cargar();

    return () => controlador.abort();
  }, [id, intento]);

  const imagen = especie?.imagenes_especies?.find(
    (elemento) => elemento.es_principal
  );

  const taxonomia = especie
    ? [
        ["Reino", especie.reino],
        ["Filo / división", especie.filo_division],
        ["Clase", especie.clase],
        ["Orden", especie.orden_taxonomico],
        ["Familia", especie.familia],
        ["Género", especie.genero],
        ["Especie", especie.especie_taxonomica],
      ].filter(([, valor]) => textoPlano(valor) !== null)
    : [];
  const nivelRiesgo = textoPlano(especie?.nivel_riesgo);
  const estadoConservacion = textoPlano(especie?.estado_conservacion);
  const fuentePrincipal = textoPlano(especie?.fuente_principal);
  const notasSeguridad = Array.isArray(especie?.notas_seguridad)
    ? especie.notas_seguridad
        .map(textoPlano)
        .filter((nota): nota is string => Boolean(nota))
    : [];

  function reintentar() {
    setCargando(true);
    setError("");
    setIntento((valor) => valor + 1);
  }

  return (
    <main className="min-h-screen bg-[#071411] text-slate-100">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5 lg:px-10">
          <Link
            href="/"
            className="rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300"
          >
            <span className="block text-sm font-semibold tracking-tight">
              NATURA GO
            </span>
            <span className="block text-[10px] uppercase tracking-[0.28em] text-emerald-200/60">
              Puebla
            </span>
          </Link>

          <Link
            href="/#catalogo"
            className="rounded-full border border-white/15 px-4 py-2.5 text-xs font-medium transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-emerald-300 sm:text-sm"
          >
            ← Ver catálogo
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10 lg:py-14">
        {cargando ? (
          <div>
            <p role="status" className="mb-6 text-sm text-slate-400">
              Cargando ficha de la especie…
            </p>
            <div
              aria-hidden="true"
              className="h-96 rounded-[2rem] border border-white/10 bg-white/5 motion-safe:animate-pulse"
            />
          </div>
        ) : error || !especie ? (
          <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-8">
            <h1 className="text-2xl font-semibold">
              No se pudo mostrar la ficha.
            </h1>

            <p role="alert" className="mt-4 text-sm leading-6 text-slate-400">
              {error || "La especie no está disponible."}
            </p>

            <button
              type="button"
              onClick={reintentar}
              className="mt-6 rounded-full bg-emerald-300 px-5 py-3 text-sm font-semibold text-emerald-950 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300"
            >
              Volver a intentar
            </button>
          </section>
        ) : (
          <>
            <div className="mb-8">
              <span className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1.5 text-xs text-emerald-200">
                {especie.tipo === "PLANTA" ? "Flora · Planta" : "Fauna · Animal"}
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
                <figure className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#10241b]">
                  <Fotografia
                    key={imagen?.imagen_url ?? "sin-imagen"}
                    url={imagen?.imagen_url}
                    nombre={especie.nombre_comun}
                  />

                  {imagen && (
                    <figcaption className="border-t border-white/10 px-6 py-4 text-xs leading-6 text-slate-400">
                      Fotografía:{" "}
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
                {taxonomia.length > 0 && (
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
                        key={String(etiqueta)}
                        className="grid grid-cols-[1fr_1.2fr] gap-4 py-3 text-sm leading-6"
                      >
                        <dt className="text-slate-500">
                          {String(etiqueta)}
                        </dt>
                        <dd className="break-words text-slate-200">
                          {textoPlano(valor)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  </section>
                )}

                {especie && (
                  <TarjetaConservacion
                    nivelRiesgo={nivelRiesgo}
                    estadoConservacion={estadoConservacion}
                    indicadores={[
                      { nombre: "Peligrosa", valor: especie.peligrosa },
                      { nombre: "Tóxica", valor: especie.toxica },
                      { nombre: "Venenosa", valor: especie.venenosa },
                      { nombre: "Protegida", valor: especie.protegida },
                    ]}
                    notas={notasSeguridad}
                  />
                )}

                {(fuentePrincipal || textoPlano(especie.fuente_url)) && (
                  <section className="rounded-3xl border border-emerald-300/15 bg-emerald-300/[0.04] p-6">
                  <h2 className="text-lg font-semibold">
                    Fuente de información
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    {fuentePrincipal}
                  </p>

                  {typeof especie.fuente_url === "string" &&
                    especie.fuente_url && (
                      <a
                        href={especie.fuente_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-5 inline-flex rounded-full border border-emerald-300/25 px-4 py-2.5 text-xs font-medium text-emerald-200 transition hover:bg-emerald-300/10"
                      >
                        Consultar fuente original ↗
                      </a>
                    )}
                  </section>
                )}
              </aside>
            </div>
          </>
        )}

        <footer className="mt-12 border-t border-white/10 py-6 text-xs text-slate-500">
          NATURA GO · Flora y fauna de Puebla
        </footer>
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
  valor: unknown;
  amplio?: boolean;
}) {
  const contenido = textoPlano(valor);
  if (!contenido) {
    return null;
  }

  return (
    <section
      className={`rounded-3xl border border-white/10 bg-white/[0.025] p-6 ${
        amplio ? "sm:col-span-2" : ""
      }`}
    >
      <h2 className="text-lg font-semibold tracking-tight">{titulo}</h2>
      <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-400">
        {contenido}
      </p>
    </section>
  );
}

function Fotografia({
  url,
  nombre,
}: {
  url?: string;
  nombre: string;
}) {
  const [fallo, setFallo] = useState(false);

  return (
    <div className="relative aspect-[4/3] w-full">
      {!url || fallo ? (
        <div className="flex h-full items-center justify-center text-sm text-emerald-200/50">
          Imagen no disponible
        </div>
      ) : (
        <Image
          src={url}
          alt={nombre}
          fill
          sizes="(max-width: 1023px) 100vw, 60vw"
          onError={() => setFallo(true)}
          className="object-contain p-3 sm:p-5"
        />
      )}
    </div>
  );
}