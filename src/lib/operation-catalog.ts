// Operation catalog: the research-based starting set and the "what's next"
// suggestion. Pure (no DB) so it is testable and shared by seed + UI.
//
// The catalog is a *menu*, not a state machine: the suggestion only
// highlights a likely next step. Nothing here blocks choosing any operation.

export const OPERATION_CATEGORIES = ["initial", "recurring", "conditional", "final"] as const;
export type OperationCategory = (typeof OPERATION_CATEGORIES)[number];

export const OPERATION_CATEGORY_LABELS: Record<OperationCategory, string> = {
  initial: "Inicial",
  recurring: "Recurrente",
  conditional: "Condicional",
  final: "Final",
};

export function isOperationCategory(v: string): v is OperationCategory {
  return (OPERATION_CATEGORIES as readonly string[]).includes(v);
}

export interface DefaultOperationType {
  name: string;
  description: string;
  category: OperationCategory;
  defaultCustomerVisible: boolean;
  color: string;
  systemKey?: "lab" | "bottling";
}

const NEUTRAL = "#5b5142";

// Order = default research-based order. The admin can reorder afterwards.
export const DEFAULT_OPERATION_CATALOG: DefaultOperationType[] = [
  {
    name: "Selección de vino y barrica",
    description:
      "Elegir qué vino va a crianza en barrica y en cuál: madera, origen, tostado, uso previo y volumen, según el perfil del vino.",
    category: "initial",
    defaultCustomerVisible: true,
    color: "#8c6e34",
  },
  {
    name: "Preparación de la barrica",
    description:
      "Revisión previa al llenado: prueba de estanqueidad con agua, enjuague y control de olores. Una barrica nueva no suele requerir sanitización química.",
    category: "initial",
    defaultCustomerVisible: false,
    color: NEUTRAL,
  },
  {
    name: "Llenado",
    description: "Llenado de la barrica con el vino elegido, evitando el contacto con el aire.",
    category: "initial",
    defaultCustomerVisible: true,
    color: "#8c6e34",
  },
  {
    name: "Maloláctica en barrica",
    description:
      "Seguimiento de la fermentación maloláctica cuando se hace en barrica (tapón ventilado mientras haya CO₂). Solo si el vino la hace en madera.",
    category: "conditional",
    defaultCustomerVisible: false,
    color: NEUTRAL,
  },
  {
    name: "Control organoléptico",
    description: "Cata periódica del vino en barrica: aroma, boca, evolución de la madera y defectos.",
    category: "recurring",
    defaultCustomerVisible: true,
    color: "#3e6b4e",
  },
  {
    name: "Análisis de laboratorio",
    description: "Análisis del vino en crianza: pH, SO₂, acidez volátil y otros parámetros.",
    category: "recurring",
    defaultCustomerVisible: false,
    color: NEUTRAL,
    systemKey: "lab",
  },
  {
    name: "Rellenado",
    description:
      "Completar el vacío de la barrica con vino de las mismas características para evitar oxidación y desarrollo microbiano.",
    category: "recurring",
    defaultCustomerVisible: false,
    color: NEUTRAL,
  },
  {
    name: "Revisión de la barrica",
    description: "Inspección de tapón, pérdidas, limpieza exterior y estado general.",
    category: "recurring",
    defaultCustomerVisible: false,
    color: NEUTRAL,
  },
  {
    name: "Sulfitado",
    description: "Ajuste del SO₂ libre según análisis. Los trasiegos y rellenados cambian la necesidad.",
    category: "recurring",
    defaultCustomerVisible: false,
    color: NEUTRAL,
  },
  {
    name: "Batonnage",
    description: "Agitación de las borras finas para aportar volumen y estabilidad. Solo si el estilo del vino lo pide.",
    category: "conditional",
    defaultCustomerVisible: false,
    color: NEUTRAL,
  },
  {
    name: "Trasiego",
    description:
      "Pasar el vino a otro recipiente para separar borras, con o sin aireación. El recipiente receptor se inertiza si es sin aire.",
    category: "conditional",
    defaultCustomerVisible: true,
    color: "#8a6a1e",
  },
  {
    name: "Corrección",
    description: "Intervención puntual sobre el vino (acidez, taninos, color, aromas) decidida por el enólogo.",
    category: "conditional",
    defaultCustomerVisible: false,
    color: NEUTRAL,
  },
  {
    name: "Reparación o reemplazo de barrica",
    description: "Cuando la barrica pierde, huele mal o ya no sirve y hay que repararla o pasar el vino a otra.",
    category: "conditional",
    defaultCustomerVisible: false,
    color: NEUTRAL,
  },
  {
    name: "Decisión de fin de crianza",
    description: "Cata y análisis que definen que el vino ya está listo para salir de la barrica.",
    category: "final",
    defaultCustomerVisible: true,
    color: "#3e6b4e",
  },
  {
    name: "Vaciado de barrica",
    description: "Sacar el vino de la barrica al terminar la crianza y separar las borras.",
    category: "final",
    defaultCustomerVisible: true,
    color: "#8a6a1e",
  },
  {
    name: "Ensamblaje",
    description: "Mezcla de vinos de distintas barricas o lotes antes de embotellar. Solo si el vino se ensambla.",
    category: "final",
    defaultCustomerVisible: false,
    color: NEUTRAL,
  },
  {
    name: "Filtración",
    description: "Filtración previa al embotellado, si el enólogo la decide.",
    category: "final",
    defaultCustomerVisible: false,
    color: NEUTRAL,
  },
  {
    name: "Embotellado",
    description: "Embotellado del vino, con su registro de botellas.",
    category: "final",
    defaultCustomerVisible: true,
    color: "#8b3a2e",
    systemKey: "bottling",
  },
  {
    name: "Limpieza y guarda de barrica vacía",
    description:
      "Enjuague hasta agua clara, secado y guarda con azufre (o solución de mantenimiento) si no se vuelve a llenar enseguida.",
    category: "final",
    defaultCustomerVisible: false,
    color: NEUTRAL,
  },
];

// ---------------------------------------------------------------------------
// Next-operation suggestion
// ---------------------------------------------------------------------------

export interface CatalogEntry {
  id: string;
  category: string;
}

/**
 * Suggest a likely next operation for one barrel.
 *
 * @param catalog       active types, already in catalog order
 * @param doneTypeIds   type ids of the barrel's completed operations, newest first
 *
 * Rules (a hint only — never enforced):
 * - no history → first active type of the catalog
 * - otherwise walk forward from the last operation's position, skipping
 *   conditional types and initial types already done on this barrel
 * - last operation was final, or its type left the catalog → no suggestion
 * - ran off the end of the list → restart at the first recurring type
 */
export function suggestNextOperation(catalog: CatalogEntry[], doneTypeIds: string[]): string | null {
  if (catalog.length === 0) return null;
  if (doneTypeIds.length === 0) return catalog[0].id;

  const lastIdx = catalog.findIndex((t) => t.id === doneTypeIds[0]);
  if (lastIdx === -1) return null;
  if (catalog[lastIdx].category === "final") return null;

  const done = new Set(doneTypeIds);
  const eligible = (t: CatalogEntry) =>
    t.category !== "conditional" && !(t.category === "initial" && done.has(t.id));

  for (let i = lastIdx + 1; i < catalog.length; i++) {
    if (catalog[i].category === "final") break;
    if (eligible(catalog[i])) return catalog[i].id;
  }
  // Past the last recurring step: the cellar loop starts over.
  return catalog.find((t) => t.category === "recurring")?.id ?? null;
}
