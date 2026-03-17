/**
 * Portfolio Summary — Recommendations Banner
 * Displays AI-powered "Next Best Actions" for the client.
 * Guidelines §7 (presentation only), §8.3 (consistent patterns).
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../ui/card';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import { Lightbulb, CheckCircle } from 'lucide-react';
import type { PortfolioRecommendation } from '../api';
import { formatDate, getPriorityColor, resolveRecommendationIcon } from '../utils';

interface RecommendationsSectionProps {
  recommendations: PortfolioRecommendation[];
}

export function RecommendationsSection({ recommendations }: RecommendationsSectionProps) {
  return (
    <Card className="mb-8 bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Lightbulb className="h-5 w-5 text-blue-600" />
          <span className="text-black">Your Next Best Actions</span>
        </CardTitle>
        <CardDescription>AI-powered insights to help optimize your financial plan</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recommendations.map((recommendation) => {
            const RecIcon = resolveRecommendationIcon(recommendation.iconSlug);
            return (
              <div
                key={recommendation.id}
                className={`bg-white rounded-lg p-4 border-l-4 ${getPriorityColor(recommendation.priority)} hover:shadow-sm transition-shadow`}
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <RecIcon className="h-5 w-5 text-blue-600" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h4 className="text-black">{recommendation.title}</h4>
                      <Badge
                        variant="outline"
                        className={
                          recommendation.priority === 'urgent'
                            ? 'border-red-500 text-red-700'
                            : recommendation.priority === 'high'
                            ? 'border-blue-500 text-blue-700'
                            : 'border-yellow-500 text-yellow-700'
                        }
                      >
                        {recommendation.priority}
                      </Badge>
                    </div>
                    <p className="text-gray-600 text-sm mb-3">{recommendation.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Due: {formatDate(recommendation.dueDate)}</span>
                      <Button size="sm" className="bg-blue-600 hover:bg-blue-700">
                        {recommendation.action}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
          {recommendations.length === 0 && (
            <div className="flex flex-col items-center py-8 text-center">
              <CheckCircle className="h-10 w-10 text-green-500 mb-3" />
              <p className="text-sm font-medium text-gray-700">You're all caught up!</p>
              <p className="text-xs text-gray-500 mt-1">
                No recommendations at this time. Check back after your next review.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
