import React, { useState } from 'react';
import { Link } from 'react-router';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { toast } from 'sonner@2.0.3';
import { 
  MapPin, 
  Phone, 
  Mail, 
  Linkedin, 
  ArrowRight,
  Code,
  Youtube,
  Instagram
} from 'lucide-react';
import { Logo } from './Logo';
import { projectId, publicAnonKey } from '../../utils/supabase/info';

export function Footer() {
  const currentYear = new Date().getFullYear();
  const [email, setEmail] = useState('');
  const [isSubscribing, setIsSubscribing] = useState(false);

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error('Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address');
      return;
    }

    setIsSubscribing(true);
    
    try {
      // Call the newsletter subscription endpoint
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/newsletter/subscribe`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          },
          body: JSON.stringify({ email })
        }
      );
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Subscription failed');
      }
      
      if (data.alreadySubscribed) {
        toast.info('Already subscribed', {
          description: 'You\'re already on our mailing list. We\'ll keep sending you great content!'
        });
      } else if (data.requiresConfirmation) {
        // Show success notification for double opt-in
        toast.success('Check your email!', {
          description: 'We\'ve sent you a confirmation link. Please click it to complete your subscription.',
          duration: 6000
        });
      } else {
        // Show success notification
        toast.success('Successfully subscribed!', {
          description: 'Thank you for subscribing to our newsletter.'
        });
      }
      
      // Reset form
      setEmail('');
    } catch (error) {
      console.error('Newsletter subscription error:', error);
      toast.error('Subscription failed', {
        description: error instanceof Error ? error.message : 'Something went wrong. Please try again.'
      });
    } finally {
      setIsSubscribing(false);
    }
  };

  const footerLinks = {
    company: [
      { label: 'About Us', path: '/about' },
      { label: 'Why Us?', path: '/why-us' },
      { label: 'Careers', path: '/careers' },
      { label: 'Press', path: '/press' }
    ],
    servicesColumn1: [
      { label: 'Risk Management', path: '/risk-management' },
      { label: 'Medical Aid', path: '/medical-aid' },
      { label: 'Retirement Planning', path: '/retirement-planning' },
      { label: 'Investment Management', path: '/investment-management' }
    ],
    servicesColumn2: [
      { label: 'Employee Benefits', path: '/employee-benefits' },
      { label: 'Tax Planning', path: '/tax-planning' },
      { label: 'Estate Planning', path: '/estate-planning' },
      { label: 'Financial Planning', path: '/financial-planning' }
    ],
    resources: [
      { label: 'Insights', path: '/resources' },
      { label: 'Sitemap', path: '/sitemap' },
      { label: 'Market Updates', path: '/resources' },
      { label: 'Design System', path: '/design-system' }
    ],
    legal: [
      { label: 'Privacy and Data', path: '/legal?section=privacy-data-protection' },
      { label: 'Legal Notices', path: '/legal?section=legal-notices' },
      { label: 'Regulatory', path: '/legal?section=regulatory-disclosures' },
      { label: 'Other', path: '/legal?section=other' }
    ]
  };

  return (
    <footer className="bg-black text-white">
      {/* Main Footer Content */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 pt-16 pb-8">
        <div className="grid lg:grid-cols-4 gap-12">
          {/* Company Info */}
          <div className="lg:col-span-1 space-y-6">
            <div className="flex items-center">
              <Logo variant="light" className="h-10" />
            </div>          
                           <div className="space-y-3">
              <div className="flex items-center space-x-3 text-gray-300">
                <MapPin className="h-8 w-8 text-primary" />
                <span className="text-sm">Milestone Place Block A, 25 Sovereign Dr Route 21 Business Park, Pretoria, 0178</span>
              </div>
              <div className="flex items-center space-x-3 text-gray-300">
                <Phone className="h-5 w-5 text-primary" />
                <span className="text-sm">(+27) 12-667-2505</span>
              </div>
              <div className="flex items-center space-x-3 text-gray-300">
                <Mail className="h-5 w-5 text-primary" />
                <span className="text-sm">info@navigatewealth.co</span>
              </div>
            </div>
          </div>

          {/* Links Sections */}
          <div className="lg:col-span-3">
            <div className="grid md:grid-cols-5 gap-8">
              <div>
                <h3 className="font-semibold mb-4">Company</h3>
                <ul className="space-y-3">
                  {footerLinks.company.map((link, index) => (
                    <li key={index}>
                      <Link 
                        to={link.path} 
                        className="text-gray-300 hover:text-purple-400 transition-colors text-sm"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Services Section - Combined on mobile, split on desktop */}
              <div className="md:col-span-2 md:grid md:grid-cols-2">
                <div>
                  <h3 className="font-semibold mb-4">Services</h3>
                  <ul className="space-y-3">
                    {footerLinks.servicesColumn1.map((link, index) => (
                      <li key={index}>
                        <Link 
                          to={link.path} 
                          className="text-gray-300 hover:text-purple-400 transition-colors text-sm"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                    {/* Show second column on mobile only - inline with first column */}
                    {footerLinks.servicesColumn2.map((link, index) => (
                      <li key={index} className="md:hidden">
                        <Link 
                          to={link.path} 
                          className="text-gray-300 hover:text-purple-400 transition-colors text-sm"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
                {/* Second column - desktop only */}
                <div className="hidden md:block">
                  <ul className="space-y-3 mt-10">
                    {footerLinks.servicesColumn2.map((link, index) => (
                      <li key={index}>
                        <Link 
                          to={link.path} 
                          className="text-gray-300 hover:text-purple-400 transition-colors text-sm"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div>
                <h3 className="font-semibold mb-4">Resources</h3>
                <ul className="space-y-3">
                  {footerLinks.resources.map((link, index) => (
                    <li key={index}>
                      <Link 
                        to={link.path} 
                        className="text-gray-300 hover:text-purple-400 transition-colors text-sm"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-4">Legal</h3>
                <ul className="space-y-3">
                  {footerLinks.legal.map((link, index) => (
                    <li key={index}>
                      <Link 
                        to={link.path} 
                        className="text-gray-300 hover:text-purple-400 transition-colors text-sm"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Newsletter Signup */}
        <div className="mt-12 pt-8 border-t border-gray-800">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <h3 className="text-xl font-semibold mb-2">Stay Connected</h3>
              <p className="text-gray-300">
                Get the latest market insights and financial tips delivered to your inbox.
              </p>
            </div>
            <form onSubmit={handleNewsletterSubmit} className="flex flex-col sm:flex-row gap-3">
              <input 
                type="email" 
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isSubscribing}
                className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <Button 
                type="submit"
                disabled={isSubscribing}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubscribing ? 'Subscribing...' : 'Subscribe'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>

        <Separator className="my-8 bg-gray-800" />

        {/* Bottom Footer */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-gray-400 text-sm">
            <p>© {currentYear} Navigate Wealth. All rights reserved.</p>
                      </div>
          
          <div className="flex space-x-4">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-gray-400 hover:text-purple-400 hover:bg-primary/10"
              asChild
            >
              <a 
                href="https://www.linkedin.com/company/navigatewealth/" 
                target="_blank" 
                rel="noopener noreferrer"
                aria-label="LinkedIn"
              >
                <Linkedin className="h-5 w-5" />
              </a>
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-gray-400 hover:text-purple-400 hover:bg-primary/10"
              asChild
            >
              <a 
                href="https://www.instagram.com/navigate_wealth?igsh=MTh6bTc2emszbXU0MA==" 
                target="_blank" 
                rel="noopener noreferrer"
                aria-label="Instagram"
              >
                <Instagram className="h-5 w-5" />
              </a>
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-gray-400 hover:text-purple-400 hover:bg-primary/10"
              asChild
            >
              <a 
                href="https://www.youtube.com/@navigatewealth" 
                target="_blank" 
                rel="noopener noreferrer"
                aria-label="YouTube"
              >
                <Youtube className="h-5 w-5" />
              </a>
            </Button>
          </div>
        </div>

        {/* Compliance Disclaimer */}
        <div className="mt-8 pt-6 border-t border-gray-800">
          <p className="text-xs text-gray-500 leading-relaxed">
            <strong>Important Disclosure:</strong> Wealthfront (Pty) Ltd (Reg No. 2024/071953/07), trading as "Navigate Wealth," is a South African financial advisory firm and an authorised Financial Services Provider (FSP No. 54606). The information on this website is for general informational purposes only and does not constitute financial, investment, tax, legal, or other professional advice. While we strive to ensure that the information is accurate and up to date, we make no warranties of any kind regarding its completeness or reliability. Any reliance you place on such information is strictly at your own risk. Past performance is not necessarily indicative of future results. Before making any financial decision, you should consider your personal circumstances and, where appropriate, seek professional advice. Navigate Wealth will not be liable for any losses or damages arising from the use of this website or any reliance on the information provided herein. For tailored advice, please contact our qualified advisor/s directly. Full terms and conditions are available upon request.
          </p>
        </div>
      </div>
    </footer>
  );
}
