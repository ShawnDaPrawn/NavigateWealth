import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  CheckCircle2,
  Phone,
  Mail,
  Clock,
  Calendar,
  ArrowRight,
  Star,
  Shield
} from 'lucide-react';
import exampleImage from 'figma:asset/dbeb61494c13e4289499d3be7c162dbc9fb1c3bb.png';

interface ThankYouModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName?: string;
}

export function ThankYouModal({ open, onOpenChange, clientName }: ThankYouModalProps) {
  const firstName = clientName ? clientName.split(' ')[0] : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-2xl md:max-w-4xl lg:max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="text-center space-y-6 pb-6">
          {/* Success Badge */}
          <div className="flex justify-center">
            <Badge className="bg-green-100 text-green-800 border-green-200 px-4 py-2">
              Request Submitted Successfully
            </Badge>
          </div>

          {/* Success Icon */}
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
          </div>

          {/* Main Title */}
          <div>
            <DialogTitle className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Thank You{firstName && `, ${firstName}`}!
            </DialogTitle>
            <DialogDescription className="text-lg text-gray-600 leading-relaxed max-w-2xl mx-auto text-center">
              Your request has been received and one of our qualified financial advisers will contact you shortly to discuss your risk management needs.
            </DialogDescription>
          </div>
        </DialogHeader>

        {/* Main Content */}
        <div className="space-y-8">
          {/* What Happens Next Section */}
          <div className="bg-gradient-to-br from-primary/5 to-purple-50 rounded-xl p-8 border border-primary/10">
            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
              <Calendar className="h-5 w-5 text-primary mr-2" />
              What Happens Next?
            </h3>
            
            <div className="space-y-4">
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-primary font-bold text-sm">1</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Initial Contact</h4>
                  <p className="text-gray-600 text-sm">Our team will call you within 24 hours to acknowledge your request and schedule a convenient consultation time.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-primary font-bold text-sm">2</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Needs Assessment</h4>
                  <p className="text-gray-600 text-sm">We'll conduct a comprehensive review of your financial situation and risk management requirements.</p>
                </div>
              </div>
              
              <div className="flex items-start space-x-4">
                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-primary font-bold text-sm">3</span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 mb-1">Tailored Solutions</h4>
                  <p className="text-gray-600 text-sm">Receive personalized recommendations from South Africa's leading insurance providers that match your specific needs and budget.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <Phone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Direct Contact</h4>
                  <p className="text-sm text-gray-600">Speak to our team immediately</p>
                </div>
              </div>
              <p className="text-primary font-semibold mb-2">+27 (0)12 667 2505</p>
              <p className="text-xs text-gray-500">Available Monday - Friday, 8:00 AM - 5:00 PM</p>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                  <Mail className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Email Support</h4>
                  <p className="text-sm text-gray-600">Send us additional information</p>
                </div>
              </div>
              <p className="text-primary font-semibold mb-2">info@navigatewealth.co</p>
              <p className="text-xs text-gray-500">We respond within 4 hours during business days</p>
            </div>
          </div>

          {/* Trust Indicators */}
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="grid md:grid-cols-3 gap-4 text-center">
              <div className="flex flex-col items-center space-y-2">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">No Cost</p>
                  <p className="text-xs text-gray-600">Free consultation & quote</p>
                </div>
              </div>
              
              <div className="flex flex-col items-center space-y-2">
                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                  <Shield className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">FSCA Authorised</p>
                  <p className="text-xs text-gray-600">Regulated financial advisers</p>
                </div>
              </div>
              
              <div className="flex flex-col items-center space-y-2">
                <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Star className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Expert Advice</p>
                  <p className="text-xs text-gray-600">Qualified professionals</p>
                </div>
              </div>
            </div>
          </div>

          {/* Response Time Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Clock className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-blue-900 mb-1">Expected Response Time</h4>
                <p className="text-sm text-blue-800">
                  Our advisers typically contact new clients within <strong>24 hours</strong> during business days. 
                  For urgent matters, please call us directly at the number provided above.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4 border-t border-gray-100">
            <Button 
              onClick={() => onOpenChange(false)}
              className="bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105 transform transition-all duration-200 px-8 shadow-lg hover:shadow-xl group"
            >
              <CheckCircle2 className="mr-2 h-5 w-5 group-hover:rotate-12 transition-transform duration-200" />
              Close
            </Button>
            
            <Button 
              variant="outline" 
              onClick={() => {
                onOpenChange(false);
                // Scroll to top or navigate to another section if needed
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="border-primary text-primary hover:bg-primary/10 hover:border-primary/80 hover:scale-105 transform transition-all duration-200 px-8 shadow-lg hover:shadow-xl group"
            >
              Browse Services
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform duration-200" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
