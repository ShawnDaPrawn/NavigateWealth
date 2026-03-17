import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../ui/card';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { Separator } from '../../../../ui/separator';
import { 
  AlertTriangle, 
  CheckCircle, 
  X, 
  Mail, 
  MessageSquare,
  Users,
  AlertCircle
} from 'lucide-react';
import { ValidationResult, CommunicationChannel } from '../types';

interface CommunicationValidationProps {
  validation: ValidationResult | null;
  channel: CommunicationChannel;
  onProceed: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function CommunicationValidation({
  validation,
  channel,
  onProceed,
  onCancel,
  isLoading = false,
}: CommunicationValidationProps) {
  if (!validation) return null;

  const { isValid, errors, warnings, eligibleRecipients, ineligibleRecipients } = validation;
  
  const hasIssues = errors.length > 0 || warnings.length > 0 || ineligibleRecipients.length > 0;
  
  if (!hasIssues && isValid) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-3">
            <CheckCircle className="h-6 w-6 text-green-600" />
            <div>
              <h3 className="font-medium text-green-900">Ready to Send</h3>
              <p className="text-sm text-green-700">
                All {eligibleRecipients.length} recipients are eligible for {channel} communication
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-900">
          <AlertTriangle className="h-5 w-5" />
          Communication Validation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Errors */}
        {errors.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-red-900 flex items-center gap-2">
              <X className="h-4 w-4" />
              Errors (Must be fixed before sending)
            </h4>
            <div className="space-y-1">
              {errors.map((error, index) => (
                <div key={index} className="text-sm text-red-700 p-2 bg-red-100 rounded">
                  {error}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-orange-900 flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              Warnings
            </h4>
            <div className="space-y-1">
              {warnings.map((warning, index) => (
                <div key={index} className="text-sm text-orange-700 p-2 bg-orange-100 rounded">
                  {warning}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recipients Summary */}
        <div className="space-y-3">
          <h4 className="font-medium text-orange-900">Recipients Summary</h4>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Eligible Recipients */}
            {eligibleRecipients.length > 0 && (
              <div className="p-3 bg-green-100 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-green-900">
                    Eligible ({eligibleRecipients.length})
                  </span>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {eligibleRecipients.slice(0, 5).map((client) => (
                    <div key={client.id} className="text-sm text-green-700 flex items-center gap-2">
                      {channel === 'email' ? (
                        <Mail className="h-3 w-3" />
                      ) : (
                        <MessageSquare className="h-3 w-3" />
                      )}
                      {client.firstName} {client.surname}
                    </div>
                  ))}
                  {eligibleRecipients.length > 5 && (
                    <div className="text-xs text-green-600">
                      +{eligibleRecipients.length - 5} more...
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Ineligible Recipients */}
            {ineligibleRecipients.length > 0 && (
              <div className="p-3 bg-red-100 border border-red-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                  <span className="font-medium text-red-900">
                    Ineligible ({ineligibleRecipients.length})
                  </span>
                </div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {ineligibleRecipients.slice(0, 5).map(({ client, reason }, index) => (
                    <div key={index} className="text-sm text-red-700">
                      <div className="font-medium">{client.firstName} {client.surname}</div>
                      <div className="text-xs text-red-600">{reason}</div>
                    </div>
                  ))}
                  {ineligibleRecipients.length > 5 && (
                    <div className="text-xs text-red-600">
                      +{ineligibleRecipients.length - 5} more...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Compliance Notice */}
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <span className="font-medium text-blue-900">Compliance Notice</span>
          </div>
          <div className="text-sm text-blue-700 space-y-1">
            <p>• Only clients who have opted in to {channel} communications will receive this message</p>
            <p>• This communication will be logged in each recipient's activity timeline</p>
            <p>• All communications are subject to FAIS and POPI Act compliance requirements</p>
          </div>
        </div>

        <Separator />

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {eligibleRecipients.length > 0 ? (
              <div className="contents">
                Proceeding will send to <strong>{eligibleRecipients.length}</strong> eligible recipient{eligibleRecipients.length > 1 ? 's' : ''}
                {ineligibleRecipients.length > 0 && (
                  <span> and exclude <strong>{ineligibleRecipients.length}</strong> ineligible recipient{ineligibleRecipients.length > 1 ? 's' : ''}</span>
                )}
              </div>
            ) : (
              'No eligible recipients found'
            )}
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button
              onClick={onProceed}
              disabled={!isValid || errors.length > 0 || eligibleRecipients.length === 0 || isLoading}
              className="flex items-center gap-2"
            >
              {isLoading ? (
                <div className="contents">
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent" />
                  Sending...
                </div>
              ) : (
                <div className="contents">
                  {channel === 'email' ? (
                    <Mail className="h-4 w-4" />
                  ) : (
                    <MessageSquare className="h-4 w-4" />
                  )}
                  Send to {eligibleRecipients.length} Recipients
                </div>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}