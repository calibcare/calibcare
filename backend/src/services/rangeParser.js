/**
 * Parses free-text range strings from the equipment register (e.g.
 * "0 to ±200 slpm", "-0.8 to 10 bar", "35-160kVp", " 0-15 psi") into
 * { min, max, unit }.
 *
 * The source data writes "A-B" ranges with no space around the hyphen
 * (e.g. "35-160kVp"), which is ambiguous with a negative sign. A leading
 * "-0.8 to 10" is a genuine negative number because it's followed by the
 * word "to", not another hyphenated digit. So: any hyphen directly between
 * two digits is treated as a range separator, not a minus sign.
 */
export function parseRange(raw) {
  if (raw === null || raw === undefined) return null;
  const str = String(raw).trim();
  if (!str) return null;

  const normalized = str
    .replace(/±/g, ' ± ')
    .replace(/(\d)\s*-\s*(\d)/g, '$1 to $2');

  const tokenRegex = /(±\s*)?[-+]?\d+(\.\d+)?/g;
  const values = [];
  let match;
  while ((match = tokenRegex.exec(normalized)) !== null) {
    const num = parseFloat(match[0].replace(/±\s*/, ''));
    if (Number.isNaN(num)) continue;
    if (match[1]) {
      values.push(-Math.abs(num), Math.abs(num));
    } else {
      values.push(num);
    }
  }
  if (values.length === 0) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);

  const unit = normalized
    .replace(/±/g, ' ')
    .replace(/[-+]?\d+(\.\d+)?/g, ' ')
    .replace(/\bto\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  return { min, max, unit: unit || null, raw: str };
}

// Known spellings of the same physical unit that appear in the source data
// (e.g. "AC Current"/"DC Current" use "amp" but "Equipment Current" uses
// "a") -- without this, the matcher would treat them as genuinely different
// units and silently miss real matches.
const UNIT_SYNONYMS = {
  a: 'amp',
  amp: 'amp',
  amps: 'amp',
};

export function normalizeUnit(unit) {
  if (!unit) return null;
  const stripped = String(unit).trim().toLowerCase().replace(/\s+/g, '');
  return UNIT_SYNONYMS[stripped] || stripped;
}
