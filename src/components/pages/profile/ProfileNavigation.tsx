import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { 
  User, 
  Mail, 
  MapPin, 
  Briefcase, 
  Heart, 
  Users, 
  CreditCard, 
  Shield, 
  Target,
  PieChart,
  Wallet
} from 'lucide-react';
import { ProfileSection } from './types';

interface ProfileNavigationProps {
  activeSection: ProfileSection;
  onSectionChange: (section: ProfileSection) => void;
}

export function ProfileNavigation({ activeSection, onSectionChange }: ProfileNavigationProps) {
  const navigationItems = [
    { id: 'personal' as ProfileSection, label: 'Personal Info', icon: User },
    { id: 'contact' as ProfileSection, label: 'Contact Details', icon: Mail },
    { id: 'identity' as ProfileSection, label: 'Identity', icon: Shield },
    { id: 'address' as ProfileSection, label: 'Address', icon: MapPin },
    { id: 'employment' as ProfileSection, label: 'Employment', icon: Briefcase },
    { id: 'health' as ProfileSection, label: 'Health Info', icon: Heart },
    { id: 'family' as ProfileSection, label: 'Family', icon: Users },
    { id: 'banking' as ProfileSection, label: 'Banking', icon: CreditCard },
    { id: 'risk' as ProfileSection, label: 'Risk Profile', icon: Target },
    { id: 'assets' as ProfileSection, label: 'Assets & Liabilities', icon: PieChart },
    { id: 'budgeting' as ProfileSection, label: 'Budgeting', icon: Wallet }
  ];

  return (
    <Card className="sticky top-6 hidden lg:block">
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Quick Navigation</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <nav className="space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors ${
                  activeSection === item.id
                    ? 'bg-[#6d28d9]/10 text-[#6d28d9] border-r-2 border-[#6d28d9]'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </CardContent>
    </Card>
  );
}
