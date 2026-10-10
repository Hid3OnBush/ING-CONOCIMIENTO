"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";

type Perfil = {
  id: string;
  nombre: string;
  apellido_paterno: string | null;
  apellido_materno: string | null;
  rol: "USUARIO" | "ADMIN";
  activo: boolean;
  avatar_url: string | null;
  correo: string | null;
};

type Formulario = {
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
};

const formularioVacio: Formulario = {
  nombre: "",
  apellido_paterno: "",
  apellido_materno: "",
};

const campos = [
  {
    clave: "nombre",
    etiqueta: "Nombre",
    ejemplo: "Tu nombre",
  },
  {
    clave: "apellido_paterno",
    etiqueta: "Apellido paterno",
    ejemplo: "Opcional",
  },
  {
    clave: "apellido_materno",
    etiqueta: "Apellido materno",
    ejemplo: "Opcional",
  },
] as const;

function formularioDesdePerfil(perfil: Perfil): Formulario {
  return {
    nombre: perfil.nombre,
    apellido_paterno: perfil.apellido_paterno ?? "",
    apellido_materno: perfil.apellido_materno ?? "",
  };
}

function validarPerfil(valor: unknown): valor is Perfil {
  if (typeof valor !== "object" || valor === null) return false;

  const perfil = valor as Record<string, unknown>;

  return (
    typeof perfil.id === "string" &&
    typeof perfil.nombre === "string" &&
    (perfil.apellido_paterno === null ||
      typeof perfil.apellido_paterno === "string") &&
    (perfil.apellido_materno === null ||
      typeof perfil.apellido_materno === "string") &&
    (perfil.rol === "USUARIO" || perfil.rol === "ADMIN") &&
    typeof perfil.activo === "boolean" &&
    (perfil.avatar_url === null || typeof perfil.avatar_url === "string") &&
    (perfil.correo === null || typeof perfil.correo === "string")
  );
}

export default function PerfilPage() {
  const [perfil, setPerfil] = useState<Perfil | null>(null);
  const [formulario, setFormulario] = useState(formularioVacio);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [intento, setIntento] = useState(0);

  const bloqueo = useRef(false);

  useEffect(() => {
    const controlador = new AbortController();

    async function cargar() {
      try {
        const respuesta = await fetch("/api/perfil", {
          cache: "no-store",
          signal: controlador.signal,
        });

        const datos = await respuesta.json();

        if (!respuesta.ok) {
          throw new Error(
            typeof datos.error === "string"
              ? datos.error
              : "No se pudo consultar tu perfil."
          );
        }

        if (!validarPerfil(datos.perfil)) {
          throw new Error("El servidor devolvió una respuesta inesperada.");
        }

        if (controlador.signal.aborted) return;

        setPerfil(datos.perfil);
        setFormulario(formularioDesdePerfil(datos.perfil));
        setError("");
      } catch (problema) {
        if (controlador.signal.aborted) return;

        setError(
          problema instanceof Error
            ? problema.message
            : "No se pudo cargar tu perfil."
        );
      } finally {
        if (!controlador.signal.aborted) setCargando(false);
      }
    }

    void cargar();

    return () => controlador.abort();
  }, [intento]);

  function reintentar() {
    setError("");
    setMensaje("");
    setCargando(true);
    setIntento((actual) => actual + 1);
  }

  function restaurar() {
    if (!perfil) return;

    setFormulario(formularioDesdePerfil(perfil));
    setError("");
    setMensaje("");
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    if (!perfil || bloqueo.current) return;

    const nombre = formulario.nombre
      .normalize("NFC")
      .trim()
      .replace(/\s+/g, " ");

    if (nombre.length < 2 || nombre.length > 100) {
      setError("El nombre debe tener entre 2 y 100 caracteres.");
      setMensaje("");
      return;
    }

    bloqueo.current = true;
    setProcesando(true);
    setError("");
    setMensaje("");

    try {
      const respuesta = await fetch("/api/perfil", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          nombre,
          apellido_paterno: formulario.apellido_paterno.trim() || null,
          apellido_materno: formulario.apellido_materno.trim() || null,
        }),
      });

      const datos = await respuesta.json();

      if (!respuesta.ok) {
        throw new Error(
          typeof datos.error === "string"
            ? datos.error
            : "No se pudo guardar tu perfil."
        );
      }

      if (!validarPerfil(datos.perfil)) {
        throw new Error(
          "No se pudo confirmar el resultado. Recarga la página para revisar tus datos."
        );
      }

      setPerfil(datos.perfil);
      setFormulario(formularioDesdePerfil(datos.perfil));
      setMensaje("Tu perfil se actualizó correctamente.");
    } catch (problema) {
      setError(
        problema instanceof Error
          ? problema.message
          : "No se pudo confirmar el guardado. Recarga la página para revisar tus datos."
      );
    } finally {
      bloqueo.current = false;
      setProcesando(false);
    }
  }

  const nombreCompleto = perfil
    ? [
        perfil.nombre,
        perfil.apellido_paterno,
        perfil.apellido_materno,
      ]
        .filter(Boolean)
        .join(" ")
    : "";

  const hayCambios =
    perfil !== null &&
    (
      Object.keys(formulario) as Array<keyof Formulario>
    ).some(
      (campo) =>
        formulario[campo] !== formularioDesdePerfil(perfil)[campo]
    );

  const campo =
    "mt-2 w-full rounded-2xl border border-white/15 bg-black/20 px-4 py-3.5 " +
    "text-sm text-white outline-none transition placeholder:text-slate-500 " +
    "focus:border-emerald-300 focus:ring-4 focus:ring-emerald-300/10 " +
    "disabled:opacity-50";

  const botonSecundario =
    "rounded-xl border border-white/15 px-4 py-3 text-sm font-medium " +
    "transition hover:bg-white/5 focus-visible:outline-2 " +
    "focus-visible:outline-emerald-300 disabled:opacity-40";

  return (
    <main className="relative isolate min-h-screen bg-[#071411] text-slate-100">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.10),transparent_60%)]"
      />

      <div className="mx-auto max-w-5xl px-6 py-8 sm:px-10">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <Link
            href="/"
            className="rounded-lg focus-visible:outline-2 focus-visible:outline-emerald-300"
          >
            <span className="block text-lg font-semibold">NATURA GO</span>
            <span className="text-[10px] uppercase tracking-widest text-emerald-200/60">
              Puebla
            </span>
          </Link>

          <nav aria-label="Navegación de cuenta" className="flex gap-3">
            <Link href="/" className={botonSecundario}>
              Catálogo
            </Link>
            <Link href="/login" className={botonSecundario}>
              Mi cuenta
            </Link>
          </nav>
        </header>

        <section className="py-10">
          <p className="text-xs font-medium uppercase tracking-widest text-emerald-300">
            Tu espacio
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            Mi perfil
          </h1>
          <p className="mt-4 text-sm leading-6 text-slate-400">
            Consulta tu cuenta y mantén actualizados tus datos personales.
          </p>
        </section>

        {cargando ? (
          <section
            role="status"
            className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-sm text-slate-400"
          >
            Cargando tu perfil…
          </section>
        ) : !perfil ? (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-8">
            <p role="alert" className="text-sm text-rose-200">
              {error}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link href="/login" className={botonSecundario}>
                Ir a iniciar sesión
              </Link>
              <button
                type="button"
                onClick={reintentar}
                className={botonSecundario}
              >
                Reintentar
              </button>
            </div>
          </section>
        ) : (
          <div className="grid items-start gap-6 md:grid-cols-[300px_1fr]">
            <aside className="rounded-3xl border border-white/10 bg-white/5 p-7">
              <div
                aria-hidden="true"
                className="flex h-20 w-20 items-center justify-center rounded-3xl border border-emerald-300/20 bg-emerald-300/10 text-3xl font-semibold text-emerald-200"
              >
                {perfil.nombre.trim().slice(0, 1).toUpperCase()}
              </div>

              <h2 className="mt-6 break-words text-xl font-semibold">
                {nombreCompleto}
              </h2>

              <p className="mt-3 break-all text-sm leading-6 text-slate-400">
                {perfil.correo ?? "Correo no disponible"}
              </p>

              <dl className="mt-7 space-y-4 border-t border-white/10 pt-5 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Tipo de cuenta</dt>
                  <dd>
                    {perfil.rol === "ADMIN" ? "Administrador" : "Usuario"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-400">Estado</dt>
                  <dd className="text-emerald-200">
                    {perfil.activo ? "Activa" : "Inactiva"}
                  </dd>
                </div>
              </dl>

              {perfil.rol === "ADMIN" && (
                <Link
                  href="/admin/especies"
                  prefetch={false}
                  className="mt-7 block rounded-xl border border-emerald-300/20 px-4 py-3 text-center text-sm text-emerald-200 transition hover:bg-emerald-300/10"
                >
                  Administrar especies
                </Link>
              )}
            </aside>

            <section className="rounded-3xl border border-white/10 bg-white/5 p-6 sm:p-8">
              <h2 className="text-xl font-semibold">Datos personales</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Los apellidos son opcionales.
              </p>

              <form onSubmit={guardar} className="mt-7">
                <fieldset disabled={procesando} className="space-y-5">
                  {campos.map(({ clave, etiqueta, ejemplo }) => (
                    <div key={clave}>
                      <label htmlFor={clave} className="text-sm font-medium">
                        {etiqueta}
                      </label>
                      <input
                        id={clave}
                        name={clave}
                        type="text"
                        autoComplete={
                          clave === "nombre" ? "given-name" : "off"
                        }
                        required={clave === "nombre"}
                        minLength={clave === "nombre" ? 2 : undefined}
                        maxLength={100}
                        placeholder={ejemplo}
                        value={formulario[clave]}
                        onChange={(evento) =>
                          setFormulario((actual) => ({
                            ...actual,
                            [clave]: evento.target.value,
                          }))
                        }
                        className={campo}
                      />
                    </div>
                  ))}

                  <div className="flex flex-wrap gap-3 pt-3">
                    <button
                      type="submit"
                      disabled={!hayCambios || procesando}
                      className="rounded-xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {procesando ? "Guardando…" : "Guardar cambios"}
                    </button>

                    <button
                      type="button"
                      onClick={restaurar}
                      disabled={!hayCambios || procesando}
                      className={botonSecundario}
                    >
                      Cancelar cambios
                    </button>
                  </div>
                </fieldset>
              </form>

              {mensaje && (
                <p
                  role="status"
                  className="mt-6 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm text-emerald-200"
                >
                  {mensaje}
                </p>
              )}

              {error && (
                <p
                  role="alert"
                  className="mt-6 rounded-xl border border-rose-300/20 bg-rose-300/10 p-4 text-sm text-rose-200"
                >
                  {error}
                </p>
              )}
            </section>
          </div>
        )}

        <footer className="mt-12 border-t border-white/10 py-6 text-xs text-slate-500">
          NATURA GO · Flora y fauna de Puebla
        </footer>
      </div>
    </main>
  );
}