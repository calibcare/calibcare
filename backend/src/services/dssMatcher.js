import { parseRange, normalizeUnit } from './rangeParser.js';

/**
 * Checks one requirement (e.g. "Pressure 0-8 bar") against one equipment's
 * matching capability row. Comparison is against measurement_range (the
 * instrument's own capability), not product_operating_range -- an
 * instrument must be able to *generate/measure* the requested range,
 * regardless of what range the product it calibrates normally runs at.
 *
 * Every failure carries a machine-readable `reasonCode` alongside the
 * free-text `reason` sentence, so callers can group/rank failures without
 * parsing prose. `range_too_narrow` failures also carry the parsed
 * `range`/`requirement` numbers and a `shortfall` -- used by
 * findClosestMatch()/describeClosestMatch() below.
 */
export function matchRequirement(capabilities, requirement) {
  const purposeKey = requirement.measurement_purpose.trim().toLowerCase();
  const capability = capabilities.find(
    (c) => c.measurement_purpose.trim().toLowerCase() === purposeKey
  );

  if (!capability) {
    return {
      purpose: requirement.measurement_purpose,
      pass: false,
      reasonCode: 'missing_capability',
      reason: `Equipment has no recorded capability for "${requirement.measurement_purpose}".`,
    };
  }

  const range = parseRange(capability.measurement_range);
  if (!range) {
    return {
      purpose: requirement.measurement_purpose,
      pass: false,
      reasonCode: 'unparseable_range',
      reason: `Equipment's measurement range ("${capability.measurement_range}") could not be parsed.`,
    };
  }

  if (
    requirement.unit &&
    range.unit &&
    normalizeUnit(requirement.unit) !== normalizeUnit(range.unit)
  ) {
    return {
      purpose: requirement.measurement_purpose,
      pass: false,
      reasonCode: 'unit_mismatch',
      reason: `Unit mismatch: requirement is in "${requirement.unit}", equipment measures in "${range.unit}" -- cannot verify coverage.`,
      equipmentRange: capability.measurement_range,
    };
  }

  const covers = range.min <= requirement.min && range.max >= requirement.max;
  if (covers) {
    return {
      purpose: requirement.measurement_purpose,
      pass: true,
      reason: `${requirement.measurement_purpose} capability covers requested range (equipment: ${capability.measurement_range}).`,
      equipmentRange: capability.measurement_range,
    };
  }

  const shortfall = { max: null, min: null };
  const reasons = [];
  if (range.max < requirement.max) {
    shortfall.max = requirement.max - range.max;
    reasons.push(
      `Required max ${requirement.max}${requirement.unit || ''}, equipment maximum is ${range.max}${range.unit ? ' ' + range.unit : ''}.`
    );
  }
  if (range.min > requirement.min) {
    shortfall.min = range.min - requirement.min;
    reasons.push(
      `Required min ${requirement.min}${requirement.unit || ''}, equipment minimum is ${range.min}${range.unit ? ' ' + range.unit : ''}.`
    );
  }
  return {
    purpose: requirement.measurement_purpose,
    pass: false,
    reasonCode: 'range_too_narrow',
    reason: reasons.join(' '),
    equipmentRange: capability.measurement_range,
    range: { min: range.min, max: range.max, unit: range.unit },
    requirement: { min: requirement.min, max: requirement.max, unit: requirement.unit },
    shortfall,
  };
}

/** Evaluates one equipment (with its capability rows) against every requirement. */
export function evaluateEquipment(equipment, capabilities, requirements) {
  const results = requirements.map((req) => matchRequirement(capabilities, req));
  const suitable = results.every((r) => r.pass);

  let margin = null;
  if (suitable) {
    margin = requirements.reduce((sum, req) => {
      const capability = capabilities.find(
        (c) => c.measurement_purpose.trim().toLowerCase() === req.measurement_purpose.trim().toLowerCase()
      );
      const range = parseRange(capability.measurement_range);
      return sum + (range.max - req.max) + (req.min - range.min);
    }, 0);
  }

  return { equipment, results, suitable, margin };
}

/**
 * Picks the "closest" not-suitable equipment to suggest when nothing
 * actually qualifies -- only equipment that has the right capability and
 * unit for every requirement, just falling short on range (a
 * missing-capability or unit-mismatch failure isn't meaningfully "close").
 * Ranked by total shortfall across its failing requirements; returns null
 * if no equipment qualifies for consideration.
 */
export function findClosestMatch(notSuitable) {
  const candidates = notSuitable.filter((e) =>
    e.results.every((r) => r.pass || r.reasonCode === 'range_too_narrow')
  );
  if (candidates.length === 0) return null;

  const scored = candidates.map((e) => ({
    ...e,
    totalShortfall: e.results.reduce((sum, r) => {
      if (r.pass) return sum;
      return sum + (r.shortfall.max || 0) + (r.shortfall.min || 0);
    }, 0),
  }));
  scored.sort((a, b) => a.totalShortfall - b.totalShortfall);
  return scored[0];
}

/** Human-readable summary sentence(s) for a findClosestMatch() result. */
export function describeClosestMatch(closestMatch) {
  return closestMatch.results
    .filter((r) => !r.pass && r.reasonCode === 'range_too_narrow')
    .flatMap((r) => {
      const parts = [];
      if (r.shortfall.max != null) {
        parts.push(
          `Covers up to ${r.range.max}${r.range.unit ? ' ' + r.range.unit : ''} -- short by ${r.shortfall.max}${r.requirement.unit || ''} of the ${r.requirement.max}${r.requirement.unit || ''} required.`
        );
      }
      if (r.shortfall.min != null) {
        parts.push(
          `Covers down to ${r.range.min}${r.range.unit ? ' ' + r.range.unit : ''} -- short by ${r.shortfall.min}${r.requirement.unit || ''} of the ${r.requirement.min}${r.requirement.unit || ''} required.`
        );
      }
      return parts;
    })
    .join(' ');
}

function describeGroupLabel(result) {
  switch (result.reasonCode) {
    case 'missing_capability':
      return `No ${result.purpose} capability recorded`;
    case 'unparseable_range':
      return `${result.purpose} range could not be parsed`;
    case 'unit_mismatch':
      return `Unit mismatch on ${result.purpose}`;
    case 'range_too_narrow': {
      const clauses = [];
      if (result.shortfall.max != null) {
        clauses.push(`Max range below ${result.requirement.max}${result.requirement.unit || ''} required`);
      }
      if (result.shortfall.min != null) {
        clauses.push(`Min range above ${result.requirement.min}${result.requirement.unit || ''} required`);
      }
      return clauses.join(' and ');
    }
    default:
      return result.reason;
  }
}

/**
 * Groups not-suitable equipment by why they failed (each equipment's
 * *first* failing requirement result), so the UI can show one banner for
 * "32 equipment fail because their max range is below 100 amp" instead of
 * 32 separate flat cards. Groups are sorted largest first.
 */
export function groupNotSuitable(notSuitable) {
  const groups = new Map();
  for (const entry of notSuitable) {
    const firstFail = entry.results.find((r) => !r.pass);
    if (!firstFail) continue;

    const side = firstFail.shortfall ? `${firstFail.shortfall.max != null ? 'max' : ''}${firstFail.shortfall.min != null ? 'min' : ''}` : '';
    const key = `${firstFail.purpose}::${firstFail.reasonCode}::${side}`;

    if (!groups.has(key)) {
      groups.set(key, {
        reasonCode: firstFail.reasonCode,
        purpose: firstFail.purpose,
        label: describeGroupLabel(firstFail),
        equipment: [],
      });
    }
    groups.get(key).equipment.push(entry);
  }
  return [...groups.values()].sort((a, b) => b.equipment.length - a.equipment.length);
}

/**
 * equipmentList: [{ equipment: {...}, capabilities: [...] }]
 * requirements: [{ measurement_purpose, min, max, unit }]
 *
 * Returns suitable equipment ranked by tightest coverage margin first
 * (closest-fitting instrument, not just any instrument wide enough),
 * not-suitable equipment with per-requirement failure reasons, that same
 * not-suitable list grouped by failure reason, and -- only when nothing is
 * suitable -- a single best "closest match" suggestion.
 */
export function runDssMatch(equipmentList, requirements) {
  const evaluated = equipmentList.map(({ equipment, capabilities }) =>
    evaluateEquipment(equipment, capabilities, requirements)
  );

  const suitable = evaluated
    .filter((e) => e.suitable)
    .sort((a, b) => a.margin - b.margin);

  const notSuitable = evaluated.filter((e) => !e.suitable);

  const result = { suitable, notSuitable, notSuitableGrouped: groupNotSuitable(notSuitable) };

  if (suitable.length === 0) {
    const closestMatch = findClosestMatch(notSuitable);
    if (closestMatch) {
      result.closestMatch = { ...closestMatch, summary: describeClosestMatch(closestMatch) };
    }
  }

  return result;
}
