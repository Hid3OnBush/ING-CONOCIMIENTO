"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { crearClienteNavegador } from "@/lib/supabase/navegador";

export default function RegistroPage() {
  const [supabase] = useState(() => crearClienteNavegador());
  const [nombre, setNombre] = useState("");
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [comprobando, setComprobando] = useState(true);
  const [sesionActiva, setSesionActiva] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [hayError, setHayError] = useState(false);
  const bloqueo = useRef(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      setSesionActiva(Boolean(sesion));
      setComprobando(false);
    });

    return () => data.subscription.unsubscribe();
  }, [supabase]);

  function informar(texto: string, error = false) {
    setMensaje(texto);
    setHayError(error);
  }

  async function registrar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    if (bloqueo.current || sesionActiva || enviado) return;

    informar("");

    const nombreLimpio = nombre
      .normalize("NFC")
      .trim()
      .replace(/\s+/g, " ");

    if (nombreLimpio.length < 2 || nombreLimpio.length > 100) {
      informar("Escribe un nombre de entre 2 y 100 caracteres.", true);
      return;
    }

    if (contrasena.length < 8) {
      informar("Utiliza una contraseña de al menos 8 caracteres.", true);
      return;
    }

    if (contrasena !== confirmacion) {
      informar("Las contraseñas no coinciden.", true);
      return;
    }

    bloqueo.current = true;
    setProcesando(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email: correo.trim(),
        password: contrasena,
        options: {
          data: { nombre: nombreLimpio },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        if (error.status === 429) {
          informar(
            "Se alcanzó el límite temporal de solicitudes. Espera antes de intentarlo nuevamente.",
            true
          );
        } else if (error.code === "weak_password") {
          informar(
            "La contraseña no cumple los requisitos del proyecto. Utiliza una contraseña más fuerte.",
            true
          );
        } else {
          informar(
            "No se pudo completar el registro. Revisa tus datos o intenta iniciar sesión si ya tienes una cuenta.",
            true
          );
        }

        return;
      }

      setContrasena("");
      setConfirmacion("");
      setMostrar(false);
      setEnviado(true);

      informar(
        data.session
          ? "Tu cuenta se creó y la sesión está activa."
          : "Solicitud recibida. Si el registro procede, recibirás un correo de confirmación. Revisa también la carpeta de spam. Si ya tienes cuenta, inicia sesión."
      );
    } catch {
      informar(
        "No se pudo confirmar el resultado. Revisa tu correo antes de volver a intentar el registro.",
        true
      );
    } finally {
      bloqueo.current = false;
      setProcesando(false);
    }
  }

  const campo =
    "mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 " +
    "text-sm text-white outline-none transition placeholder:text-slate-500 " +
    "focus:border-emerald-400/60 focus:ring-4 focus:ring-emerald-400/10 " +
    "disabled:opacity-50";

  const boton =
    "flex w-full items-center justify-center rounded-2xl bg-emerald-300 " +
    "px-5 py-3.5 text-sm font-semibold text-emerald-950 transition " +
    "hover:bg-emerald-200 focus-visible:outline-2 " +
    "focus-visible:outline-offset-4 focus-visible:outline-emerald-300 " +
    "disabled:cursor-wait disabled:opacity-60";

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#071411] text-slate-100">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_left,rgba(16,185,129,0.12),transparent_60%)]"
      />

      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 sm:px-10 lg:px-12">
        <header className="flex items-center justify-between gap-4 py-8">
          <Link
            href="/"
            aria-label="Natura Go, inicio"
            className="rounded-lg focus-visible:outline-2 focus-visible:outline-emerald-300"
          >
            <span className="block text-lg font-semibold tracking-tight">
              NATURA GO
            </span>
            <span className="text-[10px] uppercase tracking-widest text-emerald-200/60">
              Puebla
            </span>
          </Link>

          <Link
            href="/login"
            className="rounded-xl border border-white/15 px-4 py-2 text-sm transition hover:bg-white/5"
          >
            Iniciar sesión
          </Link>
        </header>

        <div className="grid flex-1 items-center gap-12 py-8 lg:grid-cols-2 lg:gap-20">
          <section className="max-w-xl">
            <p className="text-xs font-medium uppercase tracking-widest text-emerald-300">
              Conecta con tu entorno
            </p>

            <h1 className="mt-6 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
              Tu curiosidad,
              <br />
              un nuevo
              <br />
              <span className="text-emerald-300">comienzo.</span>
            </h1>

            <p className="mt-6 max-w-md text-base leading-7 text-slate-400">
              Crea tu cuenta y conoce las plantas y animales del catálogo
              de Puebla. Cada especie es una oportunidad para descubrir
              algo nuevo.
            </p>

            <div className="mt-8 rounded-3xl border border-emerald-300/15 bg-emerald-300/5 p-6">
              <p className="font-medium text-emerald-100">
                La naturaleza empieza cerca de ti.
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Explora las fichas, conoce sus características y consulta
                las fuentes de información.
              </p>
            </div>
          </section>

          <section
            aria-labelledby="titulo-registro"
            className="rounded-4xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-black/20 sm:p-10"
          >
            <p className="text-xs font-medium uppercase tracking-widest text-emerald-300">
              Tu espacio
            </p>

            <h2
              id="titulo-registro"
              className="mt-3 text-3xl font-semibold tracking-tight"
            >
              Crea tu cuenta.
            </h2>

            {comprobando ? (
              <p role="status" className="mt-8 text-sm text-slate-400">
                Comprobando tu sesión…
              </p>
            ) : sesionActiva || enviado ? (
              <div className="mt-6">
                <p className="text-sm leading-6 text-slate-400">
                  {sesionActiva
                    ? "Ya tienes una sesión activa. Puedes continuar al catálogo o gestionar tu sesión en Mi cuenta."
                    : "Abre el enlace de confirmación en este mismo navegador para completar el registro."}
                </p>

                <Link href="/login" className={`${boton} mt-6`}>
                  Ir a mi cuenta
                </Link>

                <Link
                  href="/"
                  className="mt-4 block rounded-xl py-2 text-center text-sm text-emerald-200 hover:text-emerald-100"
                >
                  Explorar catálogo
                </Link>
              </div>
            ) : (
              <>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  Completa tus datos para registrarte.
                </p>

                <form onSubmit={registrar} className="mt-7">
                  <fieldset disabled={procesando} className="space-y-5">
                    <div>
                      <label htmlFor="nombre" className="text-sm font-medium">
                        Nombre
                      </label>
                      <input
                        id="nombre"
                        name="nombre"
                        autoComplete="given-name"
                        required
                        minLength={2}
                        maxLength={100}
                        placeholder="Tu nombre"
                        value={nombre}
                        onChange={(evento) => setNombre(evento.target.value)}
                        className={campo}
                      />
                    </div>

                    <div>
                      <label htmlFor="correo" className="text-sm font-medium">
                        Correo electrónico
                      </label>
                      <input
                        id="correo"
                        name="email"
                        type="email"
                        autoComplete="email"
                        required
                        maxLength={254}
                        placeholder="tu@correo.com"
                        value={correo}
                        onChange={(evento) => setCorreo(evento.target.value)}
                        className={campo}
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-3">
                        <label
                          htmlFor="contrasena"
                          className="text-sm font-medium"
                        >
                          Contraseña
                        </label>
                        <button
                          type="button"
                          aria-controls="contrasena confirmacion"
                          aria-pressed={mostrar}
                          onClick={() => setMostrar((actual) => !actual)}
                          className="rounded-lg px-2 py-1 text-xs text-emerald-200 focus-visible:outline-2 focus-visible:outline-emerald-300"
                        >
                          {mostrar ? "Ocultar" : "Mostrar"}
                        </button>
                      </div>

                      <input
                        id="contrasena"
                        name="password"
                        type={mostrar ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        minLength={8}
                        maxLength={128}
                        aria-describedby="ayuda-contrasena"
                        value={contrasena}
                        onChange={(evento) =>
                          setContrasena(evento.target.value)
                        }
                        className={campo}
                      />

                      <p
                        id="ayuda-contrasena"
                        className="mt-2 text-xs text-slate-400"
                      >
                        Al menos 8 caracteres. Puedes usar una frase larga.
                      </p>
                    </div>

                    <div>
                      <label
                        htmlFor="confirmacion"
                        className="text-sm font-medium"
                      >
                        Confirmar contraseña
                      </label>
                      <input
                        id="confirmacion"
                        name="password-confirmation"
                        type={mostrar ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        minLength={8}
                        maxLength={128}
                        value={confirmacion}
                        onChange={(evento) =>
                          setConfirmacion(evento.target.value)
                        }
                        className={campo}
                      />
                    </div>

                    <button type="submit" className={boton}>
                      {procesando ? "Creando cuenta…" : "Crear cuenta"}
                    </button>
                  </fieldset>
                </form>

                <p className="mt-6 text-center text-sm text-slate-400">
                  ¿Ya tienes cuenta?{" "}
                  <Link
                    href="/login"
                    className="font-medium text-emerald-300 hover:underline"
                  >
                    Inicia sesión
                  </Link>
                </p>
              </>
            )}

            {mensaje && (
              <p
                role={hayError ? "alert" : "status"}
                className={`mt-5 rounded-xl border p-4 text-sm leading-6 ${
                  hayError
                    ? "border-rose-300/20 bg-rose-400/10 text-rose-200"
                    : "border-emerald-300/20 bg-emerald-300/10 text-emerald-200"
                }`}
              >
                {mensaje}
              </p>
            )}
          </section>
        </div>

        <footer className="mt-8 border-t border-white/10 py-6 text-xs text-slate-500">
          NATURA GO · Flora y fauna de Puebla
        </footer>
      </div>
    </main>
  );
}