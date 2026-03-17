/**
 * InboxStats — Sidebar overview card (total, unread, important).
 */

import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import { Badge } from '../../../ui/badge';

interface InboxStatsProps {
  total: number;
  unread: number;
  important: number;
}

export function InboxStats({ total, unread, important }: InboxStatsProps) {
  return (
    <Card className="border-gray-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Total Messages</span>
          <span className="text-gray-900">{total}</span>
        </div>
        <div className="h-px bg-gray-200" />
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Unread</span>
          {unread > 0 ? (
            <Badge className="bg-red-100 text-red-800 hover:bg-red-200">{unread}</Badge>
          ) : (
            <span className="text-gray-500">0</span>
          )}
        </div>
        <div className="h-px bg-gray-200" />
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Important</span>
          <span className="text-gray-900">{important}</span>
        </div>
      </CardContent>
    </Card>
  );
}
