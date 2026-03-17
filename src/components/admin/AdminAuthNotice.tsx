import React from 'react';
import { Alert, AlertDescription } from '../ui/alert';
import { AlertCircle, LogIn } from 'lucide-react';
import { Button } from '../ui/button';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthContext';

export function AdminAuthNotice() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  // Don't show if user is authenticated as admin or super_admin
  if (isAuthenticated && (user?.role === 'admin' || user?.role === 'super_admin')) {
    return null;
  }

  return (
    <Alert className="border-yellow-200 bg-yellow-50">
      <AlertCircle className="h-4 w-4 text-yellow-600" />
      <AlertDescription className="ml-2 flex items-center justify-between">
        <span className="text-yellow-800">
          {!isAuthenticated 
            ? 'Please log in as an administrator to access admin features.'
            : 'Admin privileges required. Please log in with an admin account.'}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate('/login')}
          className="ml-4 border-yellow-300 text-yellow-700 hover:bg-yellow-100"
        >
          <LogIn className="h-4 w-4 mr-2" />
          {!isAuthenticated ? 'Log In' : 'Switch Account'}
        </Button>
      </AlertDescription>
    </Alert>
  );
}