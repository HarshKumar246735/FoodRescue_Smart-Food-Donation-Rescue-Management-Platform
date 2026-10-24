const KG = { kg: 1, g: 0.001, lb: 0.45359237 };
export const UNITS = ['kg', 'g', 'lb', 'portions', 'items', 'litres', 'trays', 'boxes'];
/** Weight in kg when the unit is a mass unit, otherwise null (never guessed). */
export const toKg = (unit, qty) => (KG[unit] ? +(KG[unit] * qty).toFixed(3) : null);
