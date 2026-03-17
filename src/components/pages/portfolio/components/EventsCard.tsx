/**
 * Portfolio Summary — Upcoming Reviews & Meetings Card
 * Guidelines §7 (presentation only), §8.3 (consistent patterns).
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import { Separator } from '../../../ui/separator';
import {
  Calendar,
  Eye,
  CheckCircle,
  Clock,
  Plus,
} from 'lucide-react';
import type { PortfolioEvent } from '../api';
import { formatDate } from '../utils';

interface EventsCardProps {
  events: PortfolioEvent[];
  onBookMeeting: () => void;
}

export function EventsCard({ events, onBookMeeting }: EventsCardProps) {
  return (
    <Card className="bg-white border-gray-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-black">Upcoming Reviews & Meetings</CardTitle>
          </div>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-700"
            onClick={onBookMeeting}
          >
            <Plus className="mr-2 h-4 w-4" />
            Book Meeting
          </Button>
        </div>
        <CardDescription>Stay on top of your financial reviews</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {events.length === 0 && (
            <div className="flex flex-col items-center py-6 text-center">
              <Calendar className="h-10 w-10 text-gray-300 mb-3" />
              <p className="text-sm font-medium text-gray-600">No upcoming events</p>
              <p className="text-xs text-gray-500 mt-1">
                Book a meeting with your adviser to get started.
              </p>
            </div>
          )}
          {events.map((event) => (
            <div key={event.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex-shrink-0 mt-1">
                {event.type === 'meeting' && <Calendar className="h-4 w-4 text-blue-600" />}
                {event.type === 'review' && <Eye className="h-4 w-4 text-purple-600" />}
                {event.type === 'task' && <CheckCircle className="h-4 w-4 text-green-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-black truncate">{event.title}</p>
                  <Badge
                    className={
                      event.status === 'confirmed'
                        ? 'bg-green-100 text-green-800'
                        : event.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }
                  >
                    {event.status}
                  </Badge>
                </div>
                <p className="text-xs text-gray-600 mb-2">{event.description}</p>
                <div className="flex items-center text-xs text-gray-500">
                  <Clock className="h-3 w-3 mr-1" />
                  <span>
                    {formatDate(event.date)}
                    {event.time ? ` at ${event.time}` : ''}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <Separator className="my-4" />
        <div className="text-center">
          <Button variant="outline" size="sm" className="w-full" onClick={onBookMeeting}>
            <Calendar className="mr-2 h-4 w-4" />
            Schedule Another Meeting
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}