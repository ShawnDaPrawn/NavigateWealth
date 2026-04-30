import React, { useEffect } from 'react';
import { Link } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { 
  Home, 
  Shield, 
  Building, 
  Users, 
  FileText, 
  Phone, 
  Settings, 
  PieChart,
  TrendingUp,
  Calculator,
  BookOpen,
  Clock,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

interface SitemapLink {
  title: string;
  path: string;
  description: string;
  lastModified?: string;
  priority?: 'high' | 'medium' | 'low';
  status?: 'public' | 'auth-required' | 'flexible';
}

interface SitemapSection {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  links: SitemapLink[];
}

export function SitemapPage() {
  useEffect(() => {
    // Set document title for SEO
    document.title = 'Sitemap - Navigate Wealth | Complete Site Navigation';
    
    // Add meta description for SEO
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
      metaDescription.setAttribute('content', 
        'Complete sitemap of Navigate Wealth website. Find all pages, services, resources, and tools for wealth management, financial planning, and investment services in South Africa.'
      );
    } else {
      const meta = document.createElement('meta');
      meta.name = 'description';
      meta.content = 'Complete sitemap of Navigate Wealth website. Find all pages, services, resources, and tools for wealth management, financial planning, and investment services in South Africa.';
      document.head.appendChild(meta);
    }

    // Add structured data for SEO
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "WebPage",
      "name": "Navigate Wealth Sitemap",
      "description": "Complete navigation guide to all Navigate Wealth services, resources, and pages",
      "url": window.location.origin + "/sitemap",
      "mainEntity": {
        "@type": "SiteNavigationElement",
        "name": "Navigate Wealth Site Navigation"
      },
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          {
            "@type": "ListItem",
            "position": 1,
            "name": "Home",
            "item": window.location.origin
          },
          {
            "@type": "ListItem",
            "position": 2,
            "name": "Sitemap",
            "item": window.location.origin + "/sitemap"
          }
        ]
      }
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(structuredData);
    document.head.appendChild(script);

    return () => {
      // Cleanup on unmount
      const existingScript = document.querySelector('script[type="application/ld+json"]');
      if (existingScript) {
        document.head.removeChild(existingScript);
      }
    };
  }, []);

  const sitemapSections: SitemapSection[] = [
    {
      title: "Main Navigation",
      icon: Home,
      description: "Primary website pages and core navigation",
      links: [
        {
          title: "Home",
          path: "/",
          description: "Welcome to Navigate Wealth - Your trusted financial partner",
          lastModified: "2024-01-15",
          priority: "high",
          status: "public"
        },
        {
          title: "About Us",
          path: "/about",
          description: "Learn about our mission, values, and commitment to your financial success",
          lastModified: "2024-01-14",
          priority: "high",
          status: "public"
        },
        {
          title: "Our Services",
          path: "/services",
          description: "Comprehensive overview of our wealth management and financial planning services",
          lastModified: "2024-01-15",
          priority: "high",
          status: "public"
        },
        {
          title: "Our Team",
          path: "/team",
          description: "Meet our experienced financial advisors and wealth management professionals",
          lastModified: "2024-01-10",
          priority: "medium",
          status: "public"
        },
        {
          title: "Contact Us",
          path: "/contact",
          description: "Get in touch with our team for personalized financial advice",
          lastModified: "2024-01-12",
          priority: "high",
          status: "public"
        },
        {
          title: "Get Quote",
          path: "/get-quote",
          description: "Request a personalized quote for our financial services",
          lastModified: "2024-01-14",
          priority: "high",
          status: "flexible"
        }
      ]
    },
    {
      title: "Financial Services",
      icon: Shield,
      description: "Specialized financial planning and wealth management services",
      links: [
        {
          title: "Risk Management",
          path: "/risk-management",
          description: "Comprehensive risk assessment and mitigation strategies for your financial portfolio",
          lastModified: "2024-01-15",
          priority: "high",
          status: "flexible"
        },
        {
          title: "Retirement Planning",
          path: "/retirement-planning",
          description: "Strategic retirement planning to secure your financial future",
          lastModified: "2024-01-14",
          priority: "high",
          status: "flexible"
        },
        {
          title: "Investment Management",
          path: "/investment-management",
          description: "Professional investment portfolio management and advisory services",
          lastModified: "2024-01-15",
          priority: "high",
          status: "flexible"
        },
        {
          title: "Tax Planning",
          path: "/tax-planning",
          description: "Strategic tax planning and optimization services",
          lastModified: "2024-01-13",
          priority: "high",
          status: "flexible"
        },
        {
          title: "Estate Planning",
          path: "/estate-planning",
          description: "Comprehensive estate planning and wealth transfer strategies",
          lastModified: "2024-01-14",
          priority: "high",
          status: "flexible"
        },
        {
          title: "Employee Benefits",
          path: "/employee-benefits",
          description: "Corporate employee benefit solutions and group insurance",
          lastModified: "2024-01-12",
          priority: "medium",
          status: "flexible"
        },
        {
          title: "Medical Aid",
          path: "/medical-aid",
          description: "Medical aid and healthcare insurance planning",
          lastModified: "2024-01-11",
          priority: "medium",
          status: "flexible"
        }
      ]
    },
    {
      title: "Solutions by Client Type",
      icon: Users,
      description: "Tailored financial solutions for different client segments",
      links: [
        {
          title: "For Individuals",
          path: "/solutions/individuals",
          description: "Personal wealth management and financial planning for individuals",
          lastModified: "2024-01-14",
          priority: "high",
          status: "public"
        },
        {
          title: "For Businesses",
          path: "/solutions/businesses",
          description: "Corporate financial solutions and business wealth management",
          lastModified: "2024-01-14",
          priority: "high",
          status: "public"
        },
        {
          title: "For Advisers",
          path: "/solutions/advisers",
          description: "Professional resources and support for financial advisers",
          lastModified: "2024-01-13",
          priority: "medium",
          status: "public"
        }
      ]
    },
    {
      title: "Resources & Insights",
      icon: BookOpen,
      description: "Educational content, market insights, and financial tools",
      links: [
        {
          title: "Resources Hub",
          path: "/resources",
          description: "Market insights, educational videos, and financial analysis tools",
          lastModified: "2024-01-15",
          priority: "high",
          status: "public"
        },
        {
          title: "Market Insights",
          path: "/resources?section=insights",
          description: "Latest market analysis and financial insights from our experts",
          lastModified: "2024-01-15",
          priority: "medium",
          status: "public"
        },
        {
          title: "Market Watch",
          path: "/resources?section=market-watch",
          description: "Real-time market data, forex rates, stocks, and economic indicators",
          lastModified: "2024-01-15",
          priority: "medium",
          status: "public"
        },
        {
          title: "Market News",
          path: "/resources?section=market-updates",
          description: "Latest financial news, market updates, and investment opportunities",
          lastModified: "2024-01-15",
          priority: "medium",
          status: "public"
        }
      ]
    },
    {
      title: "Company Information",
      icon: Building,
      description: "Learn more about Navigate Wealth as a company",
      links: [
        {
          title: "Why Choose Us",
          path: "/why-us",
          description: "Discover what sets Navigate Wealth apart in financial services",
          lastModified: "2024-01-13",
          priority: "medium",
          status: "public"
        },
        {
          title: "Careers",
          path: "/careers",
          description: "Join our team of financial professionals and wealth management experts",
          lastModified: "2024-01-10",
          priority: "low",
          status: "public"
        },
        {
          title: "Press & Media",
          path: "/press",
          description: "Latest news, press releases, and media coverage",
          lastModified: "2024-01-08",
          priority: "low",
          status: "public"
        }
      ]
    },
    {
      title: "Client Portal",
      icon: Settings,
      description: "Secure client area and account management tools",
      links: [
        {
          title: "Client Dashboard",
          path: "/dashboard",
          description: "Overview of your financial portfolio and account summary",
          priority: "high",
          status: "auth-required"
        },
        {
          title: "Products & Services",
          path: "/products-services",
          description: "Manage your financial products and services",
          priority: "medium",
          status: "auth-required"
        },
        {
          title: "Transactions & Documents",
          path: "/transactions-documents",
          description: "View transaction history and download important documents",
          priority: "medium",
          status: "auth-required"
        },
        {
          title: "Account Profile",
          path: "/profile",
          description: "Manage your personal information and account preferences",
          priority: "medium",
          status: "auth-required"
        },
        {
          title: "Security Settings",
          path: "/security",
          description: "Update passwords and manage account security features",
          priority: "medium",
          status: "auth-required"
        }
      ]
    },
    {
      title: "Legal & Compliance",
      icon: FileText,
      description: "Important legal information and regulatory disclosures",
      links: [
        {
          title: "Legal Information",
          path: "/legal",
          description: "Terms, privacy policy, and regulatory compliance information",
          lastModified: "2024-01-12",
          priority: "medium",
          status: "flexible"
        },
        {
          title: "Privacy & Data Protection",
          path: "/legal?section=privacy-data-protection",
          description: "How we protect and manage your personal information",
          lastModified: "2024-01-12",
          priority: "medium",
          status: "flexible"
        },
        {
          title: "Regulatory Disclosures",
          path: "/legal?section=regulatory-disclosures",
          description: "FSP licensing information and regulatory compliance details",
          lastModified: "2024-01-12",
          priority: "medium",
          status: "flexible"
        }
      ]
    }
  ];

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case 'high':
        return <Badge className="bg-red-100 text-red-800 border-red-300">High Priority</Badge>;
      case 'medium':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">Medium Priority</Badge>;
      case 'low':
        return <Badge className="bg-green-100 text-green-800 border-green-300">Low Priority</Badge>;
      default:
        return null;
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'public':
        return <Badge variant="outline" className="border-blue-300 text-blue-700">Public</Badge>;
      case 'auth-required':
        return <Badge variant="outline" className="border-purple-300 text-purple-700">Login Required</Badge>;
      case 'flexible':
        return <Badge variant="outline" className="border-gray-300 text-gray-700">Public/Authenticated</Badge>;
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-purple-600 to-purple-800 text-white py-20">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12">
          <div className="max-w-4xl">
            <nav className="flex items-center space-x-2 text-purple-200 mb-6">
              <Link to="/" className="hover:text-white transition-colors">Home</Link>
              <ChevronRight className="h-4 w-4" />
              <span>Sitemap</span>
            </nav>
            <h1 className="text-4xl lg:text-5xl font-bold mb-6">
              Navigate Wealth Sitemap
            </h1>
            <p className="text-xl text-purple-100 mb-8 leading-relaxed">
              Complete navigation guide to all our services, resources, and tools. Find everything you need to manage your wealth and plan your financial future.
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2 text-purple-200">
                <Clock className="h-5 w-5" />
                <span>Last updated: January 15, 2024</span>
              </div>
              <div className="flex items-center space-x-2 text-purple-200">
                <ExternalLink className="h-5 w-5" />
                <span>{sitemapSections.reduce((total, section) => total + section.links.length, 0)} total pages</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sitemap Content */}
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 py-16">
        {/* Quick Navigation */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-black mb-6">Quick Navigation</h2>
          <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
            {sitemapSections.map((section, index) => (
              <a
                key={index}
                href={`#section-${index}`}
                className="flex items-center space-x-3 p-4 bg-gray-50 hover:bg-purple-50 border border-gray-200 hover:border-purple-200 rounded-lg transition-all duration-200 group"
              >
                <section.icon className="h-5 w-5 text-purple-600 group-hover:text-purple-700" />
                <span className="font-medium text-sm text-gray-900 group-hover:text-purple-900">{section.title}</span>
              </a>
            ))}
          </div>
        </div>

        {/* Sitemap Sections */}
        <div className="space-y-12">
          {sitemapSections.map((section, sectionIndex) => (
            <div key={sectionIndex} id={`section-${sectionIndex}`}>
              <Card className="border-purple-200">
                <CardHeader className="bg-purple-50">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <section.icon className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <CardTitle className="text-xl text-black">{section.title}</CardTitle>
                      <p className="text-purple-700 mt-1">{section.description}</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-gray-100">
                    {section.links.map((link, linkIndex) => (
                      <div key={linkIndex} className="p-6 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <Link
                                to={link.path}
                                className="text-lg font-semibold text-purple-600 hover:text-purple-800 hover:underline transition-colors"
                              >
                                {link.title}
                              </Link>
                              <div className="flex space-x-2">
                                {getPriorityBadge(link.priority)}
                                {getStatusBadge(link.status)}
                              </div>
                            </div>
                            <p className="text-gray-600 mb-3">{link.description}</p>
                            <div className="flex items-center space-x-4 text-sm text-gray-500">
                              <span className="font-mono bg-gray-100 px-2 py-1 rounded text-xs">
                                {link.path}
                              </span>
                              {link.lastModified && (
                                <span>Last modified: {link.lastModified}</span>
                              )}
                            </div>
                          </div>
                          <Link
                            to={link.path}
                            className="flex-shrink-0 ml-6 p-2 text-gray-400 hover:text-purple-600 transition-colors"
                            aria-label={`Visit ${link.title}`}
                          >
                            <ExternalLink className="h-5 w-5" />
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>

        {/* Additional Information */}
        <div className="mt-16 pt-12 border-t border-gray-200">
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="border-blue-200">
              <CardHeader className="bg-blue-50">
                <CardTitle className="text-black flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-blue-600" />
                  <span>About This Sitemap</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-gray-600 mb-4">
                  This sitemap provides a comprehensive overview of all pages available on the Navigate Wealth website. 
                  It's designed to help users and search engines understand our site structure and find relevant content quickly.
                </p>
                <ul className="space-y-2 text-sm text-gray-600">
                  <li>• <strong>Public pages:</strong> Accessible to all visitors</li>
                  <li>• <strong>Login Required:</strong> Access requires user authentication</li>
                  <li>• <strong>Public/Authenticated:</strong> Available to both types of users</li>
                  <li>• <strong>Priority levels:</strong> Indicate relative importance for SEO</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="border-green-200">
              <CardHeader className="bg-green-50">
                <CardTitle className="text-black flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <span>Need Help?</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <p className="text-gray-600 mb-4">
                  Can't find what you're looking for? Our team is here to help you navigate our services and find the right financial solutions.
                </p>
                <div className="space-y-3">
                  <Link 
                    to="/contact" 
                    className="flex items-center space-x-2 text-purple-600 hover:text-purple-800 transition-colors"
                  >
                    <Phone className="h-4 w-4" />
                    <span>Contact our team</span>
                  </Link>
                  <Link 
                    to="/get-quote" 
                    className="flex items-center space-x-2 text-purple-600 hover:text-purple-800 transition-colors"
                  >
                    <Calculator className="h-4 w-4" />
                    <span>Get a personalized quote</span>
                  </Link>
                  <Link 
                    to="/resources" 
                    className="flex items-center space-x-2 text-purple-600 hover:text-purple-800 transition-colors"
                  >
                    <BookOpen className="h-4 w-4" />
                    <span>Browse our resources</span>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SitemapPage;
