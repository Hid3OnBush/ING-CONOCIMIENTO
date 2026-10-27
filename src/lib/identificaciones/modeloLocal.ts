import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as tf from "@tensorflow/tfjs";
import sharp from "sharp";

const ETIQUETAS_MODELO = {
  "Cempasúchil": ["Cempasúchil", "Cempasuchil"],
  "Pino montezuma": ["Pino montezuma", "Pino de Montezuma"],
  "Bugambilia": ["Bugambilia"],
  "Ajolote": ["Ajolote", "Axolote"],
} as const;

export type EtiquetaModeloLocal = keyof typeof ETIQUETAS_MODELO;

export type PrediccionModeloLocal = {
  etiqueta: EtiquetaModeloLocal;
  confianza: number;
  margen: number;
};

type MetadataModelo = {
  labels: string[];
  imageSize: number;
};

type DocumentoModelo = {
  modelTopology: tf.io.ModelArtifacts["modelTopology"];
  weightsManifest: {
    paths: string[];
    weights: tf.io.WeightsManifestEntry[];
  }[];
};

type ModeloLocalCargado = {
  modelo: tf.LayersModel;
  etiquetas: EtiquetaModeloLocal[];
  imageSize: number;
};

type GlobalConModeloLocal = typeof globalThis & {
  __modeloLocalIdentificaciones?: Promise<ModeloLocalCargado>;
};

const globalConModeloLocal = globalThis as GlobalConModeloLocal;

export function esEtiquetaModeloLocal(
  valor: string
): valor is EtiquetaModeloLocal {
  return Object.hasOwn(ETIQUETAS_MODELO, valor);
}

export function aliasCatalogoModeloLocal(
  etiqueta: EtiquetaModeloLocal
): readonly string[] {
  return ETIQUETAS_MODELO[etiqueta];
}

async function cargarModelo(): Promise<ModeloLocalCargado> {
  const directorio = join(
    process.cwd(),
    "public",
    "modelos",
    "tm-my-image-model"
  );
  const [metadataContenido, modeloContenido] = await Promise.all([
    readFile(join(directorio, "metadata.json"), "utf8"),
    readFile(join(directorio, "model.json"), "utf8"),
  ]);
  const metadata = JSON.parse(metadataContenido) as MetadataModelo;
  const documento = JSON.parse(modeloContenido) as DocumentoModelo;
  const etiquetas = Array.isArray(metadata.labels)
    ? metadata.labels.filter(
        (etiqueta): etiqueta is EtiquetaModeloLocal =>
          typeof etiqueta === "string" && esEtiquetaModeloLocal(etiqueta)
      )
    : [];

  if (
    !Array.isArray(metadata.labels) ||
    metadata.labels.length !== Object.keys(ETIQUETAS_MODELO).length ||
    etiquetas.length !== metadata.labels.length ||
    !Number.isSafeInteger(metadata.imageSize) ||
    metadata.imageSize <= 0 ||
    !documento.weightsManifest.length
  ) {
    throw new Error("Los metadatos del modelo local no son válidos.");
  }

  await tf.setBackend("cpu");
  await tf.ready();

  const gruposPesos = await Promise.all(
    documento.weightsManifest.map(async (grupo) => {
      const archivos = await Promise.all(
        grupo.paths.map(async (archivo) => {
          if (archivo !== "weights.bin") {
            throw new Error("El modelo local referencia un peso no permitido.");
          }

          return readFile(join(directorio, archivo));
        })
      );

      return {
        especificaciones: grupo.weights,
        contenido: Buffer.concat(archivos),
      };
    })
  );
  const especificaciones = gruposPesos.flatMap(
    (grupo) => grupo.especificaciones
  );
  const pesoTotal = Buffer.concat(
    gruposPesos.map((grupo) => grupo.contenido)
  );
  const datosPesos = new ArrayBuffer(pesoTotal.byteLength);
  new Uint8Array(datosPesos).set(pesoTotal);
  const modelo = await tf.loadLayersModel(
    tf.io.fromMemory({
      modelTopology: documento.modelTopology,
      weightSpecs: especificaciones,
      weightData: datosPesos,
    })
  );

  return {
    modelo,
    etiquetas,
    imageSize: metadata.imageSize,
  };
}

async function obtenerModelo(): Promise<ModeloLocalCargado> {
  const pendiente =
    globalConModeloLocal.__modeloLocalIdentificaciones ??
    (globalConModeloLocal.__modeloLocalIdentificaciones = cargarModelo());

  try {
    return await pendiente;
  } catch (error) {
    if (globalConModeloLocal.__modeloLocalIdentificaciones === pendiente) {
      delete globalConModeloLocal.__modeloLocalIdentificaciones;
    }

    throw error;
  }
}

export async function predecirModeloLocal(
  bytes: ArrayBuffer
): Promise<PrediccionModeloLocal> {
  const modelo = await obtenerModelo();
  const imagen = await sharp(Buffer.from(bytes), {
    limitInputPixels: 40_000_000,
  })
    .rotate()
    .toColourspace("srgb")
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  if (imagen.info.channels !== 3) {
    throw new Error("La fotografía no pudo convertirse a RGB.");
  }

  const entrada = tf.tidy(() => {
    const pixeles = tf.tensor3d(
      imagen.data,
      [imagen.info.height, imagen.info.width, imagen.info.channels],
      "float32"
    );
    const redimensionada = tf.image.resizeBilinear(
      pixeles,
      [modelo.imageSize, modelo.imageSize],
      true
    );
    return redimensionada.div(127.5).sub(1).expandDims(0);
  });

  let salida: tf.Tensor;
  try {
    const prediccion = modelo.modelo.predict(entrada);
    if (Array.isArray(prediccion)) {
      salida = prediccion[0];
      if (!salida) {
        throw new Error("El modelo local no devolvió predicciones.");
      }
      for (const tensor of prediccion.slice(1)) {
        tensor.dispose();
      }
    } else {
      salida = prediccion;
    }
  } finally {
    entrada.dispose();
  }

  try {
    const puntajes = Array.from(await salida.data());
    if (
      puntajes.length !== modelo.etiquetas.length ||
      puntajes.some(
        (puntaje) =>
          !Number.isFinite(puntaje) || puntaje < 0 || puntaje > 1
      )
    ) {
      throw new Error("El modelo local devolvió puntajes inválidos.");
    }

    const ordenados = modelo.etiquetas
      .map((etiqueta, indice) => ({
        etiqueta,
        confianza: puntajes[indice],
      }))
      .sort((a, b) => b.confianza - a.confianza);
    const principal = ordenados[0];
    const segunda = ordenados[1];

    if (!principal || !segunda) {
      throw new Error("El modelo local no devolvió suficientes clases.");
    }

    return {
      etiqueta: principal.etiqueta,
      confianza: principal.confianza,
      margen: principal.confianza - segunda.confianza,
    };
  } finally {
    salida.dispose();
  }
}
