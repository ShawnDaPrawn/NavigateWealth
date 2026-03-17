import React from 'react';
import { Button } from '../../../../../ui/button';
import { Avatar, AvatarFallback } from '../../../../../ui/avatar';
import { Badge } from '../../../../../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Briefcase, Users } from 'lucide-react';
import { ClientSummary } from '../../PersonnelApi';

interface TabClientBookProps {
  clients: ClientSummary[];
  loading: boolean;
}

export function TabClientBook({ clients, loading }: TabClientBookProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg">Assigned Client Book</CardTitle>
        <Button variant="outline" size="sm">
          <Briefcase className="h-4 w-4 mr-2" />
          Bulk Reassign
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
            <div className="text-center py-8">Loading clients...</div>
        ) : clients.length > 0 ? (
            <div className="space-y-2">
                {clients.map(client => (
                    <div key={client.id} className="flex items-center justify-between p-3 border rounded hover:bg-slate-50">
                        <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                                <AvatarFallback>{client.name[0]}</AvatarFallback>
                            </Avatar>
                            <div>
                                <div className="font-medium text-sm">{client.name}</div>
                                <div className="text-xs text-muted-foreground">{client.email}</div>
                            </div>
                        </div>
                        <Badge variant={client.status === 'approved' ? 'default' : 'outline'}>
                            {client.status}
                        </Badge>
                    </div>
                ))}
            </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>No clients currently assigned to this profile.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
