/**
 * The engineering job positions that double as this system's access
 * levels, ranked by seniority (rank 1 = most senior).
 *
 * This is the ONE definition of the hierarchy -- routes, middleware and
 * the API's public user shape all read from here rather than hardcoding
 * their own list, the same way pickBucket() in reminderService.js is the
 * single shared definition of the reminder thresholds.
 *
 * Every position can view everything and use the Decision Support System;
 * the capabilities below are the additional rights layered on top.
 */
export const POSITIONS = [
  { key: 'deputy_manager', label: 'Deputy Manager - Engineering', rank: 1, canEdit: true, canRunReminders: true },
  { key: 'senior_specialist', label: 'Senior Specialist - Engineering', rank: 2, canEdit: true, canRunReminders: false },
  { key: 'specialist_1_pm', label: 'Specialist 1 - Engineering-PM', rank: 3, canEdit: false, canRunReminders: false },
  { key: 'specialist_1', label: 'Specialist 1 - Engineering', rank: 4, canEdit: false, canRunReminders: false },
  { key: 'specialist_2', label: 'Specialist 2 - Engineering', rank: 5, canEdit: false, canRunReminders: false },
];

/** New accounts start at the most junior position and are promoted by a Deputy Manager. */
export const DEFAULT_POSITION_KEY = 'specialist_2';

export function getPosition(key) {
  return POSITIONS.find((p) => p.key === key) || null;
}

export function hasCapability(key, capability) {
  const position = getPosition(key);
  return Boolean(position && position[capability]);
}
