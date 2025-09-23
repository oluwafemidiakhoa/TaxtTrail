export function toNumber(input: string | number): number {
  if (typeof input === 'number') return Number.isFinite(input) ? input : 0;
  if (!input) return 0;
  const cleaned = input.replace(/[^0-9.-]/g, ''); // drop $, commas, spaces
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}