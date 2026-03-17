import React from 'react';
import { Link } from 'react-router';
import { Phone, MessageCircle, Mail, Clock, FileText } from 'lucide-react';
import { Button } from '../ui/button';

export function TopBar() {
  return (
    <div className="bg-gray-200 border-b border-gray-300/60 text-sm">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
        <div className="flex items-center justify-between h-10">
          {/* Left side - Business hours */}
          <div className="flex items-center space-x-2 text-gray-700">
            <div className="flex items-center space-x-1.5 bg-white/70 px-3 py-1.5 rounded-md shadow-sm border border-gray-300/50">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Mon - Friday 08:00am - 16:30pm</span>
            </div>
          </div>
          
          {/* Right side - Contact links and Get Quote button */}
          <div className="flex items-center space-x-3">
            {/* Contact Information */}
            <div className="hidden lg:flex items-center space-x-4 bg-white/70 px-4 py-1.5 rounded-md shadow-sm border border-gray-300/50">
              <a 
                href="tel:012-667-2505" 
                className="flex items-center space-x-1.5 text-gray-700 hover:text-primary transition-all duration-200"
              >
                <Phone className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">012-667-2505</span>
              </a>
              
              <div className="w-px h-4 bg-gray-300"></div>
              
              <a 
                href="mailto:enquiries@navigatewealth.co" 
                className="flex items-center space-x-1.5 text-gray-700 hover:text-primary transition-all duration-200"
              >
                <Mail className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">info@navigatewealth.co</span>
              </a>
              
              <div className="w-px h-4 bg-gray-300"></div>
              
              <a 
                href="https://wa.me/message/BOLRR5DSCWNAG1" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center space-x-1.5 text-gray-700 hover:text-green-600 transition-all duration-200"
              >
                <MessageCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-semibold">WhatsApp</span>
              </a>
              
              <div className="w-px h-4 bg-gray-300"></div>
              
              <Link 
                to="/get-quote"
                className="flex items-center space-x-1.5 text-gray-700 hover:text-cyan-600 transition-all duration-200"
              >
                <FileText className="h-4 w-4 text-cyan-600" />
                <span className="text-sm font-semibold">Get Quote</span>
              </Link>
            </div>

            {/* Mobile contact - simplified */}
            <div className="flex lg:hidden items-center space-x-2">
              <a 
                href="tel:012-667-2505" 
                className="flex items-center justify-center w-8 h-8 bg-white/75 rounded-md shadow-sm border border-gray-300/50 text-primary hover:bg-primary hover:text-white transition-all duration-200"
              >
                <Phone className="h-4 w-4" />
              </a>
              
              <a 
                href="https://wa.me/message/BOLRR5DSCWNAG1" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-center w-8 h-8 bg-white/75 rounded-md shadow-sm border border-gray-300/50 text-green-600 hover:bg-green-600 hover:text-white transition-all duration-200"
              >
                <MessageCircle className="h-4 w-4" />
              </a>
              
              <Link 
                to="/get-quote"
                className="flex items-center justify-center w-8 h-8 bg-white/75 rounded-md shadow-sm border border-gray-300/50 text-cyan-600 hover:bg-cyan-600 hover:text-white transition-all duration-200"
              >
                <FileText className="h-4 w-4" />
              </Link>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
