/**
 * Newsletter Studio — audiences: the communication groups this studio
 * targets. Read-only here by design; membership is managed in the
 * Communication module (one source of truth, no parallel list system) and
 * individual subscribers in Publications → Subscribers.
 */
import { Link } from 'react-router';
import { ExternalLink, Users } from 'lucide-react';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Card, CardContent } from '../../../../ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../../ui/table';
import { useStudioLists } from '../hooks/useNewsletterStudio';

export function AudiencesTab() {
  const { data: lists = [], isLoading } = useStudioLists();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Campaign audiences are the platform's communication groups. The system-managed{' '}
          <span className="font-medium text-foreground">Newsletter Contacts</span> group tracks
          confirmed subscribers automatically; opted-out addresses are excluded from every send.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin?module=communication">
              Manage groups <ExternalLink className="ml-1 h-3.5 w-3.5" aria-hidden />
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link to="/admin?module=publications">
              Manage subscribers <ExternalLink className="ml-1 h-3.5 w-3.5" aria-hidden />
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="py-10 text-center text-sm text-muted-foreground">Loading audiences…</p>
          ) : lists.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Users className="mx-auto mb-2 h-8 w-8 opacity-40" aria-hidden />
              No groups found yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>List</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Members</TableHead>
                    <TableHead className="text-right">External contacts</TableHead>
                    <TableHead className="text-right">Clients</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lists.map((list) => (
                    <TableRow key={list.id}>
                      <TableCell>
                        <span className="block font-medium">{list.name}</span>
                        {list.description ? (
                          <span className="block max-w-md truncate text-xs text-muted-foreground">
                            {list.description}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={list.type === 'system' ? 'secondary' : 'outline'}>
                          {list.type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{list.memberCount}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {list.externalContactCount}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{list.clientCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
