import { Card, CardContent } from '../../../../../ui/card';
import { UserCheck } from 'lucide-react';

interface SelectedClientCardProps {
  client: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    riskProfile?: string;
  } | null;
  isLoading?: boolean;
}

export function SelectedClientCard({ client, isLoading }: SelectedClientCardProps) {
  if (isLoading) {
    return (
      <Card className="bg-muted/50">
        <CardContent className="flex items-center justify-center p-6">
          <div className="animate-pulse flex space-x-4">
            <div className="rounded-full bg-slate-200 h-10 w-10"></div>
            <div className="flex-1 space-y-6 py-1">
              <div className="h-2 bg-slate-200 rounded"></div>
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-4">
                  <div className="h-2 bg-slate-200 rounded col-span-2"></div>
                  <div className="h-2 bg-slate-200 rounded col-span-1"></div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!client) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary/10 rounded-full">
            <UserCheck className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-lg text-primary">Selected Client</h3>
            <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{client.first_name} {client.last_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{client.email}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{client.phone || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Risk Profile</p>
                <p className="font-medium">{client.riskProfile || 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
