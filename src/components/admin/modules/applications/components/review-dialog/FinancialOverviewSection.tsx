import { DollarSign } from 'lucide-react';
import { ReviewSection, ViewField } from './shared';

interface FinancialOverviewSectionProps {
  grossMonthlyIncome?: string;
  monthlyExpensesEstimate?: string;
  amendedFields: Set<string>;
}

export function FinancialOverviewSection({
  grossMonthlyIncome,
  monthlyExpensesEstimate,
  amendedFields,
}: FinancialOverviewSectionProps) {
  return (
    <ReviewSection icon={DollarSign} title="Financial Overview">
      <div className="grid grid-cols-2 gap-x-6 gap-y-4">
        <ViewField
          label="Gross Monthly Income"
          value={grossMonthlyIncome}
          amended={amendedFields.has('grossMonthlyIncome')}
          syncField="grossMonthlyIncome"
        />
        <ViewField
          label="Monthly Expenses Estimate"
          value={monthlyExpensesEstimate}
          amended={amendedFields.has('monthlyExpensesEstimate')}
        />
      </div>
    </ReviewSection>
  );
}
