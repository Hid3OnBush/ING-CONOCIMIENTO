import { NextResponse } from "next/server";
import { crearClientePublico } from "@/lib/supabase/publico";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const buscar = (searchParams.get("buscar") ?? "")
      .normalize("NFC")
      .trim()
      .replace(/\s+/g, " ");

    const tipo = (searchParams.get("tipo") ?? "")
      .trim()
      .toUpperCase();

    if (tipo && tipo !== "PLANTA" && tipo !== "ANIMAL") {
      return NextResponse.json(
        { error: "El tipo debe ser PLANTA o ANIMAL." },
        { status: 400 },
      );
    }

    // Validar el texto antes de incorporarlo al filtro.
    if (
      buscar.length > 100 ||
      (buscar && !/^[\p{L}\p{N} -]+$/u.test(buscar))
    ) {
      return NextResponse.json(
        {
          error:
            "La búsqueda admite hasta 100 caracteres: letras, números, espacios y guiones.",
        },
        { status: 400 },
      );
    }

    const supabase = crearClientePublico();

    let consulta = supabase
      .from("especies")
      .select(
        `
          id,
          nombre_comun,
          nombre_cientifico,
          tipo,
          descripcion,
          habitat,
          imagenes_especies (
            id,
            imagen_url,
            autor,
            licencia,
            licencia_url,
            fuente_url,
            es_principal
          )
        `,
        { count: "exact" },
      )
      .eq("activa", true);

    if (tipo) {
      consulta = consulta.eq("tipo", tipo);
    }

    if (buscar) {
      consulta = consulta.or(
        `nombre_comun.ilike.%${buscar}%,nombre_cientifico.ilike.%${buscar}%`,
      );
    }

    const { data, error, count } = await consulta
      .order("nombre_comun", { ascending: true })
      .order("id", { ascending: true })
      .limit(100);

    if (error) {
      console.error("Error al consultar especies:", error);

      return NextResponse.json(
        { error: "No se pudieron consultar las especies." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        total: count ?? 0,
        mostradas: data.length,
        especies: data,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Error en GET /api/especies:", error);

    return NextResponse.json(
      { error: "Error interno al consultar las especies." },
      { status: 500 },
    );
  }
}