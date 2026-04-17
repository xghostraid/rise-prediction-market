/** Deterministic thumbnail gradient from an address (Polymarket-style card art). */
export function pmGradientFromAddr(addr: string): string {
  let h = 2166136261;
  for (let i = 2; i < Math.min(addr.length, 42); i++) {
    h ^= addr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const n = h >>> 0;
  const h1 = n % 320;
  const h2 = (n >> 8) % 320;
  const s = 45 + (n % 25);
  const l1 = 32 + (n % 12);
  const l2 = 22 + ((n >> 4) % 10);
  return `linear-gradient(135deg, hsl(${h1}, ${s}%, ${l1}%) 0%, hsl(${h2}, ${Math.max(s - 8, 30)}%, ${l2}%) 100%)`;
}
