import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Label } from '../../../../../ui/label';
import { Input } from '../../../../../ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../../../ui/select';
import { usePersonnel } from '../../hooks/usePersonnel';
import { Notice } from '../../../../layout/page';

interface ClientData {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  idOrDob: string;
  advisorId: string;
}

interface NewClientFormProps {
  onDataChange: (data: ClientData) => void;
  initialData?: Partial<ClientData>;
}

export function NewClientForm({ onDataChange, initialData }: NewClientFormProps) {
  const { data: personnel = [] } = usePersonnel();

  const advisors = personnel.filter((p) => p.role?.toLowerCase() === 'adviser');

  const [formData, setFormData] = useState<ClientData>({
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    email: initialData?.email || '',
    mobile: initialData?.mobile || '',
    idOrDob: initialData?.idOrDob || '',
    advisorId: initialData?.advisorId || '',
  });

  const handleChange = (field: keyof ClientData, value: string) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onDataChange(updated);
  };

  const [touched, setTouched] = useState<Partial<Record<keyof ClientData, boolean>>>({});
  const touch = (field: keyof ClientData) => setTouched((prev) => ({ ...prev, [field]: true }));
  const fieldError = (field: keyof ClientData): string | null => {
    if (!touched[field]) return null;
    const value = formData[field].trim();
    switch (field) {
      case 'firstName':
        return value ? null : 'Enter the first name';
      case 'lastName':
        return value ? null : 'Enter the last name';
      case 'email':
        if (!value) return 'Enter an email address';
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
          ? null
          : 'Enter an email address like name@example.com';
      case 'mobile':
        return value ? null : 'Enter a mobile number';
      case 'idOrDob':
        return value ? null : 'Enter an ID number or date of birth';
      case 'advisorId':
        return value ? null : 'Choose the assigned adviser';
      default:
        return null;
    }
  };
  const errorText = (field: keyof ClientData) => {
    const message = fieldError(field);
    return message ? (
      <p id={`${field}-error`} className="text-xs text-red-600">
        {message}
      </p>
    ) : null;
  };
  const invalidProps = (field: keyof ClientData) =>
    fieldError(field)
      ? {
          'aria-invalid': true as const,
          'aria-describedby': `${field}-error`,
          className: 'border-red-500',
        }
      : {};

  const isValid = () => {
    return (
      formData.firstName &&
      formData.lastName &&
      formData.email &&
      formData.mobile &&
      formData.idOrDob &&
      formData.advisorId
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create new client profile</CardTitle>
        <p className="text-sm text-muted-foreground">
          Create a lightweight client profile for this RoA. Full client onboarding can be completed
          later.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Basic Information */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">First name *</Label>
            <Input
              id="firstName"
              value={formData.firstName}
              onChange={(e) => handleChange('firstName', e.target.value)}
              onBlur={() => touch('firstName')}
              {...invalidProps('firstName')}
              placeholder="John"
            />
            {errorText('firstName')}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last name *</Label>
            <Input
              id="lastName"
              value={formData.lastName}
              onChange={(e) => handleChange('lastName', e.target.value)}
              onBlur={() => touch('lastName')}
              {...invalidProps('lastName')}
              placeholder="Smith"
            />
            {errorText('lastName')}
          </div>
        </div>

        {/* Contact Information */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              onBlur={() => touch('email')}
              {...invalidProps('email')}
              placeholder="john.smith@email.com"
            />
            {errorText('email')}
          </div>
          <div className="space-y-2">
            <Label htmlFor="mobile">Cellphone *</Label>
            <Input
              id="mobile"
              value={formData.mobile}
              onChange={(e) => handleChange('mobile', e.target.value)}
              onBlur={() => touch('mobile')}
              {...invalidProps('mobile')}
              placeholder="082 123 4567"
            />
            {errorText('mobile')}
          </div>
        </div>

        {/* Identification */}
        <div className="space-y-2">
          <Label htmlFor="idOrDob">ID number or date of birth *</Label>
          <Input
            id="idOrDob"
            value={formData.idOrDob}
            onChange={(e) => handleChange('idOrDob', e.target.value)}
            onBlur={() => touch('idOrDob')}
            {...invalidProps('idOrDob')}
            placeholder="8501015009087 or 1985-01-01"
          />
          {errorText('idOrDob')}
          <p className="text-xs text-muted-foreground">
            Enter South African ID number or date of birth (YYYY-MM-DD format)
          </p>
        </div>

        {/* Advisor Assignment */}
        <div className="space-y-2">
          <Label htmlFor="advisor">Assigned adviser *</Label>
          <Select
            value={formData.advisorId}
            onValueChange={(value) => {
              handleChange('advisorId', value);
              touch('advisorId');
            }}
          >
            <SelectTrigger id="advisor" {...invalidProps('advisorId')}>
              <SelectValue placeholder="Select adviser" />
            </SelectTrigger>
            <SelectContent>
              {advisors.map((advisor) => (
                <SelectItem key={advisor.id} value={advisor.id}>
                  {advisor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errorText('advisorId')}
        </div>

        {/* Validation Status */}
        {!isValid() && (
          <Notice kind="attention" title="Complete the required fields.">
            Fields marked * are needed before this RoA can be compiled.
          </Notice>
        )}
      </CardContent>
    </Card>
  );
}
