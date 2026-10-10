import Link from "next/link";
import { verificarAdministrador } from "@/lib/auth/administrador";
import PanelEspecies from "./panel-especies";

export const dynamic = "force-dynamic";

function Aviso({ mensaje }: { mensaje: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#071411] px-6 text-white">
      <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8">
        <p className="text-xs font-semibold uppercase tracking-widest text-emerald-300">
          NATURA GO · Administración
        </p>

        <h1 className="mt-5 text-2xl font-semibold">
          {mensaje}
        </h1>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="rounded-xl bg-emerald-300 px-5 py-3 font-semibold text-emerald-950"
          >
            Ir a mi cuenta
          </Link>

          <Link
            href="/"
            className="rounded-xl border border-white/15 px-5 py-3"
          >
            Ver catálogo
          </Link>
        </div>
      </section>
    </main>
  );
}

export default async function AdministrarEspeciesPage() {
  const acceso = await verificarAdministrador();

  if (!acceso.autorizado) {
    const estado = acceso.respuesta.status;

    return (
      <Aviso
        mensaje={
          estado === 401
            ? "Inicia sesión para continuar."
            : estado === 403
              ? "Esta sección está reservada para administradores."
              : "No se pudo verificar tu acceso. Intenta nuevamente."
        }
      />
    );
  }

  const { data, count, error } = await acceso.supabase
    .from("especies")
    .select(
      "id, nombre_comun, nombre_cientifico, tipo, descripcion, habitat, activa",
      { count: "exact" }
    )
    .order("nombre_comun", { ascending: true })
    .order("id", { ascending: true })
    .limit(100);

  if (error) {
    console.error("Error al cargar el panel:", error.code);

    return (
      <Aviso mensaje="No se pudo cargar el catálogo administrativo." />
    );
  }

  return (
    <PanelEspecies
      especiesIniciales={data ?? []}
      totalInicial={count ?? 0}
    />
  );
}