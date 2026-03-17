import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Shield, Mail, Phone, ArrowRight, AlertCircle } from 'lucide-react';

interface MediaAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MediaAccessModal({ isOpen, onClose }: MediaAccessModalProps) {
  const handleContactClick = () => {
    // Close modal and redirect to contact page
    onClose();
    window.location.href = '/contact';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl bg-white">
        <DialogHeader className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-orange-100 flex items-center justify-center">
            <Shield className="h-8 w-8 text-orange-600" />
          </div>
          <DialogTitle className="text-2xl text-gray-900">
            Authorization Required
          </DialogTitle>
          <DialogDescription className="text-lg text-gray-600 leading-relaxed">
            Access to our media resources is restricted to authorized personnel only.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6">
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-orange-800 font-medium mb-1">
                Media Kit Access Restricted
              </p>
              <p className="text-orange-700 text-sm">
                Our brand assets, executive photos, and company materials are available to authorized media professionals, journalists, and business partners only.
              </p>
            </div>
          </div>

          <Card className="border-gray-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-gray-900 flex items-center">
                <Mail className="h-5 w-5 text-purple-600 mr-3" />
                Request Media Access
              </CardTitle>
              <CardDescription className="text-gray-600">
                Contact our media relations team to request access to our press resources.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="font-medium text-gray-900 mb-1">Email</p>
                  <p className="text-purple-600">media@navigatewealth.co</p>
                </div>
                <div>
                  <p className="font-medium text-gray-900 mb-1">Phone</p>
                  <p className="text-gray-600">(+27) 012-667-2505</p>
                </div>
              </div>
              
              <div className="pt-2 border-t border-gray-100">
                <p className="text-sm text-gray-500 mb-4">
                  Please include your organization, purpose for media materials, and specific assets needed in your request.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button 
                    onClick={handleContactClick}
                    className="bg-purple-600 hover:bg-purple-700 text-white flex-1"
                  >
                    Contact Media Team
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button 
                    onClick={onClose}
                    variant="outline" 
                    className="border-gray-200 text-gray-600 hover:bg-gray-50 flex-1"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-center">
            <p className="text-sm text-gray-500">
              Response time: Within 24 hours during business days
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
