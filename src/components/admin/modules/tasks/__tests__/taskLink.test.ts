import { describe, expect, it } from 'vitest';
import { taskAddress } from '../taskLink';

describe('taskAddress', () => {
  it('is the To-Do address with the task open (the Dashboard "Due today" link)', () => {
    expect(taskAddress('t-42').toString()).toBe('module=tasks&task=t-42');
  });
});
