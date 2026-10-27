import { NextResponse } from "next/server";
import { crearClientePublico } from "@/lib/supabase/publico";
import { obtenerDetallesEspeciePorNombre } from "@/lib/identificaciones/enriquecerEspecie";

export const dynamic = "force-dynamic";

type Contexto = {
  params: Promise<{ id: string }>;
};

function textoDisponible(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim() ? valor : null;
}

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

    const camposComplementables = [
      data.descripcion,
      data.habitat,
      data.alimentacion,
      data.temporada,
      data.distribucion,
      data.caracteristicas,
      data.estado_conservacion,
      data.reino,
      data.filo_division,
      data.clase,
      data.orden_taxonomico,
      data.familia,
      data.genero,
      data.especie_taxonomica,
    ];
    const necesitaComplemento = camposComplementables.some(
      (valor) => typeof valor !== "string" || !valor.trim()
    );
    let especie = data;

    if (necesitaComplemento) {
      try {
        const externa = await obtenerDetallesEspeciePorNombre(
          data.nombre_cientifico
        );

        if (externa) {
          especie = {
            ...data,
            descripcion:
              textoDisponible(data.descripcion) ?? externa.descripcion,
            habitat: textoDisponible(data.habitat) ?? externa.habitat,
            alimentacion:
              textoDisponible(data.alimentacion) ?? externa.alimentacion,
            temporada:
              textoDisponible(data.temporada) ?? externa.temporada,
            distribucion:
              textoDisponible(data.distribucion) ?? externa.distribucion,
            caracteristicas:
              textoDisponible(data.caracteristicas) ??
              externa.caracteristicas,
            estado_conservacion:
              textoDisponible(data.estado_conservacion) ??
              externa.estado_conservacion,
            nivel_riesgo:
              textoDisponible(data.nivel_riesgo) ?? externa.nivel_riesgo,
            reino:
              textoDisponible(data.reino) ?? externa.taxonomia.reino,
            filo_division:
              textoDisponible(data.filo_division) ??
              externa.taxonomia.filo_division,
            clase: textoDisponible(data.clase) ?? externa.taxonomia.clase,
            orden_taxonomico:
              textoDisponible(data.orden_taxonomico) ??
              externa.taxonomia.orden,
            familia:
              textoDisponible(data.familia) ?? externa.taxonomia.familia,
            genero:
              textoDisponible(data.genero) ?? externa.taxonomia.genero,
            especie_taxonomica:
              textoDisponible(data.especie_taxonomica) ??
              externa.taxonomia.especie,
          };
        }
      } catch (errorComplemento) {
        console.warn(
          "No se pudo complementar la ficha con fuentes externas:",
          errorComplemento instanceof Error
            ? errorComplemento.message
            : "Error desconocido"
        );
      }
    }

    return NextResponse.json(
      { especie },
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