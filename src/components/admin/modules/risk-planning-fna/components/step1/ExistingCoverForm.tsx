import { useFormContext } from 'react-hook-form';
import { Button } from '../../../../../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '../../../../../ui/form';
import { CurrencyInputField } from '../../../../../ui/currency-input';
import { Info, Loader2, RefreshCw } from 'lucide-react';
import { INCOME_PROTECTION } from '../../constants';
import type { InformationGatheringFormValues } from '../../schema';
import { formatCurrency } from '../../utils';

interface ExistingCoverFormProps {
  clientId?: string;
  isRecalculating: boolean;
  onRecalculate: () => void;
}

type CoverFieldName = Extract<keyof InformationGatheringFormValues, `existingCover${string}`>;

interface CoverRow {
  key: string;
  label: string;
  note?: string;
  monthly: boolean;
  personal: CoverFieldName;
  group: CoverFieldName;
}

const COVER_ROWS: readonly CoverRow[] = [
  {
    key: 'life',
    label: 'Life cover',
    monthly: false,
    personal: 'existingCoverLifePersonal',
    group: 'existingCoverLifeGroup',
  },
  {
    key: 'disability',
    label: 'Disability',
    monthly: false,
    personal: 'existingCoverDisabilityPersonal',
    group: 'existingCoverDisabilityGroup',
  },
  {
    key: 'severeIllness',
    label: 'Severe illness',
    monthly: false,
    personal: 'existingCoverSevereIllnessPersonal',
    group: 'existingCoverSevereIllnessGroup',
  },
  {
    key: 'ipTemporary',
    label: 'Income protection, temporary',
    note: 'Monthly · offsets only against short-term benefits',
    monthly: true,
    personal: 'existingCoverIPTemporaryPersonal',
    group: 'existingCoverIPTemporaryGroup',
  },
  {
    key: 'ipPermanent',
    label: 'Income protection, permanent',
    note: 'Monthly · offsets only against benefits payable to retirement',
    monthly: true,
    personal: 'existingCoverIPPermanentPersonal',
    group: 'existingCoverIPPermanentGroup',
  },
];

const COLUMNS =
  'md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1fr)]';
const HEADER_CELL = 'text-[11px] leading-4 font-semibold uppercase tracking-[0.12em] text-nw-muted';

export function ExistingCoverForm({
  clientId,
  isRecalculating,
  onRecalculate,
}: ExistingCoverFormProps) {
  const form = useFormContext<InformationGatheringFormValues>();
  const values = form.watch();

  const totalFor = (row: CoverRow) =>
    Number(values[row.personal] || 0) + Number(values[row.group] || 0);

  const termsFor = (row: CoverRow) => {
    if (row.key === 'ipTemporary') {
      return (
        <FormField
          control={form.control}
          name="ipTemporaryBenefitPeriod"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-normal text-nw-muted">Benefit period</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {INCOME_PROTECTION.BENEFIT_PERIODS.map((period) => (
                    <SelectItem key={period.value} value={period.value}>
                      {period.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    }
    if (row.key === 'ipPermanent') {
      return (
        <FormField
          control={form.control}
          name="ipPermanentEscalation"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-xs font-normal text-nw-muted">Escalation</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {INCOME_PROTECTION.ESCALATION_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
      );
    }
    return (
      <span className="hidden text-nw-muted md:inline" aria-hidden="true">
        —
      </span>
    );
  };

  const amountField = (row: CoverRow, which: 'personal' | 'group') => (
    <FormField
      control={form.control}
      name={row[which]}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-[13px] font-medium md:sr-only">
            <span className="sr-only">{row.label}, </span>
            {which === 'personal' ? 'Personal policies' : 'Group policies'}
            {row.monthly && <span className="sr-only"> (monthly)</span>}
          </FormLabel>
          <FormControl>
            <CurrencyInputField {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );

  return (
    <section
      aria-labelledby="existing-cover-title"
      className="rounded-lg border border-nw-line bg-white"
    >
      <div className="flex flex-col gap-3 border-b border-nw-line-soft p-4 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div className="flex flex-col gap-1">
          <h3
            id="existing-cover-title"
            className="text-[15px] leading-[22px] font-semibold text-nw-ink"
          >
            Existing cover
          </h3>
          <p className="text-[13px] leading-[18px] text-nw-muted">
            Totals from the client&apos;s saved policies, split into personal and group cover.
          </p>
        </div>
        {clientId && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onRecalculate}
            disabled={isRecalculating}
            className="flex-shrink-0 max-sm:h-11"
          >
            {isRecalculating ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            )}
            {isRecalculating ? 'Syncing…' : 'Load from policies'}
          </Button>
        )}
      </div>

      <div
        className={`hidden gap-4 border-b border-nw-line-soft bg-nw-paper-3 px-6 py-2.5 md:grid ${COLUMNS}`}
        aria-hidden="true"
      >
        <span className={HEADER_CELL}>Benefit</span>
        <span className={HEADER_CELL}>Personal policies</span>
        <span className={HEADER_CELL}>Group policies</span>
        <span className={`${HEADER_CELL} text-right`}>Total</span>
        <span className={HEADER_CELL}>Terms</span>
      </div>

      <ul className="divide-y divide-nw-line-soft">
        {COVER_ROWS.map((row) => (
          <li
            key={row.key}
            className={`grid grid-cols-2 gap-x-3 gap-y-3 px-4 py-4 md:items-center md:gap-4 md:px-6 md:py-3 ${COLUMNS}`}
          >
            <div className="col-span-2 md:col-span-1">
              <p className="font-medium text-nw-ink">{row.label}</p>
              {row.note && <p className="text-xs leading-4 text-nw-muted">{row.note}</p>}
            </div>
            {amountField(row, 'personal')}
            {amountField(row, 'group')}
            <p className="col-span-2 flex items-baseline justify-between gap-2 font-semibold text-nw-ink tabular-nums md:col-span-1 md:justify-end">
              <span className="text-[13px] font-medium text-nw-muted md:hidden">Total</span>
              <span>
                {formatCurrency(totalFor(row))}
                {row.monthly && (
                  <span className="ml-1 text-xs font-normal text-nw-muted">/ mo</span>
                )}
              </span>
            </p>
            <div className="col-span-2 md:col-span-1">{termsFor(row)}</div>
          </li>
        ))}
      </ul>

      <p className="flex items-start gap-2 rounded-b-lg border-t border-nw-line-soft bg-nw-paper-3 px-4 py-3 text-[13px] leading-[18px] text-nw-text sm:px-6">
        <Info className="mt-0.5 h-4 w-4 flex-none text-nw-muted" aria-hidden="true" />
        Personal and group cover are offset separately. Temporary and permanent income protection
        are never offset against each other.
      </p>
    </section>
  );
}
