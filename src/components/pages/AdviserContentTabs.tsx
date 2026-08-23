/**
 * The main content tabs (overview, meeting history, communications) of the
 * My Adviser page. JSX moved verbatim from MyAdviserPage.tsx; every
 * captured name became a prop, and the pure formatters/icon pickers come
 * from myAdviserPageShared.
 */
import React from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  ArrowRight,
  Calendar,
  Clock,
  Download,
  ExternalLink,
  FileText,
  MessageSquare,
  Star,
} from 'lucide-react';
import {
  formatDate,
  formatRelativeDate,
  getCommunicationIcon,
  getDocumentIcon,
  getMeetingTypeIcon,
  getPriorityBadge,
  type AdviserCommunication,
  type AdviserMeeting,
} from './myAdviserPageShared';

interface AdviserContentTabsProps {
  activeTab: string;
  setActiveTab: React.Dispatch<React.SetStateAction<string>>;
  isAdviserAssigned: boolean | undefined;
  meetingHistory: AdviserMeeting[];
  communicationHistory: AdviserCommunication[];
}

export function AdviserContentTabs({
  activeTab,
  setActiveTab,
  isAdviserAssigned,
  meetingHistory,
  communicationHistory,
}: AdviserContentTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="meetings">Meeting History</TabsTrigger>
        <TabsTrigger value="communications">Communications</TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-6">
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-black">Recent Activity Summary</CardTitle>
            <CardDescription>Latest interactions and important updates</CardDescription>
          </CardHeader>
          <CardContent>
            {isAdviserAssigned ? (
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-black mb-3">Last Meeting</h4>
                  <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center space-x-2 mb-2">
                      {getMeetingTypeIcon(meetingHistory[0]?.meetingType)}
                      <span className="text-sm font-medium text-blue-800">
                        {meetingHistory[0]?.type || 'No meetings yet'}
                      </span>
                      <div className="flex">
                        {[...Array(meetingHistory[0]?.rating || 0)].map((_, i) => (
                          <Star key={i} className="h-3 w-3 text-yellow-500 fill-current" />
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-blue-700">
                      {formatDate(meetingHistory[0]?.date)} • {meetingHistory[0]?.duration}
                    </p>
                    <p className="text-xs text-blue-600 mt-1">{meetingHistory[0]?.summary}</p>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-black mb-3">Recent Communication</h4>
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        {getCommunicationIcon(communicationHistory[0]?.type)}
                        <span className="text-sm font-medium text-green-800">
                          {communicationHistory[0]?.subject || 'No communications yet'}
                        </span>
                      </div>
                      {communicationHistory[0]?.priority &&
                        getPriorityBadge(communicationHistory[0].priority)}
                    </div>
                    <p className="text-sm text-green-700">
                      {formatDate(communicationHistory[0]?.date)}
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      {communicationHistory[0]?.summary}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h4 className="font-medium text-black mb-2">Ready for Your Financial Journey</h4>
                <p className="text-gray-600 max-w-md mx-auto">
                  Once your adviser is assigned, you'll see your meeting history, communications,
                  and relationship metrics here.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="meetings" className="space-y-6">
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-black">Meeting History</CardTitle>
            <CardDescription>Complete record of all advisory meetings and sessions</CardDescription>
          </CardHeader>
          <CardContent>
            {isAdviserAssigned && meetingHistory.length > 0 ? (
              <div className="space-y-6">
                {meetingHistory.map((meeting, _index) => (
                  <div key={meeting.id} className="border border-gray-200 rounded-lg p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="font-medium text-black">{meeting.type}</h3>
                          <Badge className="bg-green-100 text-green-800">{meeting.status}</Badge>
                          <span className="text-sm text-gray-500">{meeting.duration}</span>
                          {getMeetingTypeIcon(meeting.meetingType)}
                          <div className="flex">
                            {[...Array(meeting.rating)].map((_, i) => (
                              <Star key={i} className="h-3 w-3 text-yellow-500 fill-current" />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-gray-600">{formatDate(meeting.date)}</p>
                      </div>
                      <Button variant="outline" size="sm">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                    </div>

                    <p className="text-sm text-gray-700 mb-4">{meeting.summary}</p>

                    {meeting.documents.length > 0 && (
                      <div>
                        <h4 className="font-medium text-black text-sm mb-3">Meeting Documents</h4>
                        <div className="grid md:grid-cols-2 gap-3">
                          {meeting.documents.map((doc, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                            >
                              <div className="flex items-center space-x-3">
                                {getDocumentIcon(doc.type)}
                                <div>
                                  <p className="text-sm font-medium text-black">{doc.name}</p>
                                  <p className="text-xs text-gray-500">{doc.size}</p>
                                </div>
                              </div>
                              <Button variant="ghost" size="sm">
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h4 className="font-medium text-black mb-2">No Meetings Yet</h4>
                <p className="text-gray-600">
                  {isAdviserAssigned
                    ? 'Once you start meeting with your adviser, your meeting history will appear here.'
                    : 'Your meeting history will appear here once an adviser is assigned.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="communications" className="space-y-6">
        <Card className="border-gray-200">
          <CardHeader>
            <CardTitle className="text-black">Communication Timeline</CardTitle>
            <CardDescription>Chronological view of all client-adviser interactions</CardDescription>
          </CardHeader>
          <CardContent>
            {isAdviserAssigned && communicationHistory.length > 0 ? (
              <div className="space-y-4">
                {communicationHistory.map((comm, _index) => (
                  <div
                    key={comm.id}
                    className="flex items-start space-x-4 p-4 border border-gray-200 rounded-lg"
                  >
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                      {getCommunicationIcon(comm.type)}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-black">{comm.subject}</h4>
                        <div className="flex items-center space-x-2">
                          {comm.priority && getPriorityBadge(comm.priority)}
                          <Badge variant="outline" className="text-xs">
                            {comm.status}
                          </Badge>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{comm.summary}</p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>
                          {formatDate(comm.date)} • {formatRelativeDate(comm.date)}
                        </span>
                        {comm.attachments && (
                          <span className="flex items-center space-x-1">
                            <FileText className="h-3 w-3" />
                            <span>{comm.attachments.length} attachment(s)</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <Button variant="ghost" size="sm">
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h4 className="font-medium text-black mb-2">No Communications Yet</h4>
                <p className="text-gray-600">
                  {isAdviserAssigned
                    ? 'Your communication history with your adviser will appear here.'
                    : 'Communication history will appear here once an adviser is assigned.'}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
