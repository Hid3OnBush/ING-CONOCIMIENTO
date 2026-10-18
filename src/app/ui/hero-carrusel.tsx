"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type EspecieDestacada = {
  id: number;
  nombre_comun: string;
  nombre_cientifico: string;
  tipo: "PLANTA" | "ANIMAL";
  imagenes_especies: {
    imagen_url: string;
    autor: string | null;
    licencia: string | null;
    fuente_url: string | null;
    licencia_url: string | null;
    es_principal: boolean;
  }[];
};

type Slide = {
  id: number | string;
  nombreComun: string;
  nombreCientifico: string;
  tipo: "FLORA" | "ANIMAL";
  imagen: string;
  autor: string;
  licencia: string;
  fuenteUrl: string;
  licenciaUrl: string;
};

const especiesRespaldo: Slide[] = [
  {
    id: "nopal",
    nombreComun: "Nopal de Castilla",
    nombreCientifico: "Opuntia ficus-indica",
    tipo: "FLORA",
    imagen:
      "https://vauffaiiibqwephxtgal.supabase.co/storage/v1/object/public/especies-referencia/opuntia-ficus-indica/principal.jpg",
    autor: "Stan Shebs",
    licencia: "CC BY-SA 3.0",
    fuenteUrl:
      "https://commons.wikimedia.org/wiki/File:Opuntia_ficus-indica_1.jpg",
    licenciaUrl: "https://creativecommons.org/licenses/by-sa/3.0/",
  },
  {
    id: "ahuehuete",
    nombreComun: "Ahuehuete",
    nombreCientifico: "Taxodium mucronatum",
    tipo: "FLORA",
    imagen:
      "https://vauffaiiibqwephxtgal.supabase.co/storage/v1/object/public/especies-referencia/taxodium-mucronatum/principal.jpg",
    autor: "Wicki",
    licencia: "CC0 1.0",
    fuenteUrl: "https://commons.wikimedia.org/wiki/File:Tule_tree.jpg",
    licenciaUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  },
];

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function leerImagen(
  valor: unknown
): EspecieDestacada["imagenes_especies"][number] | null {
  if (
    !esObjeto(valor) ||
    typeof valor.imagen_url !== "string" ||
    typeof valor.es_principal !== "boolean"
  ) {
    return null;
  }

  return {
    imagen_url: valor.imagen_url,
    autor: typeof valor.autor === "string" ? valor.autor : null,
    licencia: typeof valor.licencia === "string" ? valor.licencia : null,
    fuente_url:
      typeof valor.fuente_url === "string" ? valor.fuente_url : null,
    licencia_url:
      typeof valor.licencia_url === "string" ? valor.licencia_url : null,
    es_principal: valor.es_principal,
  };
}

function leerEspecie(valor: unknown): EspecieDestacada | null {
  if (
    !esObjeto(valor) ||
    typeof valor.id !== "number" ||
    typeof valor.nombre_comun !== "string" ||
    typeof valor.nombre_cientifico !== "string" ||
    (valor.tipo !== "PLANTA" && valor.tipo !== "ANIMAL") ||
    !Array.isArray(valor.imagenes_especies)
  ) {
    return null;
  }

  const imagenes = valor.imagenes_especies
    .map(leerImagen)
    .filter(
      (imagen): imagen is EspecieDestacada["imagenes_especies"][number] =>
        imagen !== null
    );

  return {
    id: valor.id,
    nombre_comun: valor.nombre_comun,
    nombre_cientifico: valor.nombre_cientifico,
    tipo: valor.tipo,
    imagenes_especies: imagenes,
  };
}

function mezclar<T>(elementos: T[]): T[] {
  const resultado = [...elementos];

  for (let indice = resultado.length - 1; indice > 0; indice -= 1) {
    const aleatorio = Math.floor(Math.random() * (indice + 1));
    [resultado[indice], resultado[aleatorio]] = [
      resultado[aleatorio],
      resultado[indice],
    ];
  }

  return resultado;
}

function crearSlides(especies: EspecieDestacada[]): Slide[] {
  return especies.flatMap((especie) => {
    const imagen =
      especie.imagenes_especies.find(
        (elemento) => elemento.es_principal && elemento.imagen_url
      ) ?? especie.imagenes_especies.find((elemento) => elemento.imagen_url);

    if (!imagen) {
      return [];
    }

    return [
      {
        id: especie.id,
        nombreComun: especie.nombre_comun,
        nombreCientifico: especie.nombre_cientifico,
        tipo: especie.tipo === "PLANTA" ? "FLORA" : "ANIMAL",
        imagen: imagen.imagen_url,
        autor: imagen.autor ?? "Consultar fuente",
        licencia: imagen.licencia ?? "Licencia no especificada",
        fuenteUrl: imagen.fuente_url ?? imagen.imagen_url,
        licenciaUrl: imagen.licencia_url ?? imagen.imagen_url,
      },
    ];
  });
}

function SkeletonCarrusel() {
  return (
    <figure
      aria-label="Cargando especies destacadas"
      className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#10241b]"
    >
      <div className="relative h-72 bg-white/5 motion-safe:animate-pulse sm:h-96">
        <div className="absolute inset-x-6 bottom-6 space-y-3">
          <div className="h-6 w-20 rounded-full bg-white/10" />
          <div className="h-8 w-2/3 rounded-lg bg-white/10" />
          <div className="h-4 w-1/2 rounded bg-white/10" />
          <div className="flex gap-2 pt-2">
            <div className="h-1.5 w-6 rounded-full bg-white/15" />
            <div className="h-1.5 w-1.5 rounded-full bg-white/10" />
            <div className="h-1.5 w-1.5 rounded-full bg-white/10" />
          </div>
        </div>
      </div>
      <figcaption className="h-11 border-t border-white/5 bg-white/[0.02] px-6 py-3">
        <div className="h-4 w-2/3 rounded bg-white/10 motion-safe:animate-pulse" />
      </figcaption>
    </figure>
  );
}

export default function HeroCarrusel() {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [cargando, setCargando] = useState(true);
  const [indice, setIndice] = useState(0);
  const [pausado, setPausado] = useState(false);
  const [movimientoReducido, setMovimientoReducido] = useState(false);

  useEffect(() => {
    const controlador = new AbortController();

    async function cargarEspecies() {
      try {
        const respuesta = await fetch("/api/especies/destacadas", {
          cache: "no-store",
          signal: controlador.signal,
        });

        if (!respuesta.ok) {
          throw new Error(
            `La consulta de especies destacadas respondió ${respuesta.status}.`
          );
        }

        const datos: unknown = await respuesta.json();
        if (
          !esObjeto(datos) ||
          !Array.isArray(datos.especies)
        ) {
          throw new Error("La respuesta de especies destacadas no es válida.");
        }

        const especiesLeidas = datos.especies.map(leerEspecie);
        if (especiesLeidas.some((especie) => especie === null)) {
          throw new Error("La respuesta de especies destacadas no es válida.");
        }

        const especies = especiesLeidas
          .filter((especie): especie is EspecieDestacada => especie !== null);
        const aleatorias = mezclar(crearSlides(especies));

        if (!controlador.signal.aborted) {
          setSlides(aleatorias.length > 0 ? aleatorias : especiesRespaldo);
        }
      } catch (error) {
        if (!controlador.signal.aborted) {
          console.error(
            "No se pudieron cargar las especies destacadas:",
            error
          );
          setSlides(especiesRespaldo);
        }
      } finally {
        if (!controlador.signal.aborted) {
          setCargando(false);
        }
      }
    }

    void cargarEspecies();

    return () => controlador.abort();
  }, []);

  useEffect(() => {
    const consulta = window.matchMedia("(prefers-reduced-motion: reduce)");
    const actualizarPreferencia = () =>
      setMovimientoReducido(consulta.matches);

    actualizarPreferencia();
    consulta.addEventListener("change", actualizarPreferencia);

    return () => consulta.removeEventListener("change", actualizarPreferencia);
  }, []);

  useEffect(() => {
    if (pausado || movimientoReducido || slides.length < 2) {
      return;
    }

    const temporizador = window.setInterval(() => {
      setIndice((actual) => (actual + 1) % slides.length);
    }, 5000);

    return () => window.clearInterval(temporizador);
  }, [pausado, movimientoReducido, slides.length]);

  if (cargando) {
    return <SkeletonCarrusel />;
  }

  const slide = slides[indice];

  function seleccionarSlide(nuevoIndice: number) {
    setIndice((nuevoIndice + slides.length) % slides.length);
  }

  return (
    <figure
      aria-label="Especies destacadas"
      aria-roledescription="carrusel"
      className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[#10241b]"
    >
      <div className="relative h-72 sm:h-96">
        <Image
          key={slide.id}
          src={slide.imagen}
          alt={`${slide.nombreComun}, ${slide.nombreCientifico}`}
          fill
          sizes="(max-width: 1023px) 100vw, 45vw"
          className="object-cover transition-opacity duration-700 motion-reduce:transition-none"
        />

        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#071411] via-black/10 to-transparent"
        />

        {slides.length > 1 && (
          <div className="absolute right-5 top-5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => seleccionarSlide(indice - 1)}
              aria-label="Mostrar especie anterior"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur transition hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
            >
              <span aria-hidden="true">←</span>
            </button>
            <button
              type="button"
              onClick={() => seleccionarSlide(indice + 1)}
              aria-label="Mostrar especie siguiente"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/35 text-white backdrop-blur transition hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
            >
              <span aria-hidden="true">→</span>
            </button>
            <button
              type="button"
              onClick={() => setPausado((actual) => !actual)}
              aria-label={pausado ? "Reanudar carrusel" : "Pausar carrusel"}
              className="rounded-full border border-white/20 bg-black/35 px-3 py-2 text-xs text-white backdrop-blur transition hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
            >
              {pausado ? "Reanudar" : "Pausar"}
            </button>
          </div>
        )}

        <div className="absolute bottom-6 left-6 right-6">
          <span className="rounded-full border border-white/20 bg-black/25 px-3 py-1 text-[10px] uppercase tracking-[0.2em] text-emerald-100 backdrop-blur">
            {slide.tipo}
          </span>

          <p
            aria-live="polite"
            aria-atomic="true"
            className="mt-3 text-2xl font-semibold"
          >
            {slide.nombreComun}
          </p>

          <p className="mt-1 text-sm italic text-emerald-100/75">
            {slide.nombreCientifico}
          </p>

          {slides.length > 1 && (
            <div
              className="mt-4 flex gap-1.5"
              role="group"
              aria-label="Elegir especie destacada"
            >
              {slides.map((elemento, posicion) => (
                <button
                  key={elemento.id}
                  type="button"
                  onClick={() => seleccionarSlide(posicion)}
                  aria-label={`Mostrar ${elemento.nombreComun}`}
                  aria-current={posicion === indice ? "true" : undefined}
                  className={`h-1.5 rounded-full transition-all ${
                    posicion === indice
                      ? "w-6 bg-emerald-300"
                      : "w-1.5 bg-white/55 hover:bg-white"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <figcaption className="px-6 py-3 text-xs leading-5 text-slate-400">
        Foto:{" "}
        <a
          href={slide.fuenteUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4 hover:text-emerald-200"
        >
          {slide.autor}
        </a>
        {" · "}
        <a
          href={slide.licenciaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4 hover:text-emerald-200"
        >
          {slide.licencia}
        </a>
      </figcaption>
    </figure>
  );
}
