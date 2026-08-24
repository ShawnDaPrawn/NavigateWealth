/**
 * The Contact Details card of the admin client profile viewer. JSX moved
 * verbatim from ClientProfileViewerFull.tsx; every captured name became a
 * prop (state/actions come from useClientProfile at the root).
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../../../ui/card';
import { SelectItem } from '../../../../../ui/select';
import { Separator } from '../../../../../ui/separator';
import { Phone } from 'lucide-react';
import { InputWithCopy, SelectWithCopy } from './ProfileFieldsWithCopy';
import type { ClientProfileHook } from './clientProfileHook';

interface ClientProfileContactCardProps {
  state: ClientProfileHook['state'];
  actions: ClientProfileHook['actions'];
}

export function ClientProfileContactCard({ state, actions }: ClientProfileContactCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-[#6d28d9]/10 flex items-center justify-center">
            <Phone className="h-5 w-5 text-[#6d28d9]" />
          </div>
          <div>
            <CardTitle>Contact Details</CardTitle>
            <CardDescription>Contact information and preferences</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <InputWithCopy
              label="Email"
              value={state.profileData.email}
              id="email"
              fieldName="email"
              type="email"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                actions.handleInputChange('email', e.target.value)
              }
            />
          </div>
          <div className="space-y-2">
            <InputWithCopy
              label="Secondary Email"
              value={state.profileData.secondaryEmail}
              id="secondaryEmail"
              fieldName="secondaryEmail"
              type="email"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                actions.handleInputChange('secondaryEmail', e.target.value)
              }
            />
          </div>
          <div className="space-y-2">
            <InputWithCopy
              label="Phone Number"
              value={state.profileData.phoneNumber}
              id="phoneNumber"
              fieldName="phoneNumber"
              type="tel"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                actions.handleInputChange('phoneNumber', e.target.value)
              }
            />
          </div>
          <div className="space-y-2">
            <InputWithCopy
              label="Alternative Phone"
              value={state.profileData.alternativePhone}
              id="alternativePhone"
              fieldName="alternativePhone"
              type="tel"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                actions.handleInputChange('alternativePhone', e.target.value)
              }
            />
          </div>
          <div className="space-y-2">
            <SelectWithCopy
              label="Preferred Contact Method"
              value={state.profileData.preferredContactMethod}
              onValueChange={(value) => actions.handleInputChange('preferredContactMethod', value)}
              placeholder="Select method"
              id="preferredContactMethod"
            >
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="phone">Phone</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
            </SelectWithCopy>
          </div>
        </div>

        <Separator className="my-6" />
        <h3 className="text-lg font-medium mb-4">Emergency Contact</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <InputWithCopy
              label="Contact Name"
              value={state.profileData.emergencyContactName}
              id="emergencyContactName"
              fieldName="emergencyContactName"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                actions.handleInputChange('emergencyContactName', e.target.value)
              }
            />
          </div>
          <div className="space-y-2">
            <InputWithCopy
              label="Relationship"
              value={state.profileData.emergencyContactRelationship}
              id="emergencyContactRelationship"
              fieldName="emergencyContactRelationship"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                actions.handleInputChange('emergencyContactRelationship', e.target.value)
              }
            />
          </div>
          <div className="space-y-2">
            <InputWithCopy
              label="Phone Number"
              value={state.profileData.emergencyContactPhone}
              id="emergencyContactPhone"
              fieldName="emergencyContactPhone"
              type="tel"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                actions.handleInputChange('emergencyContactPhone', e.target.value)
              }
            />
          </div>
          <div className="space-y-2">
            <InputWithCopy
              label="Email"
              value={state.profileData.emergencyContactEmail}
              id="emergencyContactEmail"
              fieldName="emergencyContactEmail"
              type="email"
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                actions.handleInputChange('emergencyContactEmail', e.target.value)
              }
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
