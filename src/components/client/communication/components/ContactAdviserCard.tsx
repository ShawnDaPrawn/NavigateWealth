/**
 * ContactAdviserCard — Quick-action card for email / phone contact.
 */

import { Mail, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import { Button } from '../../../ui/button';
import { CONTACT } from '../constants';

export function ContactAdviserCard() {
  return (
    <Card className="border-gray-200 shadow-sm bg-gradient-to-br from-purple-50 to-white">
      <CardHeader>
        <CardTitle className="text-base">Contact Us</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-gray-600 mb-2">
          Need immediate assistance? Contact us directly.
        </p>
        <Button
          onClick={() => { window.location.href = CONTACT.emailHref; }}
          className="w-full bg-[#6d28d9] hover:bg-[#5b21b6] text-white justify-start"
        >
          <Mail className="h-4 w-4 mr-2 flex-shrink-0" />
          Email us: {CONTACT.email}
        </Button>
        <Button
          onClick={() => { window.location.href = CONTACT.phoneTel; }}
          variant="outline"
          className="w-full border-[#6d28d9] text-[#6d28d9] hover:bg-[#6d28d9] hover:text-white justify-start"
        >
          <Phone className="h-4 w-4 mr-2 flex-shrink-0" />
          Call us: {CONTACT.phoneNumber}
        </Button>
      </CardContent>
    </Card>
  );
}