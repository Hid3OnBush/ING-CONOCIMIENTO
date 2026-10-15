import type { EspecieHomogenea } from "./enriquecerEspecie";

export const UMBRAL_MODELO_PUEBLA = 0.7;

export type FuenteReconocimiento = "modelo_puebla" | "inaturalist";

export type FichaEspecieReconocida = EspecieHomogenea;

export type AlternativaReconocimiento = {
  confianza: number;
  especie: FichaEspecieReconocida;
};

export type ResultadoReconocimiento = {
  fuente: FuenteReconocimiento;
  umbral_modelo_puebla: number;
  confianza: number | null;
  identificada: boolean;
  especie: FichaEspecieReconocida | null;
  alternativas: AlternativaReconocimiento[];
  mensaje: string;
};

export function esRegistro(
  valor: unknown
): valor is Record<string, unknown> {
  return (
    typeof valor === "object" &&
    valor !== null &&
    !Array.isArray(valor)
  );
}

export function leerConfianza(valor: unknown): number | null {
  return typeof valor === "number" &&
    Number.isFinite(valor) &&
    valor >= 0 &&
    valor <= 1
    ? valor
    : null;
}
