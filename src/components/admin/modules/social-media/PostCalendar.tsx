import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import { Button } from '../../../ui/button';
import { Badge } from '../../../ui/badge';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../../ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../../ui/dialog';
import { Calendar } from '../../../ui/calendar';
import { 
  ChevronLeft, 
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  MoreVertical,
  Edit,
  Copy,
  Trash2,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Linkedin,
  Instagram,
  Facebook,
  Twitter,
  Plus
} from 'lucide-react';

import { SocialPost, SocialPlatform } from './types';

interface PostCalendarProps {
  posts: SocialPost[];
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onPostEdit: (post: SocialPost) => void;
  onPostDelete: (postId: string) => void;
  onPostDuplicate: (post: SocialPost) => void;
  onCreatePost: (date: Date) => void;
  viewMode: 'month' | 'week' | 'day';
  onViewModeChange: (mode: 'month' | 'week' | 'day') => void;
}

const platformIcons = {
  linkedin: Linkedin,
  instagram: Instagram,
  facebook: Facebook,
  x: Twitter,
};

const statusColors = {
  draft: 'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-100 text-blue-700',
  published: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  pending_approval: 'bg-yellow-100 text-yellow-700',
};

const statusIcons = {
  draft: MoreVertical,
  scheduled: Clock,
  published: CheckCircle,
  failed: XCircle,
  pending_approval: AlertTriangle,
};

export function PostCalendar({
  posts = [],
  selectedDate,
  onDateChange,
  onPostEdit,
  onPostDelete,
  onPostDuplicate,
  onCreatePost,
  viewMode,
  onViewModeChange,
}: PostCalendarProps) {
  const [showPostDialog, setShowPostDialog] = useState(false);
  const [selectedPost, setSelectedPost] = useState<SocialPost | null>(null);

  const handlePostClick = (post: SocialPost) => {
    setSelectedPost(post);
    setShowPostDialog(true);
  };

  // Helper function to check if dates are same day
  const isSameDay = (date1: Date, date2: Date) => {
    return date1.toDateString() === date2.toDateString();
  };

  const getPostsForDate = (date: Date): SocialPost[] => {
    return posts.filter(post => {
      const postDate = post.scheduledAt || post.publishedAt;
      return postDate && isSameDay(postDate, date);
    });
  };

  // Helper function to get start of week
  const getStartOfWeek = (date: Date) => {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
    return new Date(date.setDate(diff));
  };

  // Helper function to get days of current week
  const getWeekDays = (date: Date) => {
    const startOfWeek = getStartOfWeek(new Date(date));
    const days = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(startOfWeek);
      day.setDate(startOfWeek.getDate() + i);
      days.push(day);
    }
    return days;
  };

  const renderWeekView = () => {
    const days = getWeekDays(selectedDate);

    return (
      <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
        {/* Day headers */}
        {days.map((day) => (
          <div key={day.toISOString()} className="bg-card p-4 border-b">
            <div className="font-medium text-center">
              {day.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' })}
            </div>
          </div>
        ))}
        
        {/* Day content */}
        {days.map((day) => {
          const dayPosts = getPostsForDate(day);
          const isToday = isSameDay(day, new Date());
          const isSelected = isSameDay(day, selectedDate);
          
          return (
            <div
              key={`content-${day.toISOString()}`}
              className={`bg-card p-2 min-h-[200px] cursor-pointer hover:bg-muted/20 ${
                isSelected ? 'ring-2 ring-primary' : ''
              } ${isToday ? 'bg-primary/5' : ''}`}
              onClick={() => onDateChange(day)}
            >
              <div className="space-y-2">
                {dayPosts.map((post) => (
                  <div
                    key={post.id}
                    className="p-2 rounded border text-xs hover:shadow-sm transition-shadow"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePostClick(post);
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1">
                        {post.profiles.map((profileId) => {
                          // Mock platform detection from profile ID
                          const platform = profileId.split('-')[0] as SocialPlatform;
                          const Icon = platformIcons[platform];
                          return (
                            <Icon key={profileId} className="h-3 w-3" />
                          );
                        })}
                      </div>
                      <div className={`text-xs px-1 py-0.5 rounded ${statusColors[post.status]}`}>
                        {post.status}
                      </div>
                    </div>
                    
                    <div className="text-xs line-clamp-2 mb-1">
                      {post.body}
                    </div>
                    
                    <div className="text-xs text-muted-foreground">
                      {post.scheduledAt && post.scheduledAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      {post.publishedAt && post.publishedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
                
                {/* Add post button */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-8 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCreatePost(day);
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Add Post
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderMonthView = () => {
    return (
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={(date) => date && onDateChange(date)}
        className="rounded-md border"
        modifiers={{
          hasPost: (date) => getPostsForDate(date).length > 0,
        }}
        modifiersStyles={{
          hasPost: { backgroundColor: '#6d28d9', color: 'white' },
        }}
      />
    );
  };

  const renderDayView = () => {
    const dayPosts = getPostsForDate(selectedDate);
    
    return (
      <div className="space-y-4">
        <div className="text-center">
          <h3 className="text-lg font-medium">
            {selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </h3>
          <p className="text-sm text-muted-foreground">
            {dayPosts.length} post{dayPosts.length !== 1 ? 's' : ''} scheduled
          </p>
        </div>
        
        <div className="space-y-3">
          {dayPosts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No posts scheduled for this day</p>
              <Button
                className="mt-4"
                onClick={() => onCreatePost(selectedDate)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Post
              </Button>
            </div>
          ) : (
            dayPosts.map((post) => {
              const StatusIcon = statusIcons[post.status];
              
              return (
                <Card
                  key={post.id}
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => handlePostClick(post)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {post.profiles.map((profileId) => {
                          const platform = profileId.split('-')[0] as SocialPlatform;
                          const Icon = platformIcons[platform];
                          return (
                            <Icon key={profileId} className="h-4 w-4" />
                          );
                        })}
                        <Badge variant="outline">
                          {post.profiles.length} platform{post.profiles.length > 1 ? 's' : ''}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <div className="text-sm text-muted-foreground">
                          {post.scheduledAt && post.scheduledAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          {post.publishedAt && post.publishedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${statusColors[post.status]}`}>
                          <StatusIcon className="h-3 w-3" />
                          {post.status}
                        </div>
                      </div>
                    </div>
                    
                    <p className="text-sm mb-3 line-clamp-3">{post.body}</p>
                    
                    {post.media.length > 0 && (
                      <div className="flex items-center gap-2 mb-3">
                        <div className="flex -space-x-2">
                          {post.media.slice(0, 3).map((media, index) => (
                            <div
                              key={media.id}
                              className="h-8 w-8 rounded border-2 border-white bg-muted overflow-hidden"
                            >
                              {media.type === 'image' ? (
                                <img
                                  src={media.url}
                                  alt="Post media attachment"
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center bg-gray-200">
                                  <span className="text-xs">📹</span>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {post.media.length} media file{post.media.length > 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
                    
                    {post.analytics && (
                      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                        <span>👀 {post.analytics.impressions}</span>
                        <span>👆 {post.analytics.clicks}</span>
                        <span>❤️ {post.analytics.reactions}</span>
                        <span>💬 {post.analytics.comments}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Calendar Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const newDate = new Date(selectedDate);
                newDate.setDate(selectedDate.getDate() - (viewMode === 'day' ? 1 : 7));
                onDateChange(newDate);
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            
            <h2 className="text-xl font-semibold">
              {viewMode === 'month' && selectedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
              {viewMode === 'week' && `Week of ${getStartOfWeek(new Date(selectedDate)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
              {viewMode === 'day' && selectedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </h2>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const newDate = new Date(selectedDate);
                newDate.setDate(selectedDate.getDate() + (viewMode === 'day' ? 1 : 7));
                onDateChange(newDate);
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => onDateChange(new Date())}
          >
            Today
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={viewMode} onValueChange={(value: string) => onViewModeChange(value)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
            </SelectContent>
          </Select>
          
          <Button onClick={() => onCreatePost(selectedDate)}>
            <Plus className="h-4 w-4 mr-2" />
            New Post
          </Button>
        </div>
      </div>

      {/* Calendar Content */}
      <Card>
        <CardContent className="p-6">
          {viewMode === 'month' && renderMonthView()}
          {viewMode === 'week' && renderWeekView()}
          {viewMode === 'day' && renderDayView()}
        </CardContent>
      </Card>

      {/* Post Details Dialog */}
      <Dialog open={showPostDialog} onOpenChange={setShowPostDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Post Details</DialogTitle>
            <DialogDescription>
              {selectedPost?.status === 'published' ? 'Published post analytics and details' : 'Scheduled post details'}
            </DialogDescription>
          </DialogHeader>
          
          {selectedPost && (
            <div className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {selectedPost.profiles.map((profileId) => {
                    const platform = profileId.split('-')[0] as SocialPlatform;
                    const Icon = platformIcons[platform];
                    return (
                      <Icon key={profileId} className="h-5 w-5" />
                    );
                  })}
                </div>
                <div className={`px-3 py-1 rounded text-sm ${statusColors[selectedPost.status]}`}>
                  {selectedPost.status}
                </div>
              </div>
              
              <div className="p-4 bg-muted/20 rounded-lg">
                <p className="whitespace-pre-wrap">{selectedPost.body}</p>
              </div>
              
              {selectedPost.analytics && (
                <div className="grid grid-cols-4 gap-4 p-4 bg-muted/20 rounded-lg">
                  <div className="text-center">
                    <div className="text-2xl font-medium">{selectedPost.analytics.impressions}</div>
                    <div className="text-sm text-muted-foreground">Impressions</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-medium">{selectedPost.analytics.clicks}</div>
                    <div className="text-sm text-muted-foreground">Clicks</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-medium">{selectedPost.analytics.reactions}</div>
                    <div className="text-sm text-muted-foreground">Reactions</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-medium">{selectedPost.analytics.engagement_rate.toFixed(1)}%</div>
                    <div className="text-sm text-muted-foreground">Engagement</div>
                  </div>
                </div>
              )}
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => onPostDuplicate(selectedPost)}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </Button>
                <Button variant="outline" onClick={() => onPostEdit(selectedPost)}>
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </Button>
                <Button variant="destructive" onClick={() => onPostDelete(selectedPost.id)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}