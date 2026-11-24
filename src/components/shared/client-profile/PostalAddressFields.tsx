/**
 * Postal address block, dropped into the Address section of both profile
 * editors (client portal and admin viewer).
 */
import { Mailbox } from 'lucide-react';
import { Checkbox } from '../../ui/checkbox';
import { Input } from '../../ui/input';
import { Label } from '../../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select';
import type { PostalAddressFields as PostalAddress } from '../../../shared/client-profile';

const PROVINCES = [
  'Eastern Cape',
  'Free State',
  'Gauteng',
  'KwaZulu-Natal',
  'Limpopo',
  'Mpumalanga',
  'Northern Cape',
  'North West',
  'Western Cape',
];

export function PostalAddressFields({
  value,
  onChange,
}: {
  value: PostalAddress;
  onChange: (field: keyof PostalAddress, value: string | boolean) => void;
}) {
  const text = (field: Exclude<keyof PostalAddress, 'postalSameAsResidential'>, label: string) => (
    <div>
      <Label htmlFor={field}>{label}</Label>
      <Input
        id={field}
        value={value[field]}
        onChange={(e) => onChange(field, e.target.value)}
        className="mt-1.5"
      />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Mailbox className="h-4 w-4 text-[#6d28d9]" />
        <h4 className="text-sm text-gray-900">Postal address</h4>
      </div>
      <div className="flex items-center gap-2">
        <Checkbox
          id="postalSameAsResidential"
          checked={value.postalSameAsResidential}
          onCheckedChange={(checked) => onChange('postalSameAsResidential', checked === true)}
        />
        <Label htmlFor="postalSameAsResidential" className="cursor-pointer font-normal">
          Same as residential address
        </Label>
      </div>
      {!value.postalSameAsResidential && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            {text('postalAddressLine1', 'Address line 1 / PO Box')}
          </div>
          <div className="sm:col-span-2">{text('postalAddressLine2', 'Address line 2')}</div>
          {text('postalSuburb', 'Suburb')}
          {text('postalCity', 'City')}
          <div>
            <Label htmlFor="postalProvince">Province</Label>
            <Select
              value={value.postalProvince}
              onValueChange={(v) => onChange('postalProvince', v)}
            >
              <SelectTrigger id="postalProvince" className="mt-1.5">
                <SelectValue placeholder="Select province" />
              </SelectTrigger>
              <SelectContent>
                {PROVINCES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {text('postalPostalCode', 'Postal code')}
          {text('postalCountry', 'Country')}
        </div>
      )}
    </div>
  );
}
