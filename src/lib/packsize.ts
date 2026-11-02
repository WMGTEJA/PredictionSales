/**
 * Estimate how many pieces are in one carton from the item code.
 *
 * Codes end with the pack configuration, e.g.
 *   DRS150GX36      → 36 pcs / carton
 *   CSMS110GX14X2   → 14 × 2 = 28 pcs / carton
 *   CST200G+27GX24  → 24 pcs / carton
 * Returns null when the code has no trailing "X<number>" part (e.g. CSK2SX30G).
 */
export function packSizeFromCode(code: string): number | null {
  const m = /((?:x\d+)+)$/i.exec(code.trim());
  if (!m) return null;
  const factors = m[1]
    .split(/x/i)
    .filter(Boolean)
    .map(Number);
  const size = factors.reduce((p, f) => p * f, 1);
  return size > 1 ? size : null;
}
