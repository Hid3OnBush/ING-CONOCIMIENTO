This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Cámara e identificación híbrida

La pantalla `/identificar` admite captura en vivo con la cámara trasera y
selección de archivo. El navegador requiere un contexto seguro (HTTPS; `localhost`
también funciona) para `getUserMedia`. El video se muestra en el navegador, se
convierte a JPEG al capturar y sigue validándose con el límite de 5 MB y los
formatos permitidos por la aplicación. Los dos servicios de reconocimiento se
consultan desde el servidor Next.js, no desde el navegador, por lo que no se
necesita CORS para esas llamadas.

El flujo guarda primero la fotografía en el bucket privado y crea la fila de
`identificaciones`. Después `POST /api/identificaciones/{id}/resultado` verifica
la sesión y propiedad de la fila, analiza la imagen y persiste estado, especie,
confianza y predicciones. El orden es:

1. `PUEBLA_MODEL_URL`, si está configurada. Se acepta una clasificación sólo si
   `confidence >= 0.7` y la especie coincide con una especie activa del catálogo.
2. iNaturalist Computer Vision como fallback. La fotografía se envía como el
   campo multipart `image`; por lo tanto, se transmite a iNaturalist cuando se
   activa este fallback. No se envía la clave del modelo al navegador.

Configura estas variables sólo en el entorno del servidor (`.env.local` en
desarrollo, y el gestor de secretos del hosting en producción):

```dotenv
PUEBLA_MODEL_URL=https://tu-servicio-privado.example/api/identify
PUEBLA_MODEL_API_KEY=secreto-del-servicio
INATURALIST_API_TOKEN=token-de-api-de-inaturalist
```

`PUEBLA_MODEL_URL` es opcional: sin ella, la aplicación usa iNaturalist. Cuando
está configurada, Next.js envía el archivo como `multipart/form-data` en el
campo `file` y, si se configuró la clave, agrega `Authorization: Bearer ...`.
El servicio propio debe responder JSON con confianza normalizada entre 0 y 1 y
el ID o nombre científico exacto de una especie del catálogo:

```json
{
  "species_id": 12,
  "scientific_name": "Nombre científico",
  "confidence": 0.93
}
```

El endpoint Computer Vision de iNaturalist también requiere autenticación.
`INATURALIST_API_TOKEN` debe ser un token de API válido de iNaturalist y se
envía sólo desde el servidor en el encabezado `Authorization`. No es la clave
de Supabase ni debe exponerse con el prefijo `NEXT_PUBLIC_`. Si no se dispone
de un token autorizado para ese endpoint, el fallback de iNaturalist no estará
disponible; para plantas se puede integrar un proveedor que entregue una API
key propia, y para fauna se debe elegir un servicio compatible y autorizado.

Para mantener el modelo separado de la aplicación web, se recomienda alojarlo
como un servicio Python/FastAPI independiente, con el artefacto versionado fuera
del código web, un `labels.json` estable, preprocesamiento idéntico al
entrenamiento, validación de tamaño y tipo MIME, y pruebas para cada versión.
ONNX Runtime es una buena opción si se busca portabilidad CPU; PyTorch puede
usarse durante entrenamiento o servirse directamente. El servicio debe
autenticarse y exponerse sólo por HTTPS en producción. `species_id` siempre
debe referirse al catálogo de Supabase; la aplicación no crea fichas a partir
de una predicción no mapeada.

Una estructura inicial para ese servicio separado sería:

```text
ml-service/
  app/
    main.py          # Endpoint FastAPI POST /api/identify
    inference.py     # Carga de modelo, preprocesamiento e inferencia
  models/
    species-v1.onnx  # Artefacto desplegado fuera del repositorio
    labels.json      # Clase del modelo -> ID/especie del catálogo
  tests/
    test_inference.py
  requirements.txt
```

Entrena y evalúa las 20 especies con particiones por imagen/individuo y revisa
precision, recall y matriz de confusión antes de activar el modelo. El umbral
`0.7` es un valor inicial configurable en
`src/lib/identificaciones/reconocimiento.ts`, no una garantía de exactitud
biológica; debe calibrarse con datos de validación representativos de Puebla.

### Formato homogéneo del resultado

La ruta de resultado devuelve `identificacion` y un objeto `resultado` tanto
para el modelo propio como para iNaturalist:

```json
{
  "identificacion": { "id": "uuid", "estado": "COMPLETADA" },
  "resultado": {
    "fuente": "modelo_puebla",
    "umbral_modelo_puebla": 0.7,
    "confianza": 0.93,
    "identificada": true,
    "especie": {
      "id": "12",
      "nombre_comun": "Nombre común",
      "nombre_cientifico": "Nombre científico",
      "tipo": "PLANTA",
      "descripcion": null,
      "habitat": "Hábitat en Puebla",
      "distribucion": null,
      "alimentacion": null,
      "temporada": null,
      "caracteristicas": null,
      "nivel_riesgo": null,
      "estado_conservacion": null,
      "peligrosa": null,
      "toxica": null,
      "venenosa": null,
      "protegida": null,
      "imagen_url": null,
      "taxonomia": {
        "reino": null,
        "filo_division": null,
        "clase": null,
        "orden": null,
        "familia": null,
        "genero": null,
        "especie": null
      }
    },
    "alternativas": [],
    "mensaje": "Identificación realizada por el modelo de Puebla."
  }
}
```

`fuente` es `modelo_puebla` o `inaturalist`; cuando una especie de iNaturalist no
existe en el catálogo, la ruta consulta iNaturalist Taxa y Wikipedia en español
para completar la ficha y su `imagen_url`, además de GBIF para taxonomía,
distribución y estado de conservación. La ficha externa muestra las mismas
secciones del catálogo; cuando las fuentes abiertas no publican un dato se
indica que no se encontró información, sin atribuir valores no verificados.
Los datos que sigan sin estar disponibles conservan `null`. La ficha enriquecida se guarda como inactiva para
revisión; por ello, su `id` sigue siendo `null` hasta que se active en el catálogo.
El resultado de iNaturalist incluye `taxon_id`; la interfaz usa ese dato para
mostrar “Ver detalles de la especie” y abrir una ficha externa con su descripción,
imagen, taxonomía y estado de conservación, aunque todavía no tenga una ficha
activa en Supabase.
`confianza` usa el rango 0–1. Para el modelo propio corresponde a su confianza
normalizada; para iNaturalist se deriva de `combined_score` (o
`vision_score` como alternativa) dividido entre 100. La interfaz muestra este
último como puntaje relativo sobre 100, no como probabilidad de acierto:
iNaturalist advierte que sus puntajes sirven para ordenar sugerencias y no
representan probabilidades calibradas.
Una respuesta sin coincidencias válidas lleva `identificada: false`,
`confianza: null` y `especie: null`. Los errores de ambos servicios no se
convierten en una clasificación falsa: se devuelve error y la identificación
queda reintentable desde la pantalla.
