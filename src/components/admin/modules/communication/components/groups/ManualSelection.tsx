import React from 'react';
import { Search } from 'lucide-react';
import { Input } from '../../../../../ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../../../ui/card';
import { Checkbox } from '../../../../../ui/checkbox';
import { Client } from '../../types';
import { useVirtualizedRows } from '../../../../../shared/useVirtualizedRows';

interface ManualSelectionProps {
  clients: Client[];
  selectedIds: string[];
  onToggle: (id: string) => void;
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

const ROW_HEIGHT = 48;

export function ManualSelection({ 
  clients, 
  selectedIds, 
  onToggle, 
  searchTerm, 
  onSearchChange 
}: ManualSelectionProps) {
  
  const filteredClients = clients.filter(c => 
    (c.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) || 
     c.surname?.toLowerCase().includes(searchTerm.toLowerCase()) ||
     c.email?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const { parentRef, virtualItems, totalSize, isVirtualized } = useVirtualizedRows({
    count: filteredClients.length,
    estimateSize: ROW_HEIGHT,
    overscan: 8,
    threshold: 50,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Manual Selection</CardTitle>
        <CardDescription>Explicitly include specific clients regardless of filters.</CardDescription>
        <div className="relative mt-2">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search clients..." 
            className="pl-9"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md overflow-hidden">
          {/* Sticky header */}
          <div className="grid grid-cols-[50px_1fr_1fr] bg-muted/50 border-b text-sm font-medium text-muted-foreground">
            <div className="px-4 py-3" />
            <div className="px-4 py-3">Name</div>
            <div className="px-4 py-3">Email</div>
          </div>

          {/* Scrollable body */}
          <div ref={parentRef} className="max-h-[400px] overflow-y-auto">
            {filteredClients.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground text-sm">No clients found</div>
            ) : (
              <div
                style={{
                  height: isVirtualized ? totalSize : undefined,
                  position: isVirtualized ? 'relative' : undefined,
                }}
              >
                {virtualItems.map(vRow => {
                  const client = filteredClients[vRow.index];
                  return (
                    <div
                      key={client.id}
                      role="row"
                      tabIndex={0}
                      onClick={() => onToggle(client.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(client.id); } }}
                      className="grid grid-cols-[50px_1fr_1fr] border-b border-muted/30 cursor-pointer hover:bg-muted/50 items-center"
                      style={isVirtualized ? {
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: vRow.size,
                        transform: `translateY(${vRow.start}px)`,
                      } : { height: ROW_HEIGHT }}
                    >
                      <div className="px-4 flex items-center justify-center">
                        <Checkbox checked={selectedIds.includes(client.id)} />
                      </div>
                      <div className="px-4 font-medium text-sm truncate">{client.firstName} {client.surname}</div>
                      <div className="px-4 text-sm text-muted-foreground truncate">{client.email}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}