import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Label } from '../../../../../ui/label';
import { Input } from '../../../../../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../../../ui/select';
import { usePersonnel } from '../../hooks/usePersonnel';

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
  
  const advisors = personnel.filter(p => p.role?.toLowerCase() === 'adviser');

  const [formData, setFormData] = useState<ClientData>({
    firstName: initialData?.firstName || '',
    lastName: initialData?.lastName || '',
    email: initialData?.email || '',
    mobile: initialData?.mobile || '',
    idOrDob: initialData?.idOrDob || '',
    advisorId: initialData?.advisorId || ''
  });

  const handleChange = (field: keyof ClientData, value: string) => {
    const updated = { ...formData, [field]: value };
    setFormData(updated);
    onDataChange(updated);
  };

  const isValid = () => {
    return formData.firstName && 
           formData.lastName && 
           formData.email && 
           formData.mobile && 
           formData.idOrDob && 
           formData.advisorId;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Client Profile</CardTitle>
        <p className="text-sm text-muted-foreground">
          Create a lightweight client profile for this RoA. Full client onboarding can be completed later.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Basic Information */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">First Name *</Label>
            <Input
              id="firstName"
              value={formData.firstName}
              onChange={(e) => handleChange('firstName', e.target.value)}
              placeholder="John"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last Name *</Label>
            <Input
              id="lastName"
              value={formData.lastName}
              onChange={(e) => handleChange('lastName', e.target.value)}
              placeholder="Smith"
            />
          </div>
        </div>

        {/* Contact Information */}
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="john.smith@email.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mobile">Mobile Number *</Label>
            <Input
              id="mobile"
              value={formData.mobile}
              onChange={(e) => handleChange('mobile', e.target.value)}
              placeholder="082 123 4567"
            />
          </div>
        </div>

        {/* Identification */}
        <div className="space-y-2">
          <Label htmlFor="idOrDob">ID Number or Date of Birth *</Label>
          <Input
            id="idOrDob"
            value={formData.idOrDob}
            onChange={(e) => handleChange('idOrDob', e.target.value)}
            placeholder="8501015009087 or 1985-01-01"
          />
          <p className="text-xs text-muted-foreground">
            Enter South African ID number or date of birth (YYYY-MM-DD format)
          </p>
        </div>

        {/* Advisor Assignment */}
        <div className="space-y-2">
          <Label htmlFor="advisor">Assigned Advisor *</Label>
          <Select 
            value={formData.advisorId} 
            onValueChange={(value) => handleChange('advisorId', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select advisor" />
            </SelectTrigger>
            <SelectContent>
              {advisors.map((advisor) => (
                <SelectItem key={advisor.id} value={advisor.id}>
                  {advisor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Validation Status */}
        {!isValid() && (
          <div className="bg-orange-50 border border-orange-200 p-3 rounded-lg">
            <p className="text-sm text-orange-700">
              Please complete all required fields marked with *
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
