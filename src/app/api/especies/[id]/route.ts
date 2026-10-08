import { NextResponse } from "next/server";
import { crearClientePublico } from "@/lib/supabase/publico";

export const dynamic = "force-dynamic";

type Contexto = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _request: Request,
  { params }: Contexto,
) {
  try {
    const { id } = await params;

    // Aceptar solamente enteros positivos dentro del rango BIGINT.
    if (
      !/^[1-9]\d{0,18}$/.test(id) ||
      BigInt(id) > BigInt("9223372036854775807")
    ) {
      return NextResponse.json(
        { error: "El ID debe ser un entero positivo válido." },
        { status: 400 },
      );
    }

    const supabase = crearClientePublico();

    const { data, error } = await supabase
      .from("especies")
      .select(`
        id,
        nombre_comun,
        nombre_cientifico,
        tipo,
        descripcion,
        habitat,
        alimentacion,
        temporada,
        distribucion,
        caracteristicas,
        reino,
        filo_division,
        clase,
        orden_taxonomico,
        familia,
        genero,
        especie_taxonomica,
        peligrosa,
        toxica,
        venenosa,
        protegida,
        nivel_riesgo,
        estado_conservacion,
        fuente_principal,
        fuente_url,
        imagenes_especies (
          id,
          imagen_url,
          miniatura_url,
          fuente,
          fuente_url,
          autor,
          licencia,
          licencia_url,
          es_principal
        )
      `)
      .eq("id", id)
      .eq("activa", true)
      .maybeSingle();

    if (error) {
      console.error("Error al consultar la especie:", error);

      return NextResponse.json(
        { error: "No se pudo consultar la especie." },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Especie no encontrada." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { especie: data },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Error en GET /api/especies/[id]:", error);

    return NextResponse.json(
      { error: "Error interno al consultar la especie." },
      { status: 500 },
    );
  }
}