import React from 'react';
import { Link, useNavigate } from 'react-router';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { 
  ArrowLeft, 
  Home,
  FileText,
  BookOpen,
  MessageCircle,
  ArrowRight
} from 'lucide-react';

export function NotFoundPage() {
  const navigate = useNavigate();

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const helpfulLinks = [
    {
      title: "Legal",
      description: "Dive in to learn all about our product.",
      icon: FileText,
      link: "/legal"
    },
    {
      title: "Chat to us on WhatsApp",
      description: "Read the latest posts on our blog.",
      icon: BookOpen,
      link: "/resources"
    },
    {
      title: "Resources",
      description: "Can't find what you're looking for?",
      icon: MessageCircle,
      link: "/resources"
    }
  ];

  return (
    <div className="min-h-screen section-white">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-20 lg:py-32">
        <div className="max-w-2xl mx-auto text-center">
          {/* 404 Error Badge */}
          <div className="mb-8">
            <Badge 
              variant="secondary" 
              className="bg-primary/10 text-primary border-primary/20 px-4 py-2 text-sm font-medium"
            >
              404 error
            </Badge>
          </div>

          {/* Main Heading */}
          <div className="space-y-4 mb-8">
            <h1 className="text-black">
              We can't find this page
            </h1>
            <p className="text-gray-600 max-w-lg mx-auto">
              The page you are looking for doesn't exist or has been moved.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Button 
              variant="outline" 
              size="lg"
              onClick={handleGoBack}
              className="border-gray-300 text-gray-700 hover:bg-gray-50 px-6"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go back
            </Button>
            <Button 
              size="lg" 
              className="bg-primary text-primary-foreground hover:bg-primary/90 px-6"
              asChild
            >
              <Link to="/">
                <Home className="mr-2 h-4 w-4" />
                Go home
              </Link>
            </Button>
          </div>

          {/* Helpful Links Section */}
          <div className="space-y-6">
            {helpfulLinks.map((item, index) => (
              <Card 
                key={index} 
                className="border border-gray-200 hover:shadow-md transition-all duration-200 group"
              >
                <CardContent className="p-6">
                  <Link 
                    to={item.link}
                    className="flex items-center justify-between text-left w-full group-hover:text-primary transition-colors"
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center group-hover:bg-primary/10 transition-colors">
                        <item.icon className="h-5 w-5 text-gray-600 group-hover:text-primary transition-colors" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-black text-lg font-medium group-hover:text-primary transition-colors">
                          {item.title}
                        </h3>
                        <p className="text-gray-600 text-sm">
                          {item.description}
                        </p>
                      </div>
                    </div>
                    <ArrowRight className="h-5 w-5 text-gray-400 group-hover:text-primary transition-colors" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Additional Help */}
          <div className="mt-12 pt-8 border-t border-gray-200">
            <p className="text-gray-600 text-sm">
              Still need help? Our team is here to assist you.{' '}
              <Link 
                to="/contact" 
                className="text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Contact us
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}