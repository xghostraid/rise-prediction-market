/** Deterministic thumbnail gradient — RISE teal / cyan family (on-brand variation). */
export function pmGradientFromAddr(addr: string): string {
  let h = 2166136261;
  for (let i = 2; i < Math.min(addr.length, 42); i++) {
    h ^= addr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const n = h >>> 0;
  /* Hue: ~155–200° (teal → cyan), matches RISE mint accent */
  const h1 = 155 + (n % 45);
  const h2 = 165 + ((n >> 6) % 40);
  const s = 42 + (n % 20);
  const l1 = 28 + (n % 14);
  const l2 = 18 + ((n >> 4) % 12);
  return `linear-gradient(135deg, hsl(${h1}, ${s}%, ${l1}%) 0%, hsl(${h2}, ${Math.max(s - 6, 35)}%, ${l2}%) 100%)`;
}
