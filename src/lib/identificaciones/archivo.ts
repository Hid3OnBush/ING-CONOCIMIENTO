export const BUCKET_IDENTIFICACIONES = "identificaciones-usuarios";
export const MAXIMO_BYTES = 5 * 1024 * 1024;

export type ExtensionImagen = "jpg" | "png" | "webp";

type FormatoImagen = {
  extension: ExtensionImagen;
  mime: "image/jpeg" | "image/png" | "image/webp";
};

function detectarFormato(bytes: Uint8Array): FormatoImagen | null {
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return { extension: "jpg", mime: "image/jpeg" };
  }

  const firmaPNG = [137, 80, 78, 71, 13, 10, 26, 10];

  if (
    bytes.length >= firmaPNG.length &&
    firmaPNG.every((valor, posicion) => bytes[posicion] === valor)
  ) {
    return { extension: "png", mime: "image/png" };
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 82 &&
    bytes[1] === 73 &&
    bytes[2] === 70 &&
    bytes[3] === 70 &&
    bytes[8] === 87 &&
    bytes[9] === 69 &&
    bytes[10] === 66 &&
    bytes[11] === 80
  ) {
    return { extension: "webp", mime: "image/webp" };
  }

  return null;
}

export async function validarArchivoImagen(
  archivo: Blob
): Promise<FormatoImagen> {
  if (archivo.size === 0) {
    throw new Error("El archivo está vacío.");
  }

  if (archivo.size > MAXIMO_BYTES) {
    throw new Error("La fotografía debe pesar como máximo 5 MB.");
  }

  const cabecera = new Uint8Array(
    await archivo.slice(0, 12).arrayBuffer()
  );

  const formato = detectarFormato(cabecera);

  if (!formato) {
    throw new Error("Selecciona una fotografía JPEG, PNG o WebP.");
  }

  return formato;
}