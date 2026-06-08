import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import {
  Palette,
  Component,
  Type,
  Grid,
  Info,
  Layers,
  Download,
  Shield,
  Grid3X3,
  FileText,
  Target,
  UserCheck,
  Building,
  Sparkles,
  CheckCircle,
} from 'lucide-react';

const TABS = [
  { value: 'colors', label: 'Colours', icon: Palette },
  { value: 'typography', label: 'Typography', icon: Type },
  { value: 'components', label: 'Components', icon: Component },
  { value: 'patterns', label: 'Patterns', icon: Grid3X3 },
  { value: 'icons', label: 'Icons', icon: Sparkles },
  { value: 'sections', label: 'Sections', icon: Layers },
  { value: 'download', label: 'Download', icon: Download },
] as const;

interface OverviewTabProps {
  onNavigateToTab: (tab: string) => void;
}

export function OverviewTab({ onNavigateToTab }: OverviewTabProps) {
  return (
    <div className="space-y-8 md:space-y-12">
      {/* Introduction */}
      <div className="bg-gradient-to-br from-primary/5 via-primary/3 to-transparent rounded-2xl p-6 md:p-8 border border-primary/10">
        <div className="flex items-start space-x-4">
          <div className="flex-shrink-0 w-12 h-12 md:w-14 md:h-14 bg-primary/10 rounded-xl flex items-center justify-center">
            <Info className="h-6 w-6 md:h-7 md:w-7 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl md:text-2xl font-bold text-black mb-2 md:mb-3">
              Navigate Wealth Design System
            </h3>
            <p className="text-sm md:text-base text-gray-600 leading-relaxed mb-4">
              A comprehensive design system for professional wealth management interfaces, featuring
              a clean white/light colour scheme with purple accents (#6d28d9), complete
              authentication flows, and full admin capabilities. This is the single source of truth
              for all UI decisions.
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge className="bg-primary/10 text-primary border-primary/20">
                React + TypeScript
              </Badge>
              <Badge className="bg-primary/10 text-primary border-primary/20">
                Tailwind CSS v4
              </Badge>
              <Badge className="bg-primary/10 text-primary border-primary/20">shadcn/ui</Badge>
              <Badge className="bg-primary/10 text-primary border-primary/20">
                Mobile Responsive
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Navigation */}
      <div>
        <h3 className="text-lg md:text-xl font-bold text-black mb-4 flex items-center">
          <Target className="h-5 w-5 md:h-6 md:w-6 text-primary mr-2" />
          Quick Navigation
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.value}
                onClick={() => onNavigateToTab(tab.value)}
                className="flex flex-col items-center justify-center p-4 md:p-5 bg-white border-2 border-gray-200 rounded-xl hover:border-primary hover:bg-primary/5 transition-all duration-200 group"
              >
                <Icon className="h-6 w-6 md:h-7 md:w-7 text-primary mb-2" />
                <span className="text-xs md:text-sm font-medium text-gray-700 group-hover:text-primary">
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Design Foundations */}
      <div>
        <h3 className="text-lg md:text-xl font-bold text-black mb-4 flex items-center">
          <Palette className="h-5 w-5 md:h-6 md:w-6 text-primary mr-2" />
          Design Foundations
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {[
            {
              icon: Palette,
              title: 'Colour System',
              desc: 'White content sections, purple (#6d28d9) brand accents, and dark navy (#313653) hero/dark sections',
              tab: 'colors',
              cta: 'View Colours',
            },
            {
              icon: Type,
              title: 'Typography',
              desc: 'Scalable type system with 7 scale steps, 4 weights, and section-contextual colours',
              tab: 'typography',
              cta: 'View Typography',
            },
            {
              icon: Layers,
              title: 'Section Styles',
              desc: 'Predefined section classes for consistent layouts and visual hierarchy',
              tab: 'sections',
              cta: 'View Sections',
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <Card
                key={card.title}
                className="border-gray-200 hover:border-primary/50 transition-colors"
              >
                <CardHeader className="pb-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-3">
                    <Icon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
                  </div>
                  <CardTitle className="text-base md:text-lg text-black">{card.title}</CardTitle>
                  <CardDescription className="text-sm text-gray-600">{card.desc}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-primary hover:text-primary hover:bg-primary/10 -ml-4"
                    onClick={() => onNavigateToTab(card.tab)}
                  >
                    {card.cta} →
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Key Features */}
      <div>
        <h3 className="text-lg md:text-xl font-bold text-black mb-4 flex items-center">
          <Component className="h-5 w-5 md:h-6 md:w-6 text-primary mr-2" />
          Key Features
        </h3>
        <div className="grid sm:grid-cols-2 gap-4 md:gap-6">
          {[
            {
              icon: Shield,
              title: 'Authentication System',
              desc: 'Complete login/signup flows with account type selection and multi-step application',
              badges: ['Login/Signup', 'Protected Routes', '4-Step Application'],
            },
            {
              icon: Grid,
              title: 'Navigation System',
              desc: 'Multi-level navigation with top bar, main nav with dropdowns, and dashboard navigation',
              badges: ['Top Bar', 'Mega Menus', 'Dashboard Nav'],
            },
            {
              icon: UserCheck,
              title: 'User Management',
              desc: 'Comprehensive profile system with four-section dropdown and admin account switching',
              badges: ['Profile', 'Settings', 'Security'],
            },
            {
              icon: Building,
              title: 'Admin Dashboard',
              desc: 'Full client management system with 11 modules and comprehensive administrative controls',
              badges: ['11 Modules', 'Client Mgmt', 'Compliance'],
            },
          ].map((feature) => {
            const Icon = feature.icon;
            return (
              <Card key={feature.title} className="border-gray-200">
                <CardContent className="p-4 md:p-6">
                  <div className="flex items-start space-x-3 md:space-x-4">
                    <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm md:text-base font-semibold text-black mb-1 md:mb-2">
                        {feature.title}
                      </h4>
                      <p className="text-xs md:text-sm text-gray-600 mb-3">{feature.desc}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {feature.badges.map((b) => (
                          <Badge key={b} variant="secondary" className="text-xs">
                            {b}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Application Pages */}
      <div>
        <h3 className="text-lg md:text-xl font-bold text-black mb-4 flex items-center">
          <FileText className="h-5 w-5 md:h-6 md:w-6 text-primary mr-2" />
          Application Structure
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {[
            {
              title: 'Public Pages',
              items: [
                'Home Page',
                'About Us',
                'Services (8 pages)',
                'Contact & Get Quote',
                'Resources & Press',
              ],
            },
            {
              title: 'Client Portal',
              items: [
                'Dashboard',
                'Products & Services',
                'Transactions & Docs',
                'Profile & Settings',
              ],
            },
            {
              title: 'Admin System',
              items: [
                'Client Management',
                'Compliance Tools',
                'Communication Hub',
                'Advice Engine',
                'Social Media Mgmt',
              ],
            },
          ].map((group) => (
            <div
              key={group.title}
              className="bg-white border border-gray-200 rounded-lg p-4 hover:border-primary/50 transition-colors"
            >
              <h4 className="text-sm font-semibold text-black mb-2">{group.title}</h4>
              <ul className="space-y-1.5 text-xs md:text-sm text-gray-600">
                {group.items.map((item) => (
                  <li key={item} className="flex items-center">
                    <CheckCircle className="h-3 w-3 text-primary mr-2 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Getting Started */}
      <div className="section-dark-gray rounded-2xl p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-lg md:text-xl font-bold text-white mb-2">Ready to Get Started?</h3>
            <p className="text-sm md:text-base text-gray-300">
              Explore the design system components and download the complete codebase to start
              building.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              onClick={() => onNavigateToTab('components')}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              <Component className="h-4 w-4 mr-2" />
              View Components
            </Button>
            <Button
              onClick={() => onNavigateToTab('download')}
              variant="outline"
              className="border-white/30 bg-white/10 text-white hover:bg-white/20 hover:border-white/50"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Code
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
