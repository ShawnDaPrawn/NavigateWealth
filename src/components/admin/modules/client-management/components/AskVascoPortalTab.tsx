import React from 'react';
import { Bot, CheckCircle2, FileText, MessageSquareText, Shield, Sparkles, UserRound } from 'lucide-react';
import { Badge } from '../../../../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Client } from '../types';

interface AskVascoPortalTabProps {
  selectedClient: Client;
}

const contextItems = [
  { label: 'Profile', icon: UserRound },
  { label: 'Policies', icon: Shield },
  { label: 'Documents', icon: FileText },
  { label: 'Communication history', icon: MessageSquareText },
];

export function AskVascoPortalTab({ selectedClient }: AskVascoPortalTabProps) {
  const clientName = `${selectedClient.firstName} ${selectedClient.lastName}`.trim();

  return (
    <div className="space-y-4">
      <Card className="border-gray-200 shadow-sm">
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Ask Vasco</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Client portal AI navigator for {clientName || selectedClient.email}
              </p>
            </div>
          </div>
          <Badge className="border-0 bg-green-100 text-green-700 hover:bg-green-100">
            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            Portal enabled
          </Badge>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-lg border border-gray-200 bg-gray-50/70 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-900">
              <Bot className="h-4 w-4 text-purple-700" />
              Vasco client context
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {contextItems.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700"
                >
                  <item.icon className="h-4 w-4 text-gray-500" />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="text-sm font-medium text-gray-900">Portal placement</div>
            <div className="mt-3 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Client portal route</span>
                <Badge variant="outline" className="font-mono text-[11px]">
                  /ai-advisor
                </Badge>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Visible to</span>
                <span className="font-medium text-gray-900">Logged-in clients</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Current client</span>
                <span className="max-w-[180px] truncate font-medium text-gray-900">
                  {selectedClient.email}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
