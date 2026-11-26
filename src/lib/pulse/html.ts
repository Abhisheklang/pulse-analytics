// Shared HTML escaping for Pulse server-side message building.
// FIN-3: this helper previously existed as two identical copies in
// deliver.ts and smtp.ts.
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Shared CSV field escaping (RFC 4180 quoting). FIN-3: engine.ts built
// CSV by JSON.stringify quoting while exporter.ts used proper CSV
// quoting, so the same data was escaped two different ways.
export function csvEscape(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}
