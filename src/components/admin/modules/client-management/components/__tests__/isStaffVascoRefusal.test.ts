import { describe, expect, it } from 'vitest';
import { APIError } from '../../../../../../utils/api';
import { isStaffVascoRefusal } from '../staffVascoRefusal';

describe('isStaffVascoRefusal', () => {
  it('matches the server 403 and nothing else', () => {
    expect(isStaffVascoRefusal(new APIError('Cannot open Ask Vasco for staff accounts', 403))).toBe(
      true,
    );
    expect(isStaffVascoRefusal(new APIError('Cannot open Ask Vasco for staff accounts', 500))).toBe(
      false,
    );
    expect(isStaffVascoRefusal(new APIError('Forbidden', 403))).toBe(false);
    expect(isStaffVascoRefusal(new Error('Cannot open Ask Vasco for staff accounts'))).toBe(false);
  });
});
