/**
 * FeedbackReview — Feedback tab
 *
 * Displays recent user feedback on Vasco responses with filtering.
 * Guidelines: §7, §8.3
 */

import React, { useState, useMemo } from 'react';
import {
  ThumbsUp, ThumbsDown, Search, Loader2, MessageSquare,
  Clock, Filter, Inbox,
} from 'lucide-react';
import { Input } from '../../../../ui/input';
import { Badge } from '../../../../ui/badge';
import { Button } from '../../../../ui/button';
import { cn } from '../../../../ui/utils';
import { useFeedback } from '../hooks';
import { FEEDBACK_RATING_CONFIG } from '../constants';
import type { FeedbackRating, FeedbackEntry } from '../types';

type FilterRating = FeedbackRating | 'all';

export function FeedbackReview() {
  const { data: feedback, isLoading, error } = useFeedback();
  const [ratingFilter, setRatingFilter] = useState<FilterRating>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filtered = useMemo(() => {
    if (!feedback) return [];
    return feedback.filter(entry => {
      if (ratingFilter !== 'all' && entry.rating !== ratingFilter) return false;
      if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        return (
          entry.messageContent.toLowerCase().includes(lower) ||
          (entry.comment?.toLowerCase().includes(lower) ?? false)
        );
      }
      return true;
    });
  }, [feedback, ratingFilter, searchTerm]);

  const stats = useMemo(() => {
    if (!feedback) return { positive: 0, negative: 0, total: 0 };
    return {
      positive: feedback.filter(f => f.rating === 'positive').length,
      negative: feedback.filter(f => f.rating === 'negative').length,
      total: feedback.length,
    };
  }, [feedback]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm text-center">
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-500">Total Feedback</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm text-center">
          <p className="text-2xl font-bold text-green-600">{stats.positive}</p>
          <p className="text-xs text-gray-500">Positive</p>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm text-center">
          <p className="text-2xl font-bold text-red-600">{stats.negative}</p>
          <p className="text-xs text-gray-500">Negative</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search feedback content..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'positive', 'negative'] as FilterRating[]).map(rating => (
            <Button
              key={rating}
              variant={ratingFilter === rating ? 'default' : 'outline'}
              size="sm"
              onClick={() => setRatingFilter(rating)}
              className={cn(
                'gap-1.5 capitalize',
                ratingFilter === rating && 'bg-purple-600 hover:bg-purple-700'
              )}
            >
              {rating === 'positive' && <ThumbsUp className="h-3.5 w-3.5" />}
              {rating === 'negative' && <ThumbsDown className="h-3.5 w-3.5" />}
              {rating === 'all' && <Filter className="h-3.5 w-3.5" />}
              {rating}
            </Button>
          ))}
        </div>
      </div>

      {/* Feedback List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-12 text-center">
          <Inbox className="h-8 w-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">
            {feedback?.length === 0 ? 'No feedback received yet' : 'No feedback matches your filters'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(entry => (
            <FeedbackCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedbackCard({ entry }: { entry: FeedbackEntry }) {
  const config = FEEDBACK_RATING_CONFIG[entry.rating];
  const Icon = entry.rating === 'positive' ? ThumbsUp : ThumbsDown;

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start gap-3">
        <div className={cn(
          'p-2 rounded-lg shrink-0',
          entry.rating === 'positive' ? 'bg-green-50' : 'bg-red-50'
        )}>
          <Icon className={cn(
            'h-4 w-4',
            entry.rating === 'positive' ? 'text-green-600' : 'text-red-600'
          )} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge className={cn('text-xs', config.badgeClass)}>
              {config.label}
            </Badge>
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(entry.createdAt).toLocaleDateString('en-ZA', {
                day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </span>
          </div>
          <p className="text-sm text-gray-700 mb-1">
            <span className="text-gray-400 text-xs">Message: </span>
            {entry.messageContent}
          </p>
          {entry.comment && (
            <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-2 mt-2">
              <span className="text-gray-400 text-xs block mb-0.5">User comment:</span>
              {entry.comment}
            </p>
          )}
          <p className="text-xs text-gray-400 mt-2">
            Session: {entry.sessionId.slice(0, 8)}...
          </p>
        </div>
      </div>
    </div>
  );
}
