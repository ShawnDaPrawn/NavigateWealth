import React, { useState } from 'react';
import { Button } from '../../../ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { CheckCircle, AlertCircle, Loader2, Database } from 'lucide-react';
import { usePublicationsInit } from './hooks';

interface InitializePublicationsProps {
  onInitialized?: () => void;
}

export function InitializePublications({ onInitialized }: InitializePublicationsProps = {}) {
  const { initialize, isInitializing } = usePublicationsInit();
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInitialize = async () => {
    setError(null);
    setSuccess(false);

    try {
      await initialize({
        create_default_categories: true,
        create_default_types: true
      });

      setSuccess(true);
      
      // Call the callback if provided, otherwise reload the page
      if (onInitialized) {
        setTimeout(() => {
          onInitialized();
        }, 1500);
      } else {
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (err) {
      console.error('Error initializing publications:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize publications system');
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Database className="h-8 w-8 text-purple-600" />
          <div>
            <CardTitle>Initialize Publications System</CardTitle>
            <CardDescription>
              Set up default categories and types for the publications system
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!success && !error && (
          <div className="contents">
            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                This will create the following default categories:
              </p>
              <ul className="text-sm text-gray-600 space-y-1 ml-6 list-disc">
                <li>Market & Economic Insights</li>
                <li>Personal Finance</li>
                <li>Retirement Planning</li>
                <li>Risk & Insurance</li>
                <li>Estate & Tax Planning</li>
                <li>Financial Literacy</li>
                <li>Global Markets</li>
                <li>Adviser's Corner</li>
              </ul>
            </div>

            <div className="space-y-2">
              <p className="text-sm text-gray-600">
                And these article types:
              </p>
              <ul className="text-sm text-gray-600 space-y-1 ml-6 list-disc">
                <li>Insights & Education</li>
                <li>Market Watch</li>
                <li>Market News</li>
              </ul>
            </div>

            <Button
              onClick={handleInitialize}
              disabled={isInitializing}
              className="w-full"
            >
              {isInitializing ? (
                <div className="contents">
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Initializing...
                </div>
              ) : (
                <div className="contents">
                  <Database className="h-4 w-4 mr-2" />
                  Initialize System
                </div>
              )}
            </Button>
          </div>
        )}

        {success && (
          <div className="text-center py-6">
            <CheckCircle className="h-12 w-12 mx-auto mb-3 text-green-600" />
            <p className="text-green-600 font-medium">
              Publications system initialized successfully!
            </p>
            <p className="text-sm text-gray-600 mt-2">
              Reloading page...
            </p>
          </div>
        )}

        {error && (
          <div className="text-center py-6">
            <AlertCircle className="h-12 w-12 mx-auto mb-3 text-red-600" />
            <p className="text-red-600 font-medium mb-2">
              {error}
            </p>
            <Button variant="outline" onClick={handleInitialize}>
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
