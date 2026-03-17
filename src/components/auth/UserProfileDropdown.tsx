import React from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from './AuthContext';
import { SUPER_ADMIN_EMAIL } from '../../utils/auth/constants';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { Button } from '../ui/button';
import { toast } from 'sonner@2.0.3';
import { 
  User, 
  Shield, 
  LogOut, 
  ChevronDown,
  Settings,
  ArrowLeftRight,
} from 'lucide-react';

export function UserProfileDropdown() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  // Handle logout with redirect and toast
  const handleLogout = async () => {
    try {
      await logout();
      toast.success('You have been successfully logged out');
      navigate('/');
    } catch (error) {
      console.error('Logout error:', error);
      toast.error('Failed to log out. Please try again.');
    }
  };

  const isApproved = user.accountStatus === 'approved' || user.applicationStatus === 'approved';
  const isAdmin = user.role === 'admin' || user.role === 'super_admin';
  const isSuperAdmin = user.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

  const getInitials = () => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase();
    }
    return user.email?.[0]?.toUpperCase() || 'U';
  };

  const getUserDisplayName = () => {
    if (user.firstName && user.lastName) {
      return `${user.firstName} ${user.lastName}`;
    }
    return user.email || 'User';
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center space-x-3 h-auto px-3 py-2 hover:bg-purple-50/50 rounded-lg transition-colors border border-transparent hover:border-purple-200"
        >
          <Avatar className="h-10 w-10 ring-2 ring-purple-100">
            <AvatarFallback className="bg-gradient-to-br from-[#6d28d9] to-[#5b21b6] text-white font-semibold">
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          
          <div className="hidden md:flex flex-col items-start">
            <span className="font-semibold text-gray-900">
              {getUserDisplayName()}
            </span>
            {isAdmin && (
              <span className="text-xs text-[#6d28d9] font-medium">
                Administrator
              </span>
            )}
          </div>
          
          <ChevronDown className="h-4 w-4 text-gray-500" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent className="w-72" align="end" forceMount>
        <DropdownMenuLabel className="font-normal pb-3">
          <div className="flex items-center space-x-3">
            <Avatar className="h-12 w-12 ring-2 ring-purple-100">
              <AvatarFallback className="bg-gradient-to-br from-[#6d28d9] to-[#5b21b6] text-white font-semibold">
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col space-y-1 flex-1">
              <p className="font-semibold leading-none text-gray-900">
                {getUserDisplayName()}
              </p>
              <p className="text-sm leading-none text-gray-500">
                {user.email}
              </p>
              {isAdmin && (
                <span className="text-xs text-[#6d28d9] font-medium inline-block mt-1">
                  Administrator
                </span>
              )}
            </div>
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        {isApproved && (
          <div className="contents">
            <DropdownMenuItem asChild>
              <Link to="/profile" className="cursor-pointer">
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </Link>
            </DropdownMenuItem>
            
            <DropdownMenuItem asChild>
              <Link to="/security" className="cursor-pointer">
                <Shield className="mr-2 h-4 w-4" />
                <span>Security Settings</span>
              </Link>
            </DropdownMenuItem>
            
            {/* Admin Dashboard Link */}
            {isAdmin && (
              <div className="contents">
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/admin" className="cursor-pointer text-[#6d28d9] focus:text-[#6d28d9] focus:bg-purple-50">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Admin Dashboard</span>
                  </Link>
                </DropdownMenuItem>
              </div>
            )}
            
            <DropdownMenuSeparator />
          </div>
        )}
        
        <DropdownMenuItem
          className="cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Sign Out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}