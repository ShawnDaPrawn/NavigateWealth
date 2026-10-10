import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@/test/utils';
import { CurrencyInputField } from '../currency-input';
import { NumberInputField } from '../number-input';

/** Types one character at a time at the end of the field, like a person. */
function typeInto(input: HTMLInputElement, text: string) {
  fireEvent.focus(input);
  for (const ch of text) {
    fireEvent.change(input, { target: { value: input.value + ch } });
  }
}

function NumberStateCurrency({ initial = 0 }: { initial?: number }) {
  const [value, setValue] = useState<number>(initial);
  return (
    <>
      <CurrencyInputField
        aria-label="Amount"
        value={value}
        onValueChange={(v) => setValue(v ?? 0)}
      />
      <output data-testid="stored">{value}</output>
    </>
  );
}

describe('CurrencyInputField', () => {
  it('types 265 into a zero amount as 265, not 0265', () => {
    render(<NumberStateCurrency />);
    const input = screen.getByLabelText('Amount') as HTMLInputElement;
    expect(input.value).toBe('');
    typeInto(input, '265');
    expect(input.value).toBe('265');
    expect(screen.getByTestId('stored').textContent).toBe('265');
  });

  it('adds a comma every three digits while typing and takes cents after "."', () => {
    render(<NumberStateCurrency />);
    const input = screen.getByLabelText('Amount') as HTMLInputElement;
    typeInto(input, '1234567.891');
    expect(input.value).toBe('1,234,567.89');
    expect(screen.getByTestId('stored').textContent).toBe('1234567.89');
  });

  it('shows the comma and the "." as they are typed, and changes nothing afterwards', () => {
    render(<NumberStateCurrency />);
    const input = screen.getByLabelText('Amount') as HTMLInputElement;
    typeInto(input, '1500');
    expect(input.value).toBe('1,500');
    typeInto(input, '.');
    expect(input.value).toBe('1,500.');
    typeInto(input, '5');
    expect(input.value).toBe('1,500.5');
    fireEvent.blur(input);
    expect(input.value).toBe('1,500.5');
  });

  it('drops a dangling "." when the field is left', () => {
    render(<NumberStateCurrency />);
    const input = screen.getByLabelText('Amount') as HTMLInputElement;
    typeInto(input, '20.');
    fireEvent.blur(input);
    expect(input.value).toBe('20');
  });

  it('shows rands with an R and a stored amount with separators', () => {
    render(<NumberStateCurrency initial={2500000} />);
    const input = screen.getByLabelText('Amount') as HTMLInputElement;
    expect(input.value).toBe('2,500,000');
    expect(screen.getByText('R')).toBeTruthy();
  });

  it('hands react-hook-form the raw number string', () => {
    const onChange = vi.fn();
    render(<CurrencyInputField aria-label="Amount" name="income" value="" onChange={onChange} />);
    const input = screen.getByLabelText('Amount') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '12345.6' } });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        target: expect.objectContaining({ value: '12345.6', name: 'income' }),
      }),
    );
  });

  it('follows the value when it changes from outside', () => {
    const { rerender } = render(<CurrencyInputField aria-label="Amount" value={100} />);
    rerender(<CurrencyInputField aria-label="Amount" value={1500000} />);
    expect((screen.getByLabelText('Amount') as HTMLInputElement).value).toBe('1,500,000');
  });
});

function NumberState({ initial = 0 }: { initial?: number }) {
  const [value, setValue] = useState<number>(initial);
  return (
    <NumberInputField aria-label="Children" value={value} onValueChange={(v) => setValue(v ?? 0)} />
  );
}

describe('NumberInputField', () => {
  it('empties a 0 on focus, so typing 3 gives 3, not 03', () => {
    render(<NumberState />);
    const input = screen.getByLabelText('Children') as HTMLInputElement;
    expect(input.value).toBe('0');
    typeInto(input, '3');
    expect(input.value).toBe('3');
  });

  it('puts the 0 back when left empty, and takes digits only', () => {
    render(<NumberState />);
    const input = screen.getByLabelText('Children') as HTMLInputElement;
    fireEvent.focus(input);
    expect(input.value).toBe('');
    fireEvent.blur(input);
    expect(input.value).toBe('0');
    typeInto(input, '1a2');
    expect(input.value).toBe('12');
  });

  it('shows each digit as it is typed, with no separators', () => {
    render(<NumberState />);
    const input = screen.getByLabelText('Children') as HTMLInputElement;
    fireEvent.focus(input);
    const seen: string[] = [];
    for (const ch of '12345') {
      fireEvent.change(input, { target: { value: input.value + ch } });
      seen.push(input.value);
    }
    expect(seen).toEqual(['1', '12', '123', '1234', '12345']);
  });

  it('takes a leading "-" only when negatives are allowed', () => {
    const { rerender } = render(<NumberInputField aria-label="Offset" value={0} />);
    const input = screen.getByLabelText('Offset') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '-5' } });
    expect(input.value).toBe('5');
    rerender(<NumberInputField aria-label="Offset" value={0} allowNegative />);
    fireEvent.change(input, { target: { value: '-05' } });
    expect(input.value).toBe('-5');
  });

  it('allows decimals when asked, without separators', () => {
    render(<NumberInputField aria-label="Rate" value={6} decimals={2} />);
    const input = screen.getByLabelText('Rate') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '12345.678' } });
    expect(input.value).toBe('12345.67');
  });
});
