import Link from "next/link";

export default function ErrorConfirmacionPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#071411] px-6 text-slate-100">
      <section className="w-full max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8">
        <p className="text-xs font-medium uppercase tracking-widest text-emerald-300">
          NATURA GO · Tu cuenta
        </p>

        <h1 className="mt-4 text-2xl font-semibold">
          No se pudo completar la sesión.
        </h1>

        <p className="mt-4 text-sm leading-7 text-slate-400">
          El enlace puede haber caducado, haberse utilizado o haberse abierto
          en otro navegador. Si tu correo ya quedó confirmado, puedes iniciar
          sesión con tu correo y contraseña.
        </p>

        <Link
          href="/login"
          className="mt-7 block rounded-xl bg-emerald-300 px-5 py-3 text-center text-sm font-semibold text-emerald-950 transition hover:bg-emerald-200"
        >
          Ir a iniciar sesión
        </Link>

        <Link
          href="/"
          className="mt-4 block py-2 text-center text-sm text-emerald-200"
        >
          Ver catálogo
        </Link>
      </section>
    </main>
  );
}