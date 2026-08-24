/**
 * Goals domain — shared barrel.
 *
 * The goal entity and its projection maths are used by two separate parts of
 * the app: the goal planner inside the client-management module, and the
 * policy tabs in profile-sections that show whether a linked investment keeps
 * a goal on track. Neither owns the other, so the domain lives here in the
 * shared layer and both import it from the same place.
 */
export type {
  AdHocContribution,
  Goal,
  GoalCalculationResult,
  GoalFormData,
  GoalType,
} from './types';
export { calculateGoalStatus, calculatePolicyFV } from './calculations';
