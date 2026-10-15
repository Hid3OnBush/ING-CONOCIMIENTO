"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";

type Tipo = "PLANTA" | "ANIMAL";

type Especie = {
  id: number;
  nombre_comun: string;
  nombre_cientifico: string;
  tipo: Tipo;
  descripcion: string | null;
  habitat: string | null;
  activa: boolean;
};

type Formulario = {
  nombre_comun: string;
  nombre_cientifico: string;
  tipo: Tipo;
  descripcion: string;
  habitat: string;
};

type Props = {
  especiesIniciales: Especie[];
  totalInicial: number;
};

const formularioVacio: Formulario = {
  nombre_comun: "",
  nombre_cientifico: "",
  tipo: "PLANTA",
  descripcion: "",
  habitat: "",
};

const estiloCampo =
  "mt-2 w-full rounded-xl border border-white/15 bg-black/20 px-4 py-3 text-sm text-white outline-none transition focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/20 disabled:opacity-50";

const estiloBoton =
  "rounded-xl border border-white/15 px-4 py-2 text-sm font-medium transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 disabled:cursor-not-allowed disabled:opacity-40";

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

async function consultarCatalogo() {
  const respuesta = await fetch("/api/admin/especies", {
    cache: "no-store",
  });

  const datos = await respuesta.json();

  if (!respuesta.ok) {
    throw new Error(
      typeof datos.error === "string"
        ? datos.error
        : "No se pudo consultar el catálogo."
    );
  }

  if (
    !Array.isArray(datos.especies) ||
    typeof datos.total !== "number"
  ) {
    throw new Error("El servidor devolvió una respuesta inesperada.");
  }

  return {
    especies: datos.especies as Especie[],
    total: datos.total as number,
  };
}

async function enviar(
  url: string,
  metodo: "POST" | "PATCH",
  contenido: object
) {
  const respuesta = await fetch(url, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify(contenido),
  });

  const datos = await respuesta.json();

  if (!respuesta.ok) {
    throw new Error(
      typeof datos.error === "string"
        ? datos.error
        : "No se pudo guardar el cambio."
    );
  }

  if (!datos.especie) {
    throw new Error("No se pudo confirmar el resultado de la operación.");
  }
}

export default function PanelEspecies({
  especiesIniciales,
  totalInicial,
}: Props) {
  const [especies, setEspecies] = useState(especiesIniciales);
  const [total, setTotal] = useState(totalInicial);
  const [formulario, setFormulario] = useState(formularioVacio);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("TODAS");
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const nombreRef = useRef<HTMLInputElement>(null);
  const bloqueo = useRef(false);

  const activas = especies.filter((especie) => especie.activa).length;
  const inactivas = especies.length - activas;
  const termino = normalizar(busqueda);

  const filtradas = especies.filter((especie) => {
    const coincideNombre =
      normalizar(especie.nombre_comun).includes(termino) ||
      normalizar(especie.nombre_cientifico).includes(termino);

    const coincideEstado =
      estado === "TODAS" ||
      (estado === "ACTIVAS" && especie.activa) ||
      (estado === "INACTIVAS" && !especie.activa);

    return coincideNombre && coincideEstado;
  });

  function cambiar<K extends keyof Formulario>(
    campo: K,
    valor: Formulario[K]
  ) {
    setFormulario((actual) => ({ ...actual, [campo]: valor }));
  }

  function limpiarFormulario() {
    setEditandoId(null);
    setFormulario({ ...formularioVacio });
  }

  function editar(especie: Especie) {
    setEditandoId(especie.id);
    setFormulario({
      nombre_comun: especie.nombre_comun,
      nombre_cientifico: especie.nombre_cientifico,
      tipo: especie.tipo,
      descripcion: especie.descripcion ?? "",
      habitat: especie.habitat ?? "",
    });
    setError("");
    setMensaje("");
    nombreRef.current?.focus();
  }

  async function cargarListado() {
    const datos = await consultarCatalogo();
    setEspecies(datos.especies);
    setTotal(datos.total);
  }

  async function recargar() {
    if (bloqueo.current) return;

    bloqueo.current = true;
    setProcesando(true);
    setError("");
    setMensaje("");

    try {
      await cargarListado();
    } catch (problema) {
      setError(
        problema instanceof Error
          ? problema.message
          : "No se pudo actualizar el listado."
      );
    } finally {
      bloqueo.current = false;
      setProcesando(false);
    }
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    if (bloqueo.current) return;

    bloqueo.current = true;
    setProcesando(true);
    setError("");
    setMensaje("");

    const esEdicion = editandoId !== null;
    let guardado = false;

    try {
      await enviar(
        esEdicion
          ? `/api/admin/especies/${editandoId}`
          : "/api/admin/especies",
        esEdicion ? "PATCH" : "POST",
        {
          nombre_comun: formulario.nombre_comun.trim(),
          nombre_cientifico: formulario.nombre_cientifico.trim(),
          tipo: formulario.tipo,
          descripcion: formulario.descripcion.trim() || null,
          habitat: formulario.habitat.trim() || null,
        }
      );

      guardado = true;
      limpiarFormulario();
      setMensaje(
        esEdicion
          ? "Los cambios se guardaron correctamente."
          : "Especie creada como inactiva. Puedes activarla cuando su ficha esté lista."
      );

      await cargarListado();
    } catch (problema) {
      setError(
        guardado
          ? "El cambio se guardó, pero no se pudo actualizar el listado. Pulsa Actualizar."
          : problema instanceof Error
            ? problema.message
            : "No se pudo confirmar el guardado. Actualiza el listado antes de volver a intentarlo."
      );
    } finally {
      bloqueo.current = false;
      setProcesando(false);
    }
  }

  async function cambiarEstado(especie: Especie) {
    if (bloqueo.current) return;

    bloqueo.current = true;
    setProcesando(true);
    setError("");
    setMensaje("");

    let guardado = false;

    try {
      await enviar(
        `/api/admin/especies/${especie.id}`,
        "PATCH",
        { activa: !especie.activa }
      );

      guardado = true;
      setMensaje(
        especie.activa
          ? `${especie.nombre_comun} se desactivó y dejó de aparecer en el catálogo público.`
          : `${especie.nombre_comun} se activó y ahora aparece en el catálogo público.`
      );

      await cargarListado();
    } catch (problema) {
      setError(
        guardado
          ? "El estado se guardó, pero no se pudo actualizar el listado. Pulsa Actualizar."
          : problema instanceof Error
            ? problema.message
            : "No se pudo confirmar el cambio. Actualiza el listado."
      );
    } finally {
      bloqueo.current = false;
      setProcesando(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#071411] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(16,185,129,0.10),transparent_55%)]" />

      <div className="relative mx-auto max-w-7xl px-5 py-6 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <Link
            href="/"
            className="rounded-lg focus-visible:outline-2 focus-visible:outline-emerald-300"
          >
            <span className="block text-lg font-bold tracking-tight">
              NATURA GO
            </span>
            <span className="text-xs uppercase tracking-widest text-emerald-300">
              Administración
            </span>
          </Link>

          <nav aria-label="Navegación administrativa" className="flex gap-3">
            <Link href="/" className={estiloBoton}>
              Ver catálogo
            </Link>
            <Link href="/login" className={estiloBoton}>
              Mi cuenta
            </Link>
          </nav>
        </header>

        <section className="py-9">
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">
            Gestión del catálogo
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Administrar especies
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
            Edita la información básica y decide qué fichas aparecen
            en el catálogo público.
          </p>

          <div className="mt-7 grid grid-cols-3 gap-3">
            {[
              ["Registradas", total],
              ["Activas cargadas", activas],
              ["Inactivas cargadas", inactivas],
            ].map(([titulo, cantidad]) => (
              <div
                key={titulo}
                className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5"
              >
                <p className="text-2xl font-semibold sm:text-3xl">
                  {cantidad}
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  {titulo}
                </p>
              </div>
            ))}
          </div>
        </section>

        {mensaje && (
          <p
            role="status"
            className="mb-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 px-5 py-4 text-sm text-emerald-100"
          >
            {mensaje}
          </p>
        )}

        {error && (
          <p
            role="alert"
            className="mb-5 rounded-2xl border border-red-300/20 bg-red-300/10 px-5 py-4 text-sm text-red-100"
          >
            {error}
          </p>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[360px_1fr]">
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold">
              {editandoId !== null ? "Editar especie" : "Nueva especie"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              {editandoId !== null
                ? `Estás editando la especie con ID ${editandoId}.`
                : "Las nuevas fichas se crean inactivas."}
            </p>

            <form onSubmit={guardar} className="mt-6 space-y-5">
              <fieldset disabled={procesando} className="space-y-5">
                <div>
                  <label htmlFor="nombre-comun" className="text-sm font-medium">
                    Nombre común
                  </label>
                  <input
                    ref={nombreRef}
                    id="nombre-comun"
                    required
                    minLength={2}
                    maxLength={100}
                    value={formulario.nombre_comun}
                    onChange={(evento) =>
                      cambiar("nombre_comun", evento.target.value)
                    }
                    className={estiloCampo}
                  />
                </div>

                <div>
                  <label htmlFor="nombre-cientifico" className="text-sm font-medium">
                    Nombre científico
                  </label>
                  <input
                    id="nombre-cientifico"
                    required
                    minLength={2}
                    maxLength={100}
                    value={formulario.nombre_cientifico}
                    onChange={(evento) =>
                      cambiar("nombre_cientifico", evento.target.value)
                    }
                    className={estiloCampo}
                  />
                </div>

                <div>
                  <label htmlFor="tipo" className="text-sm font-medium">
                    Tipo
                  </label>
                  <select
                    id="tipo"
                    value={formulario.tipo}
                    onChange={(evento) =>
                      cambiar("tipo", evento.target.value as Tipo)
                    }
                    className={`${estiloCampo} scheme-dark`}
                  >
                    <option value="PLANTA">Planta</option>
                    <option value="ANIMAL">Animal</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="descripcion" className="text-sm font-medium">
                    Descripción
                  </label>
                  <textarea
                    id="descripcion"
                    rows={5}
                    maxLength={5000}
                    value={formulario.descripcion}
                    onChange={(evento) =>
                      cambiar("descripcion", evento.target.value)
                    }
                    className={`${estiloCampo} resize-y`}
                  />
                </div>

                <div>
                  <label htmlFor="habitat" className="text-sm font-medium">
                    Hábitat
                  </label>
                  <textarea
                    id="habitat"
                    rows={4}
                    maxLength={5000}
                    value={formulario.habitat}
                    onChange={(evento) =>
                      cambiar("habitat", evento.target.value)
                    }
                    className={`${estiloCampo} resize-y`}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-emerald-300 px-5 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {procesando
                    ? "Procesando…"
                    : editandoId !== null
                      ? "Guardar cambios"
                      : "Crear especie"}
                </button>

                {editandoId !== null && (
                  <button
                    type="button"
                    onClick={limpiarFormulario}
                    className={`${estiloBoton} w-full`}
                  >
                    Cancelar edición
                  </button>
                )}
              </fieldset>
            </form>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xl font-semibold">Especies</h2>
              <button
                type="button"
                onClick={recargar}
                disabled={procesando}
                className={estiloBoton}
              >
                Actualizar
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_160px]">
              <div>
                <label htmlFor="buscar" className="text-xs text-slate-400">
                  Buscar por nombre
                </label>
                <input
                  id="buscar"
                  type="search"
                  placeholder="Ejemplo: nopal"
                  value={busqueda}
                  onChange={(evento) => setBusqueda(evento.target.value)}
                  className={estiloCampo}
                />
              </div>

              <div>
                <label htmlFor="estado" className="text-xs text-slate-400">
                  Estado
                </label>
                <select
                  id="estado"
                  value={estado}
                  onChange={(evento) => setEstado(evento.target.value)}
                  className={`${estiloCampo} scheme-dark`}
                >
                  <option value="TODAS">Todas</option>
                  <option value="ACTIVAS">Activas</option>
                  <option value="INACTIVAS">Inactivas</option>
                </select>
              </div>
            </div>

            <p className="my-5 text-xs text-slate-400" aria-live="polite">
              {procesando
                ? "Procesando operación…"
                : `${filtradas.length} resultados · ${especies.length} de ${total} especies cargadas`}
            </p>

            {filtradas.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 px-6 py-12 text-center text-sm text-slate-400">
                No hay especies que coincidan con estos filtros.
              </div>
            ) : (
              <ul className="space-y-3" aria-busy={procesando}>
                {filtradas.map((especie) => (
                  <li
                    key={especie.id}
                    className="rounded-2xl border border-white/10 bg-black/15 p-5"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs text-slate-500">
                          ID {especie.id} ·{" "}
                          {especie.tipo === "PLANTA" ? "Planta" : "Animal"}
                        </p>
                        <h3 className="mt-2 text-lg font-semibold">
                          {especie.nombre_comun}
                        </h3>
                        <p className="mt-1 text-sm italic text-slate-400">
                          {especie.nombre_cientifico}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${
                          especie.activa
                            ? "bg-emerald-300/10 text-emerald-200"
                            : "bg-amber-300/10 text-amber-200"
                        }`}
                      >
                        {especie.activa ? "Activa" : "Inactiva"}
                      </span>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={procesando}
                        onClick={() => editar(especie)}
                        className={estiloBoton}
                      >
                        Editar
                      </button>

                      <button
                        type="button"
                        disabled={procesando}
                        onClick={() => cambiarEstado(especie)}
                        className={estiloBoton}
                      >
                        {especie.activa ? "Desactivar" : "Activar"}
                      </button>

                      {especie.activa && (
                        <Link
                          href={`/especies/${especie.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          prefetch={false}
                          className={estiloBoton}
                          aria-label={`Ver ficha de ${especie.nombre_comun} en otra pestaña`}
                        >
                          Ver ficha ↗
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <footer className="mt-10 border-t border-white/10 py-6 text-xs text-slate-500">
          NATURA GO · Flora y fauna de Puebla
        </footer>
      </div>
    </main>
  );
}