import { useCallback, useState } from 'react';

export type ValidationErrors<T> = Partial<Record<keyof T, string>>;

export interface FormWithValidation<T> {
  values: T;
  errors: ValidationErrors<T>;
  /** Update one field; clears that field's error if it had one. */
  setValue: <K extends keyof T>(field: K, value: T[K]) => void;
  /** Merge a patch of fields at once. */
  setValues: (patch: Partial<T>) => void;
  /** Run the validator, store + return the (truthy-only) errors. Empty ⇒ valid. */
  validate: () => ValidationErrors<T>;
  /** True when there are no current errors. */
  isValid: boolean;
  /** Reset values (to `next` or the initial values) and clear errors. */
  reset: (next?: T) => void;
  clearErrors: () => void;
}

/**
 * Minimal controlled-form state + validation (Phase 6c shared layer). Holds the
 * values and a field→message error map, and runs a caller-supplied validator on
 * demand. Editing a field optimistically clears its error so the message
 * disappears as the user fixes it. The validator stays pure (values in, errors
 * out); this hook owns only the wiring.
 */
export function useFormWithValidation<T extends object>(
  initialValues: T,
  validateFn?: (values: T) => ValidationErrors<T>,
): FormWithValidation<T> {
  const [values, setValuesState] = useState<T>(initialValues);
  const [errors, setErrors] = useState<ValidationErrors<T>>({});

  const setValue = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setValuesState((prev) => ({ ...prev, [field]: value }) as T);
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const setValues = useCallback((patch: Partial<T>) => {
    setValuesState((prev) => ({ ...prev, ...patch }) as T);
  }, []);

  const validate = useCallback(() => {
    const raw: ValidationErrors<T> = validateFn ? validateFn(values) : {};
    const cleaned: ValidationErrors<T> = {};
    (Object.keys(raw) as Array<keyof T>).forEach((k) => {
      if (raw[k]) cleaned[k] = raw[k];
    });
    setErrors(cleaned);
    return cleaned;
  }, [values, validateFn]);

  const reset = useCallback(
    (next?: T) => {
      setValuesState(next ?? initialValues);
      setErrors({});
    },
    [initialValues],
  );

  const clearErrors = useCallback(() => setErrors({}), []);

  return {
    values,
    errors,
    setValue,
    setValues,
    validate,
    isValid: Object.keys(errors).length === 0,
    reset,
    clearErrors,
  };
}
