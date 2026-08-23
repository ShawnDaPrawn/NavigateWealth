/**
 * Shared shapes and pure formatters/icon pickers for the My Adviser page.
 * Helper bodies moved verbatim from MyAdviserPage.tsx (component-scope
 * consts became module exports).
 */
import { Badge } from '../ui/badge';
import {
  Award,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle,
  FileCheck,
  FileText,
  Mail,
  MessageCircle,
  MessageSquare,
  Phone,
  PieChart,
  Shield,
  Target,
  TrendingUp,
  Upload,
  Users,
  Video,
} from 'lucide-react';

export interface AdviserMeetingDocument {
  name: string;
  size: string;
  type: string;
}

export interface AdviserMeeting {
  id: number;
  date: Date;
  type: string;
  duration: string;
  status: string;
  summary: string;
  documents: AdviserMeetingDocument[];
  participants: string[];
  objectives: string[];
  outcomes: string[];
  meetingType: string;
  rating: number;
}

export interface AdviserCommunication {
  id: number;
  date: Date;
  type: string;
  subject: string;
  summary: string;
  status: string;
  attachments?: string[];
  priority: string;
}

export const formatDate = (date: Date | null) => {
  if (!date) return '';
  return date.toLocaleDateString('en-ZA', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const formatRelativeDate = (date: Date | null) => {
  if (!date) return '';
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
  return `${Math.ceil(diffDays / 30)} months ago`;
};

export const getDocumentIcon = (type: string) => {
  switch (type) {
    case 'report':
      return <BarChart3 className="h-4 w-4 text-blue-600" />;
    case 'recommendations':
      return <Target className="h-4 w-4 text-purple-600" />;
    case 'strategy':
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    case 'legal':
      return <Shield className="h-4 w-4 text-red-600" />;
    case 'analysis':
      return <PieChart className="h-4 w-4 text-orange-600" />;
    case 'forms':
      return <FileCheck className="h-4 w-4 text-gray-600" />;
    case 'assessment':
      return <CheckCircle className="h-4 w-4 text-blue-600" />;
    case 'notes':
      return <BookOpen className="h-4 w-4 text-indigo-600" />;
    case 'certificates':
      return <Award className="h-4 w-4 text-yellow-600" />;
    default:
      return <FileText className="h-4 w-4 text-gray-600" />;
  }
};

export const getCommunicationIcon = (type: string) => {
  switch (type) {
    case 'email':
      return <Mail className="h-4 w-4 text-blue-600" />;
    case 'message':
      return <MessageCircle className="h-4 w-4 text-purple-600" />;
    case 'call':
      return <Phone className="h-4 w-4 text-green-600" />;
    case 'meeting_confirmation':
      return <Calendar className="h-4 w-4 text-orange-600" />;
    case 'document_upload':
      return <Upload className="h-4 w-4 text-gray-600" />;
    default:
      return <MessageSquare className="h-4 w-4 text-gray-600" />;
  }
};

export const getMeetingTypeIcon = (type: string) => {
  switch (type) {
    case 'video_call':
      return <Video className="h-4 w-4 text-blue-600" />;
    case 'phone_call':
      return <Phone className="h-4 w-4 text-green-600" />;
    case 'in_person':
      return <Users className="h-4 w-4 text-purple-600" />;
    default:
      return <Calendar className="h-4 w-4 text-gray-600" />;
  }
};

export const getPriorityBadge = (priority: string) => {
  switch (priority) {
    case 'high':
      return <Badge className="bg-red-100 text-red-800 text-xs">High Priority</Badge>;
    case 'normal':
      return (
        <Badge variant="outline" className="text-xs">
          Normal
        </Badge>
      );
    case 'low':
      return (
        <Badge variant="outline" className="text-gray-500 text-xs">
          Low
        </Badge>
      );
    default:
      return null;
  }
};
