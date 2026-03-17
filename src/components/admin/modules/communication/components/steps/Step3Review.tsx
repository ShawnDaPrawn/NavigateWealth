import React, { useState } from 'react';
import { 
  Users, Mail, FileText, Calendar, CheckCircle2, AlertTriangle, ArrowLeft, Loader2 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Button } from '../../../../../ui/button';
import { Badge } from '../../../../../ui/badge';
import { Alert, AlertDescription } from '../../../../../ui/alert';
import { Separator } from '../../../../../ui/separator';
import { toast } from 'sonner@2.0.3';
import { CommunicationDraft, SchedulingConfig } from '../../types';
import { SchedulingOptions } from '../SchedulingOptions';
import { communicationApi } from '../../api';
import DOMPurify from 'dompurify';

interface Step3Props {
  draft: CommunicationDraft;
  updateDraft: (updates: Partial<CommunicationDraft>) => void;
  onBack: () => void;
  onReset: () => void;
  /** Whether the current user has 'send' capability. Defaults to true for backwards compat. */
  canSend?: boolean;
}

export function Step3Review({ draft, updateDraft, onBack, onReset, canSend = true }: Step3Props) {
  const [isSending, setIsSending] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);

  const handleSend = async () => {
    setIsSending(true);
    try {
      // Map the draft to the campaign payload shape expected by the server
      const campaignPayload = {
        subject: draft.subject,
        bodyHtml: draft.bodyHtml,
        channel: draft.channel || 'email',
        recipientType: draft.recipientType,
        selectedRecipients: draft.selectedRecipients.map(r => ({
          id: r.id,
          email: r.email,
          firstName: r.firstName || '',
          lastName: r.lastName || r.surname || '',
          name: r.firstName ? `${r.firstName} ${r.surname || r.lastName || ''}`.trim() : r.email,
          phone: r.phone || '',
        })),
        selectedGroup: draft.selectedGroup ? {
          id: draft.selectedGroup.id,
          name: draft.selectedGroup.name,
          type: draft.selectedGroup.type,
          clientCount: draft.selectedGroup.clientCount,
        } : undefined,
        scheduling: {
          type: draft.scheduling.type,
          startDate: draft.scheduling.startDate ? draft.scheduling.startDate.toISOString() : undefined,
        },
      };

      // 1. Create/Persist Campaign
      const campaign = await communicationApi.createCampaign(campaignPayload);
      
      // 2. If Send Now, trigger send
      if (draft.scheduling.type === 'immediate') {
        await communicationApi.sendCampaign(campaign.id);
        toast.success('Campaign sent successfully!');
      } else {
        // Scheduled campaigns are picked up by the backend scheduler based on the persisted data
        toast.success('Campaign scheduled successfully!');
      }
      
      setIsConfirmed(true);
    } catch (error) {
      console.error(error);
      const msg = error instanceof Error ? error.message : 'Unknown error occurred';
      toast.error('Failed to process request: ' + msg);
    } finally {
      setIsSending(false);
    }
  };

  const handleSchedulingChange = (config: SchedulingConfig) => {
    updateDraft({ scheduling: config });
  };

  if (isConfirmed) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6 animate-in zoom-in-95 duration-500">
        <div className="h-24 w-24 bg-green-100 rounded-full flex items-center justify-center text-green-600">
          <CheckCircle2 className="h-12 w-12" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold text-gray-900">Success!</h2>
          <p className="text-muted-foreground text-lg">
            {draft.scheduling.type === 'immediate' 
              ? 'Your emails have been queued for delivery.' 
              : `Your campaign has been scheduled for ${draft.scheduling.startDate?.toLocaleDateString()}.`}
          </p>
        </div>
        <Button onClick={onReset} variant="outline">
          Back to Campaigns
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Summary */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Campaign Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Recipients Section */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" /> Recipients
                </h3>
                <div className="bg-muted/30 p-4 rounded-lg border">
                  {draft.recipientType === 'group' && draft.selectedGroup ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-lg">{draft.selectedGroup.name}</span>
                        <Badge>{draft.selectedGroup.type}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">{draft.selectedGroup.description}</p>
                      
                      {draft.selectedGroup.type === 'custom' && (
                        <Alert className="bg-blue-50 border-blue-200 mt-2">
                          <AlertTriangle className="h-4 w-4 text-blue-600" />
                          <AlertDescription className="text-blue-700 text-xs">
                            This is a custom group with {draft.selectedGroup.clientCount} recipients. 
                            Any changes to this group before the send date will automatically update the recipient list.
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  ) : (
                    <div>
                      <p className="font-medium text-lg">{draft.selectedRecipients.length} Client(s) Selected</p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {draft.selectedRecipients.slice(0, 5).map(c => (
                          <Badge key={c.id} variant="outline">{c.firstName} {c.surname}</Badge>
                        ))}
                        {draft.selectedRecipients.length > 5 && (
                          <Badge variant="outline">+{draft.selectedRecipients.length - 5} more</Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Email Content Section */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4" /> Message Details
                </h3>
                <div className="bg-muted/30 p-4 rounded-lg border space-y-3">
                  <div>
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Subject</span>
                    <p className="font-medium">{draft.subject}</p>
                  </div>
                  
                  <div>
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Attachments</span>
                    {draft.attachments.length > 0 ? (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {draft.attachments.map(f => (
                          <Badge key={f.id} variant="secondary" className="flex items-center gap-1">
                            <FileText className="h-3 w-3" /> {f.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">None</p>
                    )}
                  </div>

                  <div>
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Email Preview</span>
                    {/* Mini WYSIWYG preview matching the actual email template */}
                    <div className="mt-2 rounded-lg overflow-hidden border shadow-sm" style={{ backgroundColor: '#f3f4f6' }}>
                      <div style={{ padding: '16px 8px' }}>
                        <div style={{
                          maxWidth: '100%',
                          margin: '0 auto',
                          backgroundColor: '#ffffff',
                          borderRadius: '8px',
                          border: '1px solid #e5e7eb',
                          overflow: 'hidden',
                          fontFamily: 'Arial, sans-serif',
                        }}>
                          {/* Purple gradient accent */}
                          <div style={{ height: '3px', background: 'linear-gradient(90deg, #6d28d9, #a855f7, #6d28d9)' }} />
                          <div style={{ padding: '16px 20px', textAlign: 'center' }}>
                            <div style={{ marginBottom: '12px' }}>
                              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#000' }}>Navigate</span>
                              <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#6d28d9' }}>Wealth</span>
                            </div>
                            <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#111827', marginBottom: '12px' }}>
                              {draft.subject || 'Navigate Wealth'}
                            </div>
                            <div style={{ fontSize: '12px', color: '#374151', lineHeight: '1.5', textAlign: 'left' }}>
                              {draft.bodyHtml ? (
                                <div
                                  className="line-clamp-4"
                                  dangerouslySetInnerHTML={{
                                    __html: DOMPurify.sanitize(draft.bodyHtml)
                                  }}
                                />
                              ) : (
                                <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>No content...</p>
                              )}
                            </div>
                          </div>
                          <div style={{ padding: '8px 20px 12px', fontSize: '10px', color: '#9ca3af', textAlign: 'center', borderTop: '1px solid #e5e7eb' }}>
                            Navigate Wealth &middot; Independent Financial Advisory Services
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Scheduling & Actions */}
        <div className="space-y-6">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle>Sending Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <SchedulingOptions 
                config={draft.scheduling} 
                onChange={handleSchedulingChange} 
              />

              <Separator />

              <div className="space-y-4">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Estimated Recipients</span>
                  <span className="font-medium">
                    {draft.recipientType === 'group' 
                      ? draft.selectedGroup?.clientCount 
                      : draft.selectedRecipients.length}
                  </span>
                </div>
                
                <Button 
                  className="w-full h-12 text-lg font-semibold" 
                  size="lg"
                  onClick={handleSend}
                  disabled={isSending || (draft.scheduling.type === 'scheduled' && !draft.scheduling.startDate) || !canSend}
                >
                  {isSending ? (
                    <div className="contents">
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Processing...
                    </div>
                  ) : (
                    <span>
                      {draft.scheduling.type === 'immediate' ? 'Send Now' : 'Schedule Campaign'}
                    </span>
                  )}
                </Button>
                
                <Button variant="ghost" className="w-full" onClick={onBack}>
                  <ArrowLeft className="h-4 w-4 mr-2" /> Back to Edit
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}