"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { crearClienteNavegador } from "@/lib/supabase/navegador";

export default function LoginPage() {
  const [supabase] = useState(() => crearClienteNavegador());
  const [correo, setCorreo] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [correoUsuario, setCorreoUsuario] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [hayError, setHayError] = useState(false);

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_evento, sesion) => {
      setCorreoUsuario(sesion?.user.email ?? null);
      setCargando(false);
    });

    return () => data.subscription.unsubscribe();
  }, [supabase]);

  function informar(texto: string, error = false) {
    setMensaje(texto);
    setHayError(error);
  }

  async function iniciarSesion(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setProcesando(true);
    informar("");

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: correo.trim(),
        password: contrasena,
      });

      if (error) {
        informar(
          "No pudimos iniciar sesión. Revisa tus datos y la confirmación de tu cuenta.",
          true
        );
        return;
      }

      setContrasena("");
      setMostrarContrasena(false);
      informar("Tu sesión se inició correctamente.");
    } catch {
      informar("No pudimos conectar. Intenta nuevamente.", true);
    } finally {
      setProcesando(false);
    }
  }

  async function cerrarSesion() {
    setProcesando(true);
    informar("");

    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });

      if (error) {
        informar("No pudimos cerrar tu sesión. Intenta nuevamente.", true);
        return;
      }

      setContrasena("");
      setMostrarContrasena(false);
      informar("Cerraste tu sesión correctamente.");
    } catch {
      informar("No pudimos conectar. Intenta nuevamente.", true);
    } finally {
      setProcesando(false);
    }
  }

  const campo =
    "w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3.5 " +
    "text-sm text-white outline-none transition placeholder:text-slate-500 " +
    "focus:border-emerald-400/60 focus:ring-4 focus:ring-emerald-400/10 " +
    "disabled:opacity-50";

  const boton =
    "flex w-full items-center justify-center gap-3 rounded-2xl " +
    "bg-emerald-300 px-5 py-3.5 text-sm font-semibold text-emerald-950 " +
    "transition hover:bg-emerald-200 focus-visible:outline-2 " +
    "focus-visible:outline-offset-4 focus-visible:outline-emerald-300 " +
    "disabled:cursor-wait disabled:opacity-60";

  return (
    <main className="relative isolate min-h-screen overflow-hidden bg-[#071411] text-slate-100 selection:bg-emerald-300 selection:text-emerald-950">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute -left-48 -top-48 h-[600px] w-[600px] rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute -bottom-56 -right-40 h-[600px] w-[600px] rounded-full bg-teal-500/10 blur-[120px]" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 sm:px-10 lg:px-12">
        <header className="flex items-center justify-between gap-4 py-8">
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
        </header>

        <div className="grid flex-1 items-center gap-12 py-8 lg:grid-cols-[1.15fr_1fr] lg:gap-20 lg:py-12">
          <section className="max-w-xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-300/5 px-3 py-1.5 text-xs text-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
              DISCOVER THE WILD
            </div>

            <h1 className="text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-6xl">
              Cada especie,
              <br />
              una historia
              <br />
              <span className="text-emerald-300">por descubrir.</span>
            </h1>

            <p className="mt-6 max-w-md text-base leading-7 text-slate-400">
              Conoce las plantas y animales de nuestro entorno. Un espacio
              para acercarte a la naturaleza a través de la información y
              la tecnología.
            </p>

            <div
              aria-hidden="true"
              className="relative mt-10 hidden h-48 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-300/[0.06] to-white/[0.02] sm:block"
            >
              <svg
                viewBox="0 0 500 200"
                fill="none"
                className="absolute inset-0 h-full w-full"
              >
                <circle
                  cx="380"
                  cy="90"
                  r="110"
                  stroke="#6ee7b7"
                  strokeOpacity=".08"
                />
                <circle
                  cx="380"
                  cy="90"
                  r="75"
                  stroke="#6ee7b7"
                  strokeOpacity=".12"
                />
                <path
                  d="M315 210C315 135 350 78 414 20"
                  stroke="#6ee7b7"
                  strokeOpacity=".5"
                  strokeWidth="2"
                />
                <path
                  d="M343 123C295 124 279 89 283 57C324 60 351 78 343 123Z"
                  fill="#34d399"
                  fillOpacity=".15"
                  stroke="#6ee7b7"
                  strokeOpacity=".35"
                />
                <path
                  d="M365 90C411 106 441 81 453 48C412 37 380 51 365 90Z"
                  fill="#34d399"
                  fillOpacity=".2"
                  stroke="#6ee7b7"
                  strokeOpacity=".4"
                />
                <path
                  d="M322 173C277 174 252 152 242 119C290 109 322 132 322 173Z"
                  fill="#34d399"
                  fillOpacity=".12"
                  stroke="#6ee7b7"
                  strokeOpacity=".25"
                />
                <path
                  d="M334 147C386 159 416 141 434 113C391 95 355 113 334 147Z"
                  fill="#34d399"
                  fillOpacity=".12"
                  stroke="#6ee7b7"
                  strokeOpacity=".25"
                />
              </svg>

              <div className="absolute bottom-6 left-6">
                <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-200/60">
                  Nuestro punto de partida
                </p>
                <p className="mt-2 text-lg font-medium">
                  20 especies. Un entorno por conocer.
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Plantas y animales en el catálogo inicial
                </p>
              </div>
            </div>
          </section>

          <section
            aria-labelledby={cargando ? undefined : "titulo-acceso"}
            className="w-full rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-10"
          >
            {cargando ? (
              <div className="flex min-h-80 flex-col items-center justify-center gap-4">
                <Spinner />
                <p role="status" className="text-sm text-slate-400">
                  Comprobando tu sesión…
                </p>
              </div>
            ) : correoUsuario ? (
              <>
                <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-300/10 text-emerald-300">
                  <svg
                    aria-hidden="true"
                    width="26"
                    height="26"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <path
                      d="m5 12 4 4L19 6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-300">
                  Sesión activa
                </p>
                <h2
                  id="titulo-acceso"
                  className="mt-3 text-3xl font-semibold tracking-tight"
                >
                  Bienvenido de nuevo.
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  Iniciaste sesión con tu cuenta:
                </p>
                <p className="mt-3 break-all rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-emerald-100">
                  {correoUsuario}
                </p>
                <Link
                  href="/perfil"
                  className="mt-6 flex w-full items-center justify-center rounded-2xl border border-emerald-300/25 px-5 py-3.5 text-sm font-medium text-emerald-200 transition hover:bg-emerald-300/10"
                >
                  Ver mi perfil
                </Link>

                <button
                  type="button"
                  onClick={cerrarSesion}
                  disabled={procesando}
                  className={`${boton} mt-8`}
                >
                  {procesando && <Spinner />}
                  {procesando ? "Cerrando sesión…" : "Cerrar sesión"}
                </button>
              </>
            ) : (
              <>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-emerald-300">
                  Tu espacio
                </p>
                <h2
                  id="titulo-acceso"
                  className="mt-3 text-3xl font-semibold tracking-tight"
                >
                  Bienvenido de nuevo.
                </h2>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  Ingresa tus datos para acceder a tu cuenta.
                </p>

                <form onSubmit={iniciarSesion} className="mt-8 space-y-5">
                  <div>
                    <label
                      htmlFor="correo"
                      className="mb-2 block text-sm font-medium text-slate-200"
                    >
                      Correo electrónico
                    </label>
                    <input
                      id="correo"
                      name="email"
                      type="email"
                      autoComplete="username"
                      placeholder="tu@correo.com"
                      required
                      value={correo}
                      onChange={(evento) => setCorreo(evento.target.value)}
                      disabled={procesando}
                      className={campo}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="contrasena"
                      className="mb-2 block text-sm font-medium text-slate-200"
                    >
                      Contraseña
                    </label>
                    <div className="relative">
                      <input
                        id="contrasena"
                        name="password"
                        type={mostrarContrasena ? "text" : "password"}
                        autoComplete="current-password"
                        placeholder="Escribe tu contraseña"
                        required
                        value={contrasena}
                        onChange={(evento) =>
                          setContrasena(evento.target.value)
                        }
                        disabled={procesando}
                        className={`${campo} pr-24`}
                      />
                      <button
                        type="button"
                        aria-controls="contrasena"
                        aria-pressed={mostrarContrasena}
                        aria-label={
                          mostrarContrasena
                            ? "Ocultar contraseña"
                            : "Mostrar contraseña"
                        }
                        onClick={() => setMostrarContrasena((valor) => !valor)}
                        disabled={procesando}
                        className="absolute inset-y-0 right-2 my-2 rounded-lg px-3 text-xs font-medium text-emerald-200 transition hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-emerald-300"
                      >
                        {mostrarContrasena ? "Ocultar" : "Mostrar"}
                      </button>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={procesando}
                    className={`${boton} mt-7`}
                  >
                    {procesando ? (
                      <Spinner />
                    ) : (
                      <svg
                        aria-hidden="true"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
                        <path
                          d="M5 12h14m-6-6 6 6-6 6"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                    {procesando ? "Iniciando sesión…" : "Iniciar sesión"}
                  </button>
                </form>

                <div className="mt-8 border-t border-white/10 pt-5">
                <p className="text-center text-sm text-slate-400">
                  ¿Todavía no tienes cuenta?{" "}
                  <Link
                    href="/registro"
                    className="font-medium text-emerald-300 hover:underline"
                  >
                    Regístrate
                  </Link>
                </p>

                <p className="mt-4 text-center text-xs leading-5 text-slate-500">
                  CONNECTED BY NATURE.
                </p>
              </div>
              </>
            )}

            {mensaje && (
              <p
                role={hayError ? "alert" : "status"}
                className={`mt-5 rounded-xl border p-3 text-sm leading-6 ${
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

        <footer className="flex flex-col gap-2 border-t border-white/5 py-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>EXPLORE. IDENTIFY. PROTECT.</p>
          <p>WHERE NATURE MEETS TECHNOLOGY</p>
        </footer>
      </div>
    </main>
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

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-5 w-5 rounded-full border-2 border-current border-r-transparent motion-safe:animate-spin"
    />
  );
}