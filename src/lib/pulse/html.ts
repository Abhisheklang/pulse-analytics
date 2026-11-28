// Shared HTML escaping for Pulse server-side message building.
// FIN-3: this helper previously existed as two identical copies in
// deliver.ts and smtp.ts.
export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Shared CSV field escaping (RFC 4180 quoting). FIN-3: engine.ts built
// CSV by JSON.stringify quoting while exporter.ts used proper CSV
// quoting, so the same data was escaped two different ways.
//
// A string starting with =, +, - or @ (after any leading whitespace) is
// treated as a formula when the file is opened in a spreadsheet app.
// Tracked values such as page titles, referrers and event names are
// visitor-controlled, so a leading single quote is added to keep the
// cell text literal.
const FORMULA_START = /^\s*[=+\-@]/;

export function csvEscape(value: unknown): string {
  let text = String(value ?? '');

  if (typeof value === 'string' && FORMULA_START.test(text)) {
    text = `'${text}`;
  }

  return `"${text.replace(/"/g, '""')}"`;
}
