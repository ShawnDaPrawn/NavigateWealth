import React from 'react';
import { Label } from '../../../ui/label';
import { Input } from '../../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../ui/select';
import { StepProps } from '../types';
import { PROVINCES, PREFERRED_CONTACT_METHODS, BEST_TIMES_TO_CONTACT } from '../constants';
import { CountrySelect } from '../../../pages/profile/CountrySelect';
import {
  INPUT_CLASS,
  SELECT_TRIGGER_CLASS,
  LABEL_CLASS,
  SECTION_CONTAINER_SPACED_CLASS,
} from '../form-styles';
import { Mail, Phone, MapPin, Clock, Globe } from 'lucide-react';

function SectionHeader({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div className="h-9 w-9 rounded-lg bg-[#6d28d9]/10 flex items-center justify-center flex-shrink-0">
        <Icon className="h-4.5 w-4.5 text-[#6d28d9]" />
      </div>
      <div>
        <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">{title}</h3>
        {description && <p className="text-xs text-gray-500 mt-0.5">{description}</p>}
      </div>
    </div>
  );
}

export function Step2Contact({ data, updateData }: StepProps) {
  const isSouthAfrica = data.residentialCountry === 'South Africa';

  // Adaptive labels based on country
  const provinceLabel = isSouthAfrica ? 'Province' : 'State / Region / Province';
  const postalCodeLabel = isSouthAfrica ? 'Postal Code' : 'ZIP / Postal Code';
  const cityLabel = isSouthAfrica ? 'City' : 'City / Town';

  return (
    <div className="space-y-10">
      {/* Contact Details */}
      <div>
        <SectionHeader icon={Mail} title="Contact Details" description="Your primary contact information" />
        <div className={SECTION_CONTAINER_SPACED_CLASS}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <Label htmlFor="emailAddress" className={LABEL_CLASS}>Email Address <span className="text-red-500">*</span></Label>
              <Input id="emailAddress" type="email" value={data.emailAddress} onChange={(e) => updateData('emailAddress', e.target.value)} placeholder="name@example.com" className={INPUT_CLASS} />
            </div>
            <div>
              <Label htmlFor="alternativeEmail" className={LABEL_CLASS}>Alternative Email</Label>
              <Input id="alternativeEmail" type="email" value={data.alternativeEmail} onChange={(e) => updateData('alternativeEmail', e.target.value)} placeholder="Optional" className={INPUT_CLASS} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <Label htmlFor="cellphoneNumber" className={LABEL_CLASS}>Cellphone Number <span className="text-red-500">*</span></Label>
              <Input id="cellphoneNumber" type="tel" value={data.cellphoneNumber} onChange={(e) => updateData('cellphoneNumber', e.target.value)} placeholder="+27 82 123 4567" className={INPUT_CLASS} />
            </div>
            <div>
              <Label htmlFor="alternativeCellphone" className={LABEL_CLASS}>Alternative Cellphone</Label>
              <Input id="alternativeCellphone" type="tel" value={data.alternativeCellphone} onChange={(e) => updateData('alternativeCellphone', e.target.value)} placeholder="Optional" className={INPUT_CLASS} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <Label htmlFor="whatsappNumber" className={LABEL_CLASS}>WhatsApp Number</Label>
              <Input id="whatsappNumber" type="tel" value={data.whatsappNumber} onChange={(e) => updateData('whatsappNumber', e.target.value)} placeholder="If different from cellphone" className={INPUT_CLASS} />
            </div>
          </div>
        </div>
      </div>

      {/* Communication Preferences */}
      <div>
        <SectionHeader icon={Clock} title="Communication Preferences" description="Help us reach you at the right time, in the right way" />
        <div className={SECTION_CONTAINER_SPACED_CLASS}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <Label htmlFor="preferredContactMethod" className={LABEL_CLASS}>Preferred Contact Method</Label>
              <Select value={data.preferredContactMethod} onValueChange={(value) => updateData('preferredContactMethod', value)}>
                <SelectTrigger id="preferredContactMethod" className={SELECT_TRIGGER_CLASS}>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {PREFERRED_CONTACT_METHODS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="bestTimeToContact" className={LABEL_CLASS}>Best Time to Contact</Label>
              <Select value={data.bestTimeToContact} onValueChange={(value) => updateData('bestTimeToContact', value)}>
                <SelectTrigger id="bestTimeToContact" className={SELECT_TRIGGER_CLASS}>
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {BEST_TIMES_TO_CONTACT.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Residential Address */}
      <div>
        <SectionHeader icon={MapPin} title="Residential Address" description="Your physical address for FICA purposes" />
        <div className={SECTION_CONTAINER_SPACED_CLASS}>
          {/* Country FIRST — drives the rest of the address form */}
          <div>
            <Label htmlFor="residentialCountry" className={LABEL_CLASS}>Country <span className="text-red-500">*</span></Label>
            <div className="mt-1.5">
              <CountrySelect
                value={data.residentialCountry}
                onValueChange={(value) => {
                  updateData('residentialCountry', value);
                  // Clear province when country changes (since SA uses dropdown, others use free text)
                  if (value !== data.residentialCountry) {
                    updateData('residentialProvince', '');
                  }
                }}
                className={SELECT_TRIGGER_CLASS}
              />
            </div>
            {!isSouthAfrica && data.residentialCountry && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                <Globe className="h-3.5 w-3.5 flex-shrink-0" />
                <span>International address format — please enter your address as it appears locally.</span>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="residentialAddressLine1" className={LABEL_CLASS}>Address Line 1 <span className="text-red-500">*</span></Label>
            <Input id="residentialAddressLine1" value={data.residentialAddressLine1} onChange={(e) => updateData('residentialAddressLine1', e.target.value)} placeholder="Street address or P.O. Box" className={INPUT_CLASS} />
          </div>

          <div>
            <Label htmlFor="residentialAddressLine2" className={LABEL_CLASS}>Address Line 2</Label>
            <Input id="residentialAddressLine2" value={data.residentialAddressLine2} onChange={(e) => updateData('residentialAddressLine2', e.target.value)} placeholder="Apartment, suite, unit, etc." className={INPUT_CLASS} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <Label htmlFor="residentialSuburb" className={LABEL_CLASS}>{isSouthAfrica ? 'Suburb' : 'Suburb / District'}</Label>
              <Input id="residentialSuburb" value={data.residentialSuburb} onChange={(e) => updateData('residentialSuburb', e.target.value)} className={INPUT_CLASS} />
            </div>
            <div>
              <Label htmlFor="residentialCity" className={LABEL_CLASS}>{cityLabel} <span className="text-red-500">*</span></Label>
              <Input id="residentialCity" value={data.residentialCity} onChange={(e) => updateData('residentialCity', e.target.value)} className={INPUT_CLASS} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <Label htmlFor="residentialProvince" className={LABEL_CLASS}>{provinceLabel} <span className="text-red-500">*</span></Label>
              {isSouthAfrica ? (
                <Select value={data.residentialProvince} onValueChange={(value) => updateData('residentialProvince', value)}>
                  <SelectTrigger id="residentialProvince" className={SELECT_TRIGGER_CLASS}>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    {PROVINCES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Input id="residentialProvince" value={data.residentialProvince} onChange={(e) => updateData('residentialProvince', e.target.value)} placeholder="e.g. California, Ontario, London" className={INPUT_CLASS} />
              )}
            </div>
            <div>
              <Label htmlFor="residentialPostalCode" className={LABEL_CLASS}>{postalCodeLabel} <span className="text-red-500">*</span></Label>
              <Input id="residentialPostalCode" value={data.residentialPostalCode} onChange={(e) => updateData('residentialPostalCode', e.target.value)} placeholder={isSouthAfrica ? 'e.g. 2196' : 'e.g. 10001, SW1A 1AA'} className={INPUT_CLASS} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
