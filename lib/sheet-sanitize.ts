/**
 * Spreadsheet formula-injection defense (H-09).
 *
 * Teacher-uploaded CSV/XLSX values are stored and later re-exported or
 * opened in Excel/Sheets. A cell like `=HYPERLINK("https://evil",...)`
 * or `+cmd|...` executes when an admin opens the export. Every parsed
 * cell value passes through here before it is trusted.
 */

const FORMULA_PREFIX_RE = /^[=+\-@\t\r]/;

/**
 * Neutralize a single cell value. Leading formula characters are prefixed
 * with a single quote (Excel's standard text escape), which preserves the
 * visible value while preventing evaluation.
 */
export function sanitizeSpreadsheetCell(value: string): string {
  const cell = String(value ?? "");
  if (cell.length === 0 || !FORMULA_PREFIX_RE.test(cell)) {
    return cell;
  }
  return `'${cell}`;
}

/** Sanitize a whole string[][] grid in place-safe fashion. */
export function sanitizeSpreadsheetGrid(grid: string[][]): string[][] {
  return grid.map((row) => (row || []).map((cell) => sanitizeSpreadsheetCell(cell)));
}

/** Sanitize a rows-as-objects parse result. */
export function sanitizeSpreadsheetRows(
  rows: Array<Record<string, string>>,
): Array<Record<string, string>> {
  return rows.map((row) => {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(row || {})) {
      out[sanitizeSpreadsheetCell(key)] = sanitizeSpreadsheetCell(value);
    }
    return out;
  });
}
