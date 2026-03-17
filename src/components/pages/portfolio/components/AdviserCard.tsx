/**
 * Portfolio Summary — Adviser Contact Card
 * Displays the client's assigned financial adviser details.
 * Guidelines §7 (presentation only), §8.3 (consistent patterns).
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import { Button } from '../../../ui/button';
import { Avatar, AvatarFallback } from '../../../ui/avatar';
import { Separator } from '../../../ui/separator';
import {
  User,
  Mail,
  Phone,
  ShieldCheck,
  Calendar,
} from 'lucide-react';
import type { AdviserDetails } from '../api';

interface AdviserCardProps {
  adviser: AdviserDetails;
  onBookMeeting: () => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function AdviserCard({ adviser, onBookMeeting }: AdviserCardProps) {
  const isPlatformDefault = adviser.name === 'Your Navigate Wealth Adviser';

  return (
    <Card className="bg-white border-gray-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center space-x-2">
          <User className="h-5 w-5 text-purple-600" />
          <span className="text-black">Your Financial Adviser</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-4">
          <Avatar className="h-14 w-14 bg-purple-100 text-purple-700">
            <AvatarFallback className="bg-purple-100 text-purple-700 text-lg font-semibold">
              {isPlatformDefault ? 'NW' : getInitials(adviser.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-black truncate">{adviser.name}</h3>
            <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
              <ShieldCheck className="h-3.5 w-3.5 text-green-600 shrink-0" />
              <span>{adviser.fspReference}</span>
            </p>
          </div>
        </div>

        <Separator className="my-4" />

        <div className="space-y-3">
          <a
            href={`mailto:${adviser.email}`}
            className="flex items-center gap-3 text-sm text-gray-700 hover:text-purple-700 transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-purple-50 transition-colors shrink-0">
              <Mail className="h-4 w-4 text-blue-600 group-hover:text-purple-600" />
            </div>
            <span className="truncate">{adviser.email}</span>
          </a>

          <a
            href={`tel:${adviser.phone}`}
            className="flex items-center gap-3 text-sm text-gray-700 hover:text-purple-700 transition-colors group"
          >
            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center group-hover:bg-purple-50 transition-colors shrink-0">
              <Phone className="h-4 w-4 text-green-600 group-hover:text-purple-600" />
            </div>
            <span>{adviser.phone}</span>
          </a>
        </div>

        <Separator className="my-4" />

        <Button
          className="w-full bg-purple-600 hover:bg-purple-700"
          onClick={onBookMeeting}
        >
          <Calendar className="mr-2 h-4 w-4" />
          Book a Meeting
        </Button>
      </CardContent>
    </Card>
  );
}
