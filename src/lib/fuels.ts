// Référentiel harmonisé UE (EN 16942) + extensions. Libellés traduits dans messages/*.json (fuel.<code>).
export const FUELS = [
  { code: "B7", unit: "L", euSymbol: "B7" },
  { code: "B7_PREMIUM", unit: "L", euSymbol: "B7" },
  { code: "B10", unit: "L", euSymbol: "B10" },
  { code: "XTL", unit: "L", euSymbol: "XTL" },
  { code: "E5", unit: "L", euSymbol: "E5" },
  { code: "E5_98", unit: "L", euSymbol: "E5" },
  { code: "E10", unit: "L", euSymbol: "E10" },
  { code: "E85", unit: "L", euSymbol: "E85" },
  { code: "LPG", unit: "L", euSymbol: "LPG" },
  { code: "CNG", unit: "kg", euSymbol: "CNG" },
  { code: "LNG", unit: "kg", euSymbol: "LNG" },
  { code: "H2", unit: "kg", euSymbol: "H2" },
  { code: "ADBLUE", unit: "L", euSymbol: null },
] as const;

export type FuelCode = (typeof FUELS)[number]["code"];
export const FUEL_CODES = FUELS.map((f) => f.code) as FuelCode[];
export const fuelUnit = (code: string) => FUELS.find((f) => f.code === code)?.unit ?? "L";

// Services normalisés (clés de traduction service.<key>).
export const SERVICES = [
  "inflation", "wash", "shop", "toilets", "ev", "food", "atm", "truck", "wifi",
  "repair", "lpg_bottle", "premium_fuel", "camper", "adblue", "card24",
] as const;
