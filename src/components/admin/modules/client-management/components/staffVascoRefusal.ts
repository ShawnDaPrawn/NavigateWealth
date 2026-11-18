import { APIError } from '../../../../../utils/api';

const STAFF_VASCO_REFUSAL = 'Cannot open Ask Vasco for staff accounts';

/**
 * The server refuses Ask Vasco for a staff profile even when the client
 * list row does not carry that role.
 */
export function isStaffVascoRefusal(error: unknown): boolean {
  return (
    error instanceof APIError &&
    error.statusCode === 403 &&
    error.message.includes(STAFF_VASCO_REFUSAL)
  );
}
