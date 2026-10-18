import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function texto(valor: unknown): string | null {
  return typeof valor === "string" && valor.trim()
    ? valor.trim()
    : null;
}

function esRegistro(valor: unknown): valor is Record<string, unknown> {
  return (
    typeof valor === "object" &&
    valor !== null &&
    !Array.isArray(valor)
  );
}

export async function GET(request: Request) {
  const consulta = new URL(request.url).searchParams.get("buscar")
    ?.normalize("NFC")
    .trim()
    .replace(/\s+/g, " ");

  if (
    !consulta ||
    consulta.length < 2 ||
    consulta.length > 100 ||
    !/^[\p{L}\p{M}\p{N} .'-]+$/u.test(consulta)
  ) {
    return NextResponse.json(
      { error: "Escribe al menos dos letras para buscar una especie." },
      { status: 400 }
    );
  }

  const url = new URL("https://api.inaturalist.org/v1/taxa");
  url.searchParams.set("q", consulta);
  url.searchParams.set("locale", "es");
  url.searchParams.set("per_page", "6");
  url.searchParams.set("is_active", "true");

  try {
    const respuesta = await fetch(url, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!respuesta.ok) {
      await respuesta.body?.cancel();
      console.error(
        "La búsqueda de especies respondió con HTTP",
        respuesta.status
      );
      return NextResponse.json(
        { error: "No se pudo consultar la búsqueda de especies." },
        { status: 502 }
      );
    }

    const datos: unknown = await respuesta.json();
    const resultados =
      esRegistro(datos) && Array.isArray(datos.results)
        ? datos.results
        : [];

    const especies = resultados
      .filter(
        (
          resultado
        ): resultado is Record<string, unknown> & {
          id: number;
          name: string;
        } =>
          esRegistro(resultado) &&
          typeof resultado.id === "number" &&
          Number.isSafeInteger(resultado.id) &&
          typeof resultado.name === "string" &&
          ["species", "subspecies", "variety", "form"].includes(
            String(resultado.rank).toLowerCase()
          )
      )
      .map((taxon) => {
        const foto = esRegistro(taxon.default_photo)
          ? taxon.default_photo
          : null;

        return {
          taxon_id: taxon.id,
          nombre_cientifico: taxon.name,
          nombre_comun: texto(taxon.preferred_common_name) ?? taxon.name,
          tipo: texto(taxon.iconic_taxon_name),
          imagen_url:
            texto(foto?.medium_url) ?? texto(foto?.url),
        };
      });

    return NextResponse.json(
      { especies },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error(
      "No se pudo completar la búsqueda de especies:",
      error instanceof Error ? error.message : "Error desconocido"
    );

    return NextResponse.json(
      { error: "La búsqueda de especies no está disponible por el momento." },
      { status: 502 }
    );
  }
}
