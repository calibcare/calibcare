import { parseRange, normalizeUnit } from './rangeParser.js';

/**
 * Checks one requirement (e.g. "Pressure 0-8 bar") against one equipment's
 * matching capability row. Comparison is against measurement_range (the
 * instrument's own capability), not product_operating_range -- an
 * instrument must be able to *generate/measure* the requested range,
 * regardless of what range the product it calibrates normally runs at.
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
      reason: `Equipment has no recorded capability for "${requirement.measurement_purpose}".`,
    };
  }

  const range = parseRange(capability.measurement_range);
  if (!range) {
    return {
      purpose: requirement.measurement_purpose,
      pass: false,
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

  const reasons = [];
  if (range.max < requirement.max) {
    reasons.push(
      `Required max ${requirement.max}${requirement.unit || ''}, equipment maximum is ${range.max}${range.unit ? ' ' + range.unit : ''}.`
    );
  }
  if (range.min > requirement.min) {
    reasons.push(
      `Required min ${requirement.min}${requirement.unit || ''}, equipment minimum is ${range.min}${range.unit ? ' ' + range.unit : ''}.`
    );
  }
  return {
    purpose: requirement.measurement_purpose,
    pass: false,
    reason: reasons.join(' '),
    equipmentRange: capability.measurement_range,
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
 * equipmentList: [{ equipment: {...}, capabilities: [...] }]
 * requirements: [{ measurement_purpose, min, max, unit }]
 *
 * Returns suitable equipment ranked by tightest coverage margin first
 * (closest-fitting instrument, not just any instrument wide enough), and
 * not-suitable equipment with per-requirement failure reasons.
 */
export function runDssMatch(equipmentList, requirements) {
  const evaluated = equipmentList.map(({ equipment, capabilities }) =>
    evaluateEquipment(equipment, capabilities, requirements)
  );

  const suitable = evaluated
    .filter((e) => e.suitable)
    .sort((a, b) => a.margin - b.margin);

  const notSuitable = evaluated.filter((e) => !e.suitable);

  return { suitable, notSuitable };
}
