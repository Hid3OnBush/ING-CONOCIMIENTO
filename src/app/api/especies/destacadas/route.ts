import { NextResponse } from "next/server";
import { crearClientePublico } from "@/lib/supabase/publico";

export const dynamic = "force-dynamic";

const LIMITE_ESPECIES = 10;

export async function GET() {
  try {
    const supabase = crearClientePublico();
    const { count, error: errorConteo } = await supabase
      .from("especies")
      .select("id", { count: "exact", head: true })
      .eq("activa", true);

    if (errorConteo) {
      console.error(
        "Error al contar especies destacadas:",
        errorConteo.code
      );

      return NextResponse.json(
        { error: "No se pudieron consultar las especies destacadas." },
        { status: 500 }
      );
    }

    if (!count) {
      return NextResponse.json(
        { especies: [] },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const cantidad = Math.min(count, LIMITE_ESPECIES);
    const inicioMaximo = Math.max(0, count - cantidad);
    const inicio = Math.floor(Math.random() * (inicioMaximo + 1));

    const { data, error } = await supabase
      .from("especies")
      .select(
        `
          id,
          nombre_comun,
          nombre_cientifico,
          tipo,
          imagenes_especies (
            id,
            imagen_url,
            autor,
            licencia,
            licencia_url,
            fuente_url,
            es_principal
          )
        `
      )
      .eq("activa", true)
      .order("id", { ascending: true })
      .range(inicio, inicio + cantidad - 1);

    if (error) {
      console.error(
        "Error al consultar especies destacadas:",
        error.code
      );

      return NextResponse.json(
        { error: "No se pudieron consultar las especies destacadas." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { especies: data ?? [] },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("Error inesperado en GET /api/especies/destacadas:", error);

    return NextResponse.json(
      { error: "Error interno al consultar las especies destacadas." },
      { status: 500 }
    );
  }
}
