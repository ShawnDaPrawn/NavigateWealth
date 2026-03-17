import React from 'react';
import { Button } from '../../../../../ui/button';
import { Checkbox } from '../../../../../ui/checkbox';
import { Switch } from '../../../../../ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../../ui/card';
import { Shield, Upload, FileText, ExternalLink } from 'lucide-react';
import { Personnel } from '../../types';

interface TabComplianceProps {
  selectedPersonnel: Personnel;
  onUpload: (type: string) => void;
}

export function TabCompliance({ selectedPersonnel, onUpload }: TabComplianceProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Shield className="h-5 w-5 text-purple-600" />
          Fit & Proper Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
          <div>
            <div className="font-medium">FSP Representative Status</div>
            <div className="text-sm text-muted-foreground">Is this user authorized to give advice?</div>
          </div>
          <Switch checked={selectedPersonnel.fscaStatus === 'active'} />
        </div>

        <div className="space-y-4">
          <h4 className="font-medium text-sm">Required Qualifications</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center justify-between border p-3 rounded">
              <span className="text-sm">RE5 Certificate</span>
              <Checkbox checked={selectedPersonnel.qualifications?.re5} />
            </div>
            <div className="flex items-center justify-between border p-3 rounded">
              <span className="text-sm">CFP® Designation</span>
              <Checkbox checked={selectedPersonnel.qualifications?.cfp} />
            </div>
            <div className="flex items-center justify-between border p-3 rounded">
              <span className="text-sm">Class of Business</span>
              <Checkbox checked={selectedPersonnel.qualifications?.cob} />
            </div>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
              <h4 className="font-medium text-sm">Compliance Documents</h4>
              <Button size="sm" variant="outline" onClick={() => onUpload('qualification')}>
                  <Upload className="h-3 w-3 mr-2" /> Upload
              </Button>
          </div>
          
          {/* Document List */}
          <div className="space-y-2">
              {selectedPersonnel.documents?.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 border rounded bg-slate-50">
                      <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-500" />
                          <span className="text-sm font-medium">{doc.name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                          <Button variant="ghost" size="icon" className="h-6 w-6" aria-label={`Open document ${doc.name}`}>
                              <ExternalLink className="h-3 w-3" />
                          </Button>
                      </div>
                  </div>
              ))}
              {(!selectedPersonnel.documents?.length) && (
                  <div className="text-sm text-muted-foreground italic">No documents uploaded</div>
              )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}