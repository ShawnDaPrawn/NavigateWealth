import { describe, expect, it, vi } from 'vitest';
import { useForm } from 'react-hook-form';
import { render, screen } from '@/test/utils';
import { Form } from '../../../../../ui/form';
import { ExistingCoverForm } from '../step1/ExistingCoverForm';
import { DEFAULT_FORM_VALUES } from '../../constants';
import { formatCurrency } from '../../utils';
import type { InformationGatheringFormValues } from '../../schema';

function Harness({ values }: { values: Partial<InformationGatheringFormValues> }) {
  const form = useForm<InformationGatheringFormValues>({
    defaultValues: {
      ...(DEFAULT_FORM_VALUES as unknown as InformationGatheringFormValues),
      ...values,
    },
  });
  return (
    <Form {...form}>
      <ExistingCoverForm clientId="c1" isRecalculating={false} onRecalculate={vi.fn()} />
    </Form>
  );
}

describe('ExistingCoverForm', () => {
  it('totals personal and group cover per benefit', () => {
    render(
      <Harness
        values={{ existingCoverLifePersonal: '3000000', existingCoverLifeGroup: '1500000' }}
      />,
    );
    expect(screen.getByText(formatCurrency(4_500_000))).toBeTruthy();
  });

  it('names the benefit in every amount field for screen readers', () => {
    render(<Harness values={{}} />);
    expect(screen.getByLabelText('Life cover, Personal policies')).toBeTruthy();
    expect(
      screen.getByLabelText('Income protection, permanent, Group policies (monthly)'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: /Load from policies/ })).toBeTruthy();
    expect(screen.queryByText(/Mandatory Fix/)).toBeNull();
  });
});
