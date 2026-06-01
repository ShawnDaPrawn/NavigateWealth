import { describe, expect, it } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFormWithValidation } from '../useFormWithValidation';

interface Form {
  name: string;
  email: string;
}
const initial: Form = { name: '', email: '' };
const validate = (v: Form) => ({
  name: v.name ? undefined : 'Name is required',
  email: v.email.includes('@') ? undefined : 'Invalid email',
});

describe('useFormWithValidation', () => {
  it('updates values via setValue and setValues', () => {
    const { result } = renderHook(() => useFormWithValidation(initial, validate));
    act(() => result.current.setValue('name', 'Ada'));
    expect(result.current.values.name).toBe('Ada');
    act(() => result.current.setValues({ email: 'a@b.co' }));
    expect(result.current.values).toEqual({ name: 'Ada', email: 'a@b.co' });
  });

  it('validate stores only truthy errors and reports isValid', () => {
    const { result } = renderHook(() => useFormWithValidation(initial, validate));
    let errs: Partial<Record<keyof Form, string>> = {};
    act(() => {
      errs = result.current.validate();
    });
    expect(errs).toEqual({ name: 'Name is required', email: 'Invalid email' });
    expect(result.current.isValid).toBe(false);

    act(() => result.current.setValues({ name: 'Ada', email: 'a@b.co' }));
    act(() => {
      result.current.validate();
    });
    expect(result.current.errors).toEqual({});
    expect(result.current.isValid).toBe(true);
  });

  it('editing a field clears its existing error', () => {
    const { result } = renderHook(() => useFormWithValidation(initial, validate));
    act(() => {
      result.current.validate();
    });
    expect(result.current.errors.name).toBe('Name is required');
    act(() => result.current.setValue('name', 'Ada'));
    expect(result.current.errors.name).toBeUndefined();
    // the untouched field's error remains
    expect(result.current.errors.email).toBe('Invalid email');
  });

  it('reset restores values and clears errors', () => {
    const { result } = renderHook(() => useFormWithValidation(initial, validate));
    act(() => result.current.setValue('name', 'Ada'));
    act(() => {
      result.current.validate();
    });
    act(() => result.current.reset());
    expect(result.current.values).toEqual(initial);
    expect(result.current.errors).toEqual({});
    expect(result.current.isValid).toBe(true);
  });
});
