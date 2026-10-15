"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { crearClienteNavegador } from "@/lib/supabase/navegador";
import {
  BUCKET_IDENTIFICACIONES,
  validarArchivoImagen,
  type ExtensionImagen,
} from "@/lib/identificaciones/archivo";
import type {
  AlternativaReconocimiento,
  FichaEspecieReconocida,
  ResultadoReconocimiento,
} from "@/lib/identificaciones/reconocimiento";

type Operacion = {
  id: string;
  usuarioId: string;
  extension: ExtensionImagen;
  subida: boolean;
};

type Identificacion = {
  id: string;
  estado: string;
  created_at: string;
};

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return (
    typeof valor === "object" &&
    valor !== null &&
    !Array.isArray(valor)
  );
}

function obtenerError(datos: unknown, alternativa: string): string {
  return esObjeto(datos) && typeof datos.error === "string"
    ? datos.error
    : alternativa;
}

function obtenerIdentificacion(datos: unknown): Identificacion | null {
  if (!esObjeto(datos) || !esObjeto(datos.identificacion)) {
    return null;
  }

  const valor = datos.identificacion;

  if (
    typeof valor.id !== "string" ||
    typeof valor.estado !== "string" ||
    typeof valor.created_at !== "string"
  ) {
    return null;
  }

  return {
    id: valor.id,
    estado: valor.estado,
    created_at: valor.created_at,
  };
}

function esTextoONulo(valor: unknown): valor is string | null {
  return valor === null || typeof valor === "string";
}

function esFichaEspecie(
  valor: unknown
): valor is FichaEspecieReconocida {
  if (!esObjeto(valor) || !esObjeto(valor.taxonomia)) {
    return false;
  }

  const datosTaxonomia = valor.taxonomia;
  const textoOpcional = [
    "descripcion",
    "habitat",
    "distribucion",
    "alimentacion",
    "temporada",
    "caracteristicas",
    "nivel_riesgo",
    "estado_conservacion",
    "imagen_url",
  ];
  const taxonomia = [
    "reino",
    "filo_division",
    "clase",
    "orden",
    "familia",
    "genero",
    "especie",
  ];

  return (
    (valor.id === null || typeof valor.id === "string") &&
    typeof valor.nombre_comun === "string" &&
    typeof valor.nombre_cientifico === "string" &&
    (valor.tipo === null ||
      valor.tipo === "PLANTA" ||
      valor.tipo === "ANIMAL") &&
    textoOpcional.every((campo) => esTextoONulo(valor[campo])) &&
    ["peligrosa", "toxica", "venenosa", "protegida"].every(
      (campo) => valor[campo] === null || typeof valor[campo] === "boolean"
    ) &&
    taxonomia.every((campo) => esTextoONulo(datosTaxonomia[campo]))
  );
}

function esAlternativa(
  valor: unknown
): valor is AlternativaReconocimiento {
  return (
    esObjeto(valor) &&
    typeof valor.confianza === "number" &&
    Number.isFinite(valor.confianza) &&
    valor.confianza >= 0 &&
    valor.confianza <= 1 &&
    esFichaEspecie(valor.especie)
  );
}

function obtenerResultadoReconocimiento(
  datos: unknown
): ResultadoReconocimiento | null {
  if (!esObjeto(datos) || !esObjeto(datos.resultado)) {
    return null;
  }

  const valor = datos.resultado;
  if (
    (valor.fuente !== "modelo_puebla" && valor.fuente !== "inaturalist") ||
    typeof valor.umbral_modelo_puebla !== "number" ||
    valor.umbral_modelo_puebla < 0 ||
    valor.umbral_modelo_puebla > 1 ||
    typeof valor.identificada !== "boolean" ||
    (valor.confianza !== null &&
      (typeof valor.confianza !== "number" ||
        !Number.isFinite(valor.confianza) ||
        valor.confianza < 0 ||
        valor.confianza > 1)) ||
    !Array.isArray(valor.alternativas) ||
    typeof valor.mensaje !== "string" ||
    (valor.especie !== null && !esFichaEspecie(valor.especie))
  ) {
    return null;
  }

  const alternativas = valor.alternativas.filter(esAlternativa);
  if (alternativas.length !== valor.alternativas.length) {
    return null;
  }

  return {
    fuente: valor.fuente,
    umbral_modelo_puebla: valor.umbral_modelo_puebla,
    confianza: valor.confianza,
    identificada: valor.identificada,
    especie: valor.especie,
    alternativas,
    mensaje: valor.mensaje,
  };
}

export default function IdentificarPage() {
  const [supabase] = useState(() => crearClienteNavegador());
  const [usuarioId, setUsuarioId] = useState<string | null>(null);
  const [comprobandoSesion, setComprobandoSesion] = useState(true);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [fase, setFase] = useState("");
  const [error, setError] = useState("");
  const [errorReconocimiento, setErrorReconocimiento] = useState("");
  const [resultado, setResultado] = useState<Identificacion | null>(null);
  const [reconocimiento, setReconocimiento] =
    useState<ResultadoReconocimiento | null>(null);
  const [bloquearSeleccion, setBloquearSeleccion] = useState(false);
  const [camaraActiva, setCamaraActiva] = useState(false);

  const bloqueo = useRef(false);
  const operacion = useRef<Operacion | null>(null);
  const urlActual = useRef<string | null>(null);
  const inputArchivo = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamCamara = useRef<MediaStream | null>(null);

  useEffect(() => {
    const controlador = new AbortController();

    async function comprobarSesion() {
      try {
        const respuesta = await fetch("/api/perfil", {
          cache: "no-store",
          signal: controlador.signal,
        });

        const datos: unknown = await respuesta.json();

        if (!respuesta.ok) {
          throw new Error(
            obtenerError(datos, "No se pudo verificar tu sesión.")
          );
        }

        if (
          !esObjeto(datos) ||
          !esObjeto(datos.perfil) ||
          typeof datos.perfil.id !== "string" ||
          datos.perfil.activo !== true
        ) {
          throw new Error("No se pudo verificar tu cuenta.");
        }

        if (!controlador.signal.aborted) {
          setUsuarioId(datos.perfil.id);
        }
      } catch (errorSesion) {
        if (!controlador.signal.aborted) {
          setError(
            errorSesion instanceof Error
              ? errorSesion.message
              : "No se pudo verificar tu sesión."
          );
        }
      } finally {
        if (!controlador.signal.aborted) {
          setComprobandoSesion(false);
        }
      }
    }

    void comprobarSesion();

    return () => controlador.abort();
  }, []);

  useEffect(() => {
    return () => {
      if (urlActual.current) {
        URL.revokeObjectURL(urlActual.current);
      }
      streamCamara.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamCamara.current;

    if (!camaraActiva || !video || !stream) {
      return;
    }

    video.srcObject = stream;
    void video.play().catch(() => {
      setError("No se pudo iniciar la vista de la cámara.");
      stream.getTracks().forEach((track) => track.stop());
      streamCamara.current = null;
      setCamaraActiva(false);
    });

    return () => {
      video.srcObject = null;
    };
  }, [camaraActiva]);

  function detenerCamara() {
    streamCamara.current?.getTracks().forEach((track) => track.stop());
    streamCamara.current = null;
    setCamaraActiva(false);
  }

  async function abrirCamara() {
    setError("");

    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        "Este navegador no permite usar la cámara. Abre la aplicación con HTTPS o selecciona una fotografía."
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
      });

      detenerCamara();
      streamCamara.current = stream;
      setCamaraActiva(true);
    } catch (errorCamara) {
      const nombre =
        errorCamara instanceof DOMException ? errorCamara.name : "";
      setError(
        nombre === "NotAllowedError" || nombre === "PermissionDeniedError"
          ? "No se concedió permiso para usar la cámara. Puedes habilitarlo en la configuración del navegador."
          : nombre === "NotFoundError" || nombre === "DevicesNotFoundError"
            ? "No se encontró una cámara disponible en este dispositivo."
            : "No se pudo acceder a la cámara. También puedes seleccionar una fotografía."
      );
    }
  }

  async function capturarFotograma() {
    const video = videoRef.current;

    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setError("La cámara todavía no está lista. Inténtalo de nuevo.");
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const contexto = canvas.getContext("2d");

    if (!contexto) {
      setError("No se pudo preparar la fotografía capturada.");
      return;
    }

    contexto.drawImage(video, 0, 0, canvas.width, canvas.height);
    const fotografia = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/jpeg", 0.9);
    });

    if (!fotografia) {
      setError("No se pudo crear la fotografía capturada.");
      return;
    }

    detenerCamara();
    const archivoCapturado = new File(
      [fotografia],
      `captura-${Date.now()}.jpg`,
      { type: "image/jpeg", lastModified: Date.now() }
    );
    await seleccionarArchivo(archivoCapturado);
  }

  function limpiarSeleccion() {
    detenerCamara();
    if (urlActual.current) {
      URL.revokeObjectURL(urlActual.current);
    }

    urlActual.current = null;
    operacion.current = null;

    setArchivo(null);
    setVistaPrevia(null);
    setResultado(null);
    setReconocimiento(null);
    setError("");
    setErrorReconocimiento("");
    setFase("");
    setBloquearSeleccion(false);

    if (inputArchivo.current) {
      inputArchivo.current.value = "";
    }
  }

  async function seleccionarArchivo(nuevo: File | undefined) {
    if (!nuevo || bloqueo.current || bloquearSeleccion) {
      return;
    }

    detenerCamara();
    bloqueo.current = true;
    setOcupado(true);
    setFase("Comprobando fotografía…");
    setError("");

    let nuevaURL: string | null = null;

    try {
      await validarArchivoImagen(nuevo);

      nuevaURL = URL.createObjectURL(nuevo);

      // Comprobar que el navegador pueda abrir la imagen seleccionada.
      const imagen = new window.Image();
      imagen.src = nuevaURL;
      await imagen.decode();

      if (urlActual.current) {
        URL.revokeObjectURL(urlActual.current);
      }

      urlActual.current = nuevaURL;
      nuevaURL = null;

      setArchivo(nuevo);
      setVistaPrevia(urlActual.current);
      setResultado(null);
      setReconocimiento(null);
      setErrorReconocimiento("");
      operacion.current = null;
    } catch (errorArchivo) {
      if (nuevaURL) {
        URL.revokeObjectURL(nuevaURL);
      }

      setError(
        errorArchivo instanceof Error
          ? errorArchivo.message
          : "No se pudo abrir esa fotografía."
      );
    } finally {
      setFase("");
      setOcupado(false);
      bloqueo.current = false;

      if (inputArchivo.current) {
        inputArchivo.current.value = "";
      }
    }
  }

  async function solicitarReconocimiento(id: string) {
    const respuesta = await fetch(
      `/api/identificaciones/${id}/resultado`,
      {
        method: "POST",
        cache: "no-store",
      }
    );
    const datos: unknown = await respuesta.json();

    if (!respuesta.ok) {
      throw new Error(
        obtenerError(
          datos,
          "La fotografía se guardó, pero no se pudo completar el análisis."
        )
      );
    }

    const resultadoAnalisis = obtenerResultadoReconocimiento(datos);
    if (!resultadoAnalisis) {
      throw new Error("El servicio devolvió un resultado no válido.");
    }

    setReconocimiento(resultadoAnalisis);
    setErrorReconocimiento("");
  }

  async function reintentarReconocimiento() {
    if (!resultado || ocupado) {
      return;
    }

    setOcupado(true);
    setErrorReconocimiento("");
    setFase("Analizando con el modelo de Puebla y la cobertura externa…");

    try {
      await solicitarReconocimiento(resultado.id);
    } catch (errorAnalisis) {
      setErrorReconocimiento(
        errorAnalisis instanceof Error
          ? errorAnalisis.message
          : "No se pudo completar el análisis. Inténtalo de nuevo."
      );
    } finally {
      setOcupado(false);
      setFase("");
    }
  }

  async function guardarFotografia() {
    if (!archivo || !usuarioId || bloqueo.current || resultado) {
      return;
    }

    bloqueo.current = true;
    setOcupado(true);
    setError("");

    try {
      // Volver a verificar la cuenta antes de subir el archivo.
      setFase("Verificando sesión…");

      const respuestaPerfil = await fetch("/api/perfil", {
        cache: "no-store",
      });

      const datosPerfil: unknown = await respuestaPerfil.json();

      if (!respuestaPerfil.ok) {
        throw new Error(
          obtenerError(datosPerfil, "No se pudo verificar tu sesión.")
        );
      }

      if (
        !esObjeto(datosPerfil) ||
        !esObjeto(datosPerfil.perfil) ||
        datosPerfil.perfil.id !== usuarioId ||
        datosPerfil.perfil.activo !== true
      ) {
        throw new Error(
          "La sesión cambió. Recarga la página antes de continuar."
        );
      }

      const formato = await validarArchivoImagen(archivo);

      if (!operacion.current) {
        operacion.current = {
          id: crypto.randomUUID(),
          usuarioId,
          extension: formato.extension,
          subida: false,
        };
      }

      const actual = operacion.current;
      const ruta =
        `${actual.usuarioId}/${actual.id}.${actual.extension}`;

      setBloquearSeleccion(true);

      if (!actual.subida) {
        setFase("Subiendo fotografía…");

        const { error: errorSubida } = await supabase.storage
          .from(BUCKET_IDENTIFICACIONES)
          .upload(ruta, archivo, {
            contentType: formato.mime,
            cacheControl: "0",
            upsert: false,
          });

        if (errorSubida) {
          // Si se perdió la respuesta de una subida anterior, el archivo
          // podría existir. Verificamos la misma ruta antes de reintentar.
          const { data: existente, error: errorExistente } =
            await supabase.storage
              .from(BUCKET_IDENTIFICACIONES)
              .download(ruta);

          if (errorExistente || !existente) {
            throw new Error(
              "No se pudo subir la fotografía. Comprueba tu conexión y reintenta."
            );
          }

          const formatoExistente =
            await validarArchivoImagen(existente);

          if (
            formatoExistente.extension !== actual.extension ||
            existente.size !== archivo.size
          ) {
            throw new Error(
              "No se pudo verificar el archivo subido."
            );
          }
        }

        actual.subida = true;
      }

      setFase("Registrando solicitud…");

      const respuesta = await fetch("/api/identificaciones", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: actual.id,
          extension: actual.extension,
        }),
        cache: "no-store",
      });

      const datos: unknown = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(
          obtenerError(datos, "No se pudo registrar la solicitud.")
        );
      }

      const identificacion = obtenerIdentificacion(datos);

      if (!identificacion || identificacion.id !== actual.id) {
        throw new Error(
          "No se pudo confirmar el registro. Reintenta en esta pantalla."
        );
      }

      setResultado(identificacion);
      setReconocimiento(null);
      setErrorReconocimiento("");
      setFase("Analizando con el modelo de Puebla y la cobertura externa…");

      try {
        await solicitarReconocimiento(identificacion.id);
      } catch (errorAnalisis) {
        setErrorReconocimiento(
          errorAnalisis instanceof Error
            ? errorAnalisis.message
            : "La fotografía se guardó, pero no se pudo completar el análisis."
        );
      }
    } catch (errorGuardado) {
      setError(
        errorGuardado instanceof Error
          ? errorGuardado.message
          : "No se pudo confirmar el envío. Reintenta en esta pantalla."
      );
    } finally {
      setOcupado(false);
      setFase("");
      bloqueo.current = false;
    }
  }

  const puedeSeleccionar =
    Boolean(usuarioId) && !ocupado && !bloquearSeleccion;

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
            <Link href="/historial" className="transition hover:text-white">
              Mi historial
            </Link>
            <Link href="/perfil" className="transition hover:text-white">
              Mi perfil
            </Link>
          </nav>
        </header>

        <section className="pb-10 pt-12 sm:pt-16">
          <span className="inline-flex rounded-full border border-emerald-300/20 bg-emerald-300/5 px-3 py-1 text-xs font-medium text-emerald-200">
            Una fotografía, una nueva pregunta
          </span>

          <h1 className="mt-5 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Acércate a la naturaleza.
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-7 text-white/60">
            Toma una fotografía con la cámara o selecciona una de tu
            dispositivo. Podrás revisarla antes de guardarla y analizarla.
          </p>
        </section>

        {comprobandoSesion ? (
          <div
            role="status"
            className="rounded-3xl border border-white/10 bg-white/5 p-8 text-white/65"
          >
            Comprobando tu sesión…
          </div>
        ) : !usuarioId ? (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <h2 className="text-xl font-semibold">
              Inicia sesión para continuar
            </h2>

            <p role="alert" className="mt-3 text-sm text-white/60">
              {error || "Necesitas una cuenta para guardar fotografías."}
            </p>

            <Link
              href="/login"
              className="mt-6 inline-flex rounded-xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-[#071411] transition hover:bg-emerald-200"
            >
              Ir al inicio de sesión
            </Link>
          </section>
        ) : (
          <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
            <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#0d211b]">
              <div className="border-b border-white/10 px-6 py-5">
                <h2 className="font-semibold">Tu fotografía</h2>
                <p className="mt-1 text-sm text-white/50">
                  JPEG, PNG o WebP · Hasta 5 MB
                </p>
              </div>

              <div className="p-5 sm:p-7">
                {camaraActiva ? (
                  <div className="overflow-hidden rounded-2xl bg-black">
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      aria-label="Vista previa de la cámara"
                      className="max-h-[480px] min-h-80 w-full object-contain"
                    />
                  </div>
                ) : vistaPrevia ? (
                  <div className="relative flex min-h-80 items-center justify-center overflow-hidden rounded-2xl bg-black/25">
                    <Image
                      src={vistaPrevia}
                      alt="Vista previa de la fotografía seleccionada"
                      width={1200}
                      height={900}
                      unoptimized
                      className="max-h-[480px] w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex min-h-80 flex-col items-center justify-center rounded-2xl border border-dashed border-emerald-200/25 bg-emerald-300/5 px-6 text-center">
                    <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-300/10 text-emerald-200">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        className="h-8 w-8"
                        aria-hidden="true"
                      >
                        <rect x="3" y="5" width="18" height="15" rx="3" />
                        <circle cx="8" cy="10" r="1.5" />
                        <path d="m3 17 5-4 4 3 4-5 5 6" />
                      </svg>
                    </span>

                    <p className="mt-5 text-lg font-medium">
                      Empieza con una fotografía
                    </p>
                    <p className="mt-2 max-w-sm text-sm leading-6 text-white/50">
                      Busca buena iluminación y procura que la planta
                      o el animal ocupe la mayor parte de la imagen.
                    </p>
                  </div>
                )}

                <input
                  ref={inputArchivo}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  aria-label="Seleccionar fotografía"
                  className="sr-only"
                  disabled={!puedeSeleccionar}
                  onChange={(event) => {
                    void seleccionarArchivo(event.target.files?.[0]);
                  }}
                />

                {archivo && (
                  <div className="mt-4 flex flex-wrap justify-between gap-2 text-xs text-white/50">
                    <span className="max-w-full break-all">
                      {archivo.name}
                    </span>
                    <span>
                      {(archivo.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </div>
                )}

                {error && (
                  <p
                    role="alert"
                    className="mt-5 rounded-xl border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm text-red-200"
                  >
                    {error}
                  </p>
                )}

                {ocupado && (
                  <p
                    role="status"
                    className="mt-5 text-sm text-emerald-200"
                  >
                    {fase}
                  </p>
                )}

                {resultado ? (
                  <div className="mt-5">
                    <div
                      role={errorReconocimiento ? "alert" : "status"}
                      className="rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-5"
                    >
                      <h3 className="font-semibold text-emerald-200">
                        {reconocimiento?.especie
                          ? "Identificación sugerida"
                          : reconocimiento
                            ? "No se encontró una coincidencia"
                            : errorReconocimiento
                              ? "Fotografía guardada"
                              : "Analizando fotografía…"}
                      </h3>
                      {reconocimiento?.especie && (
                        <>
                          <p className="mt-3 text-lg font-semibold">
                            {reconocimiento.especie.nombre_comun}
                          </p>
                          <p className="mt-1 text-sm italic text-white/65">
                            {reconocimiento.especie.nombre_cientifico}
                          </p>
                          {reconocimiento.especie.imagen_url && (
                            <div className="relative mt-4 aspect-[16/9] overflow-hidden rounded-xl border border-white/10">
                              <Image
                                src={reconocimiento.especie.imagen_url}
                                alt={`Imagen de ${reconocimiento.especie.nombre_comun}`}
                                fill
                                sizes="(max-width: 768px) 100vw, 640px"
                                unoptimized
                                className="object-cover"
                              />
                            </div>
                          )}
                          <p className="mt-3 text-sm leading-6 text-white/65">
                            {reconocimiento.mensaje}
                          </p>
                          <div className="mt-4 flex flex-wrap gap-2 text-xs">
                            <span className="rounded-full border border-emerald-200/20 px-3 py-1 text-emerald-100">
                              {reconocimiento.fuente === "modelo_puebla"
                                ? "Modelo Puebla"
                                : "iNaturalist"}
                            </span>
                            {reconocimiento.confianza !== null && (
                              <span className="rounded-full border border-white/15 px-3 py-1 text-white/70">
                                {reconocimiento.fuente === "inaturalist"
                                  ? `Puntaje relativo iNaturalist: ${(reconocimiento.confianza * 100).toFixed(1)}/100`
                                  : `${(reconocimiento.confianza * 100).toFixed(1)}% de confianza`}
                              </span>
                            )}
                          </div>
                          {(reconocimiento.especie.habitat ||
                            reconocimiento.especie.estado_conservacion) && (
                            <dl className="mt-4 space-y-2 border-t border-white/10 pt-4 text-sm">
                              {reconocimiento.especie.habitat && (
                                <div>
                                  <dt className="font-medium text-white/80">
                                    Hábitat
                                  </dt>
                                  <dd className="mt-1 text-white/60">
                                    {reconocimiento.especie.habitat}
                                  </dd>
                                </div>
                              )}
                              {reconocimiento.especie.estado_conservacion && (
                                <div>
                                  <dt className="font-medium text-white/80">
                                    Estado de conservación
                                  </dt>
                                  <dd className="mt-1 text-white/60">
                                    {reconocimiento.especie.estado_conservacion}
                                  </dd>
                                </div>
                              )}
                            </dl>
                          )}
                          {reconocimiento.especie.id && (
                            <Link
                              href={`/especies/${reconocimiento.especie.id}`}
                              className="mt-4 inline-flex text-sm font-medium text-emerald-200 underline-offset-4 hover:underline"
                            >
                              Ver ficha completa
                            </Link>
                          )}
                        </>
                      )}
                      {!reconocimiento?.especie && reconocimiento && (
                        <p className="mt-2 text-sm leading-6 text-white/65">
                          {reconocimiento.mensaje}
                        </p>
                      )}
                      {errorReconocimiento && (
                        <p className="mt-2 text-sm leading-6 text-amber-100">
                          {errorReconocimiento}
                        </p>
                      )}
                      {!reconocimiento && !errorReconocimiento && (
                        <p className="mt-2 text-sm leading-6 text-white/65">
                          {fase || "Consultando los modelos de identificación…"}
                        </p>
                      )}
                      <p className="mt-3 break-all text-xs text-white/40">
                        Solicitud: {resultado.id}
                      </p>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-3">
                      {errorReconocimiento && (
                        <button
                          type="button"
                          disabled={ocupado}
                          onClick={() => void reintentarReconocimiento()}
                          className="rounded-xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-[#071411] transition hover:bg-emerald-200 disabled:opacity-40"
                        >
                          {ocupado ? "Analizando…" : "Reintentar análisis"}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={limpiarSeleccion}
                        className="rounded-xl border border-white/15 px-5 py-3 text-sm font-medium transition hover:bg-white/5 disabled:opacity-40"
                      >
                        Identificar otra fotografía
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={!puedeSeleccionar}
                      onClick={() => inputArchivo.current?.click()}
                      className="rounded-xl border border-white/15 px-5 py-3 text-sm font-medium transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {archivo ? "Cambiar fotografía" : "Seleccionar fotografía"}
                    </button>
                    {camaraActiva ? (
                      <button
                        type="button"
                        disabled={!puedeSeleccionar}
                        onClick={() => void capturarFotograma()}
                        className="rounded-xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-[#071411] transition hover:bg-emerald-200 disabled:opacity-40"
                      >
                        Capturar fotografía
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={!puedeSeleccionar}
                        onClick={() => void abrirCamara()}
                        className="rounded-xl border border-emerald-200/30 px-5 py-3 text-sm font-medium text-emerald-100 transition hover:bg-emerald-300/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Abrir cámara
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={!archivo || ocupado}
                      onClick={() => void guardarFotografia()}
                      className="rounded-xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-[#071411] transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {ocupado
                        ? "Guardando…"
                        : bloquearSeleccion
                          ? "Reintentar envío"
                          : "Guardar fotografía"}
                    </button>
                  </div>
                )}
              </div>
            </section>

            <aside className="space-y-5">
              <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                <h2 className="font-semibold">Una fotografía más clara</h2>

                <ul className="mt-4 space-y-4 text-sm leading-6 text-white/60">
                  <li>Utiliza luz natural cuando sea posible.</li>
                  <li>Evita imágenes borrosas o demasiado lejanas.</li>
                  <li>Fotografía una planta o un animal a la vez.</li>
                  <li>
                    Mantén distancia y evita manipular especies que
                    no conoces.
                  </li>
                </ul>
              </section>

              <section className="rounded-3xl border border-emerald-300/15 bg-emerald-300/5 p-6">
                <h2 className="font-semibold text-emerald-200">
                  Tu fotografía es privada
                </h2>

                <p className="mt-3 text-sm leading-6 text-white/60">
                  Se guarda dentro de tu cuenta y no se publica
                  en el catálogo de especies.
                </p>
              </section>

              <section className="rounded-3xl border border-amber-200/15 bg-amber-200/5 p-6">
                <h2 className="font-semibold text-amber-100">
                  Identificación asistida
                </h2>

                <p className="mt-3 text-sm leading-6 text-white/60">
                  Primero se consulta el modelo especializado en especies
                  de Puebla. Si no supera el umbral de confianza, se usa
                  iNaturalist como cobertura complementaria.
                </p>
              </section>
            </aside>
          </div>
        )}

        <footer className="mt-12 border-t border-white/10 py-6 text-xs text-white/35">
          NATURA GO · Flora y fauna de Puebla
        </footer>
      </div>
    </main>
  );
}