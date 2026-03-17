import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Switch } from '../ui/switch';
import { Checkbox } from '../ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { toast } from 'sonner@2.0.3';
import { Loader2, CheckCircle2, Calendar, Mail, Phone, MapPin } from 'lucide-react';
import { projectId, publicAnonKey } from '../../utils/supabase/info';
import { Logo } from '../layout/Logo';
import { Badge } from '../ui/badge';
import { InteractiveFormRenderer } from '../admin/modules/resources/builder/InteractiveFormRenderer';
import { PageLoader } from '../ui/page-loader';

// Minimal type definitions for request completion (module has been deleted)
interface RequestInstance {
  id: string;
  templateName: string;
  recipientEmail: string;
  status: string;
  fields: TemplateField[];
  blocks?: Array<{
    id: string;
    type: string;
    data: { fields?: Array<{ key?: string; label: string; required?: boolean }> };
  }>;
}

interface TemplateField {
  id: string;
  label: string;
  description?: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  options?: string[];
}

export function RequestCompletionPage() {
  const { id } = useParams<{ id: string }>();
  const [request, setRequest] = useState<RequestInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchRequest(id);
  }, [id]);

  const fetchRequest = async (requestId: string) => {
    try {
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/requests/${requestId}`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` }
      });
      if (!res.ok) throw new Error('Request not found');
      const data = await res.json();
      setRequest(data.request);
      if (data.request.status === 'Pending' || data.request.status === 'Finalised') {
         setSubmitted(true);
      }
    } catch (err) {
      setError('Failed to load request. It may check have been deleted or does not exist.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!request) return;
    
    // Validate required fields
    let missingFields: string[] = [];
    
    if (request.blocks && request.blocks.length > 0) {
        // Validate blocks
        request.blocks.forEach(block => {
            if (block.type === 'field_grid' && block.data.fields) {
                block.data.fields.forEach((field: { key?: string; label: string; required?: boolean }, idx: number) => {
                    const key = field.key || `field_${block.id}_${idx}`;
                    if (field.required && !responses[key]) {
                        missingFields.push(field.label);
                    }
                });
            }
        });
    } else {
        // Validate legacy fields
        missingFields = request.fields.filter(f => f.required && !responses[f.id]).map(f => f.label);
    }

    if (missingFields.length > 0) {
      toast.error(`Please fill in all required fields: ${missingFields.join(', ')}`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/requests/${request.id}/submit`, {
        method: 'POST',
        headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}` 
        },
        body: JSON.stringify({ responses })
      });
      
      if (!res.ok) throw new Error('Failed to submit');
      
      setSubmitted(true);
      toast.success('Form submitted successfully!');
    } catch (err) {
      toast.error('Failed to submit form. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: TemplateField) => {
    // ... Legacy render logic ...
    const value = responses[field.id];
    const handleChange = (val: string | number | boolean) => setResponses(prev => ({ ...prev, [field.id]: val }));

    switch (field.type) {
      case 'text':
      case 'email':
      case 'phone':
        return <Input value={value || ''} onChange={e => handleChange(e.target.value)} placeholder={field.placeholder} />;
      case 'number':
        return <Input type="number" value={value || ''} onChange={e => handleChange(e.target.value)} placeholder={field.placeholder} />;
      case 'textarea':
        return <Textarea value={value || ''} onChange={e => handleChange(e.target.value)} placeholder={field.placeholder} />;
      case 'select':
        return (
          <Select value={value} onValueChange={handleChange}>
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              {field.options?.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
            </SelectContent>
          </Select>
        );
      case 'radio':
        return (
          <RadioGroup value={value} onValueChange={handleChange}>
            {field.options?.map(opt => (
              <div key={opt} className="flex items-center space-x-2">
                <RadioGroupItem value={opt} id={`${field.id}-${opt}`} />
                <Label htmlFor={`${field.id}-${opt}`}>{opt}</Label>
              </div>
            ))}
          </RadioGroup>
        );
      case 'checkbox':
        return (
           <div className="space-y-2">
             {field.options?.map(opt => (
               <div key={opt} className="flex items-center space-x-2">
                 <Checkbox 
                   id={`${field.id}-${opt}`} 
                   checked={Array.isArray(value) && value.includes(opt)}
                   onCheckedChange={(checked) => {
                     const current = Array.isArray(value) ? value : [];
                     if (checked) handleChange([...current, opt]);
                     else handleChange(current.filter((v: string) => v !== opt));
                   }}
                 />
                 <Label htmlFor={`${field.id}-${opt}`}>{opt}</Label>
               </div>
             ))}
           </div>
        );
      case 'toggle':
        return <Switch checked={!!value} onCheckedChange={handleChange} />;
      case 'date':
        return <Input type="date" value={value || ''} onChange={e => handleChange(e.target.value)} />;
      case 'header':
        return <h3 className="text-lg font-semibold mt-6 mb-2 border-b pb-1">{field.label}</h3>;
      case 'paragraph':
        return <p className="text-muted-foreground mb-4">{field.description}</p>;
      default:
        return null;
    }
  };

  if (loading) {
    return <PageLoader />;
  }

  if (error || !request) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
        <Card className="w-full max-w-md">
           <CardHeader>
             <CardTitle className="text-destructive">Error</CardTitle>
             <CardDescription>{error || 'Request not found'}</CardDescription>
           </CardHeader>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
        <Card className="w-full max-w-md text-center">
           <CardHeader>
             <div className="mx-auto bg-green-100 p-3 rounded-full mb-4">
               <CheckCircle2 className="h-8 w-8 text-green-600" />
             </div>
             <CardTitle>Thank You!</CardTitle>
             <CardDescription>Your response has been successfully submitted.</CardDescription>
           </CardHeader>
           <CardContent>
             <p className="text-sm text-muted-foreground">We have notified the team and will review your information shortly.</p>
           </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        {/* PDF-style Document */}
        <div className="bg-white shadow-lg rounded-sm border border-gray-200" style={{ 
          minHeight: '842px',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          {/* Document Header with Logo and Company Details */}
          <div className="border-b border-gray-200 px-12 py-8">
            <div className="flex items-start justify-between mb-6">
              <Logo variant="default" />
              <div className="text-right text-xs text-gray-600 space-y-1">
                <div className="flex items-center justify-end gap-1">
                  <MapPin className="h-3 w-3" />
                  <span>Cape Town, South Africa</span>
                </div>
                <div className="flex items-center justify-end gap-1">
                  <Phone className="h-3 w-3" />
                  <span>+27 (0) 21 123 4567</span>
                </div>
                <div className="flex items-center justify-end gap-1">
                  <Mail className="h-3 w-3" />
                  <span>info@navigatewealth.co.za</span>
                </div>
              </div>
            </div>
            
            {/* Document Title */}
            <div className="mt-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {request.templateName}
              </h1>
              <p className="text-sm text-gray-600">
                Requested for: <span className="font-medium">{request.recipientEmail}</span>
              </p>
            </div>

            {/* Date Reference */}
            <div className="mt-4 flex items-center text-xs text-gray-500">
              <Calendar className="h-3 w-3 mr-1" />
              <span>Document Date: {new Date().toLocaleDateString('en-ZA', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
          </div>

          {/* Form Content */}
          <div className="px-12 py-8">
            {request.blocks && request.blocks.length > 0 ? (
                // --- NEW BLOCK RENDERER ---
                <InteractiveFormRenderer 
                    blocks={request.blocks}
                    responses={responses}
                    onChange={(key, val) => setResponses(prev => ({ ...prev, [key]: val }))}
                />
            ) : (
                // --- LEGACY FIELD RENDERER ---
                <div className="space-y-6">
                {request.fields.map((field) => {
                    // Headers and paragraphs don't need the standard field wrapper
                    if (field.type === 'header') {
                    return (
                        <div key={field.id} className="pt-4 pb-2 border-b-2 border-primary/20">
                        <h3 className="text-lg font-semibold text-gray-900">{field.label}</h3>
                        </div>
                    );
                    }
                    
                    if (field.type === 'paragraph') {
                    return (
                        <div key={field.id} className="py-2">
                        <p className="text-sm text-gray-600 leading-relaxed">{field.description}</p>
                        </div>
                    );
                    }
                    
                    return (
                    <div key={field.id} className="space-y-2">
                        <div className="flex items-center gap-2">
                        <Label className="text-sm font-medium text-gray-700">
                            {field.label}
                            {field.required && (
                            <span className="text-red-500 ml-1">*</span>
                            )}
                        </Label>
                        {field.required && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Required</Badge>
                        )}
                        </div>
                        {field.description && (
                        <p className="text-xs text-gray-500 leading-relaxed">{field.description}</p>
                        )}
                        <div className="pt-1">
                        {renderField(field)}
                        </div>
                    </div>
                    );
                })}
                </div>
            )}
          </div>

          {/* Document Footer with Submit Button */}
          <div className="border-t border-gray-200 px-12 py-6 mt-8 bg-gray-50">
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={handleSubmit} disabled={submitting} size="lg">
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Submit Response
                </Button>
              </div>
              <div className="text-xs text-gray-600">
                <p className="font-semibold mb-2">Important Information:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-500">
                  <li>Please complete all required fields marked with an asterisk (*)</li>
                  <li>All information provided will be treated as confidential</li>
                  <li>For assistance, please contact us at info@navigatewealth.co.za</li>
                </ul>
              </div>
              <div className="text-xs text-gray-400 pt-2 border-t border-gray-200">
                <p>Navigate Wealth Financial Services (Pty) Ltd | Authorized FSP</p>
                <p className="mt-1">This document is for information purposes only and does not constitute financial advice.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}