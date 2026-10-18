import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Mail, ArrowRight, Newspaper } from 'lucide-react';
import { COMPANY } from '@/config/companyFacts';

interface MediaAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MediaAccessModal({ isOpen, onClose }: MediaAccessModalProps) {
  const mediaRequestHref = `mailto:${COMPANY.email}?subject=${encodeURIComponent('Media kit request')}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl bg-white">
        <DialogHeader className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-purple-100 flex items-center justify-center">
            <Newspaper className="h-8 w-8 text-purple-600" />
          </div>
          <DialogTitle className="text-2xl text-gray-900">Request Media Materials</DialogTitle>
          <DialogDescription className="text-lg text-gray-600 leading-relaxed">
            Our media materials are sent on request, so we know who is using them.
          </DialogDescription>
        </DialogHeader>

        <div className="py-6 space-y-6">
          <Card className="border-gray-200">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-gray-900 flex items-center">
                <Mail className="h-5 w-5 text-purple-600 mr-3" />
                How to Request
              </CardTitle>
              <CardDescription className="text-gray-600">
                Email us with your organisation and the materials you need: logo and brand
                guidelines, founder photos, or the company fact sheet.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <p className="font-medium text-gray-900 mb-1">Email</p>
                  <p className="text-purple-600">{COMPANY.email}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-900 mb-1">Phone</p>
                  <p className="text-gray-600">{COMPANY.phone.display}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <p className="text-sm text-gray-500 mb-4">
                  Please include your organization, purpose for media materials, and specific assets
                  needed in your request.
                </p>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button asChild className="bg-purple-600 hover:bg-purple-700 text-white flex-1">
                    <a href={mediaRequestHref}>
                      Email Your Request
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </a>
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
            <p className="text-sm text-gray-500">Response time: within 24 hours on business days</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
