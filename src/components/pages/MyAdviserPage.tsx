import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { ImageWithFallback } from '../figma/ImageWithFallback';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Alert, AlertDescription } from '../ui/alert';
import { Separator } from '../ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { useAuth } from '../auth/AuthContext';
import { 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  MessageSquare,
  Star,
  Clock,
  Award,
  FileText,
  Download,
  Video,
  Users,
  Send,
  CheckCircle,
  AlertCircle,
  UserCheck,
  MapPin,
  GraduationCap,
  Building,
  Globe,
  Briefcase,
  TrendingUp,
  Shield,
  Target,
  ExternalLink,
  PieChart,
  BarChart3,
  FileCheck,
  Upload,
  MessageCircle,
  ArrowRight,
  Info,
  Linkedin,
  BookOpen,
  Heart,
  ThumbsUp,
  Coffee,
  CalendarDays,
  Handshake
} from 'lucide-react';

export function MyAdviserPage() {
  const { user } = useAuth();
  const [scheduleMeetingOpen, setScheduleMeetingOpen] = useState(false);
  const [messageAdviserOpen, setMessageAdviserOpen] = useState(false);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>([]);
  const [meetingPurpose, setMeetingPurpose] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  // Mock data for the adviser - will be empty if no adviser is assigned
  const adviserData = user?.adviserAssigned ? {
    name: 'Sarah Johnson',
    title: 'Senior Financial Planner',
    photo: 'https://images.unsplash.com/photo-1494790108755-2616b2e07c7e?w=150&h=150&fit=crop&crop=face',
    email: 'sarah.johnson@navigatewealth.co.za',
    phone: '+27 11 555 0123',
    directLine: '+27 11 555 0456',
    location: 'Cape Town Office',
    yearsExperience: 12,
    clientsServed: 150,
    qualifications: ['CFP®', 'BCom Finance (UCT)', 'FPSA®', 'CFA Level II'],
    specializations: ['Retirement Planning', 'Tax Optimization', 'Estate Planning', 'Investment Portfolio Management', 'Risk Management', 'Insurance Planning'],
    languages: ['English', 'Afrikaans', 'Xhosa'],
    rating: 4.9,
    reviewCount: 89,
    officeHours: 'Monday - Friday, 8:00 AM - 5:00 PM',
    bio: 'Sarah is a seasoned financial planner with over 12 years of experience helping South African families achieve their financial goals. She specializes in comprehensive financial planning with a focus on retirement preparation and tax-efficient investment strategies. Sarah holds the prestigious CFP® designation and is committed to providing transparent, client-focused financial advice. She has helped over 150 clients navigate complex financial decisions and build sustainable wealth.',
    lastContact: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    nextScheduledMeeting: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    totalMeetings: 18,
    averageMeetingDuration: '45 minutes',
    linkedinUrl: 'https://linkedin.com/in/sarah-johnson-cfp',
    joinedDate: new Date('2023-06-15'),
    clientSatisfactionScore: 4.9,
    responseTime: '< 2 hours'
  } : {
    name: '',
    title: '',
    photo: '',
    email: '',
    phone: '',
    directLine: '',
    location: '',
    yearsExperience: 0,
    clientsServed: 0,
    qualifications: [],
    specializations: [],
    languages: [],
    rating: 0,
    reviewCount: 0,
    officeHours: '',
    bio: '',
    lastContact: null,
    nextScheduledMeeting: null,
    totalMeetings: 0,
    averageMeetingDuration: '',
    linkedinUrl: '',
    joinedDate: null,
    clientSatisfactionScore: 0,
    responseTime: ''
  };

  const isAdviserAssigned = user?.adviserAssigned;

  // Mock meeting history data - expanded for full experience
  const meetingHistory = isAdviserAssigned ? [
    {
      id: 1,
      date: new Date('2024-12-15'),
      type: 'Annual Portfolio Review',
      duration: '60 minutes',
      status: 'completed',
      summary: 'Comprehensive review of portfolio performance, rebalancing recommendations, and 2025 strategy planning. Discussed market outlook and risk tolerance reassessment.',
      documents: [
        { name: 'Portfolio Performance Report Q4 2024.pdf', size: '2.4 MB', type: 'report' },
        { name: 'Investment Recommendations 2025.pdf', size: '1.8 MB', type: 'recommendations' },
        { name: 'Meeting Notes - Annual Review.pdf', size: '0.9 MB', type: 'notes' }
      ],
      participants: ['Sarah Johnson', 'Michael Chen (Operations)', 'John Smith (Client)'],
      objectives: ['Review portfolio performance', 'Discuss rebalancing strategy', 'Plan for 2025 goals', 'Assess risk tolerance'],
      outcomes: ['Approved portfolio rebalancing', 'Increased RA contribution by R2,000', 'Set up tax-loss harvesting', 'Scheduled quarterly check-ins'],
      meetingType: 'video_call',
      rating: 5
    },
    {
      id: 2,
      date: new Date('2024-11-20'),
      type: 'Tax Planning Session',
      duration: '45 minutes',
      status: 'completed',
      summary: 'Year-end tax planning strategies, retirement contribution optimization, and estate planning updates. Reviewed SARS submissions and tax certificates.',
      documents: [
        { name: 'Tax Planning Strategy 2024.pdf', size: '1.9 MB', type: 'strategy' },
        { name: 'Estate Planning Updates.pdf', size: '2.1 MB', type: 'legal' },
        { name: 'Tax Certificates 2024.pdf', size: '1.2 MB', type: 'certificates' }
      ],
      participants: ['Sarah Johnson', 'John Smith (Client)'],
      objectives: ['Optimize tax-deferred contributions', 'Review estate planning documents', 'Plan year-end strategies', 'Prepare SARS documentation'],
      outcomes: ['Maximized RA contributions', 'Updated will and trust documents', 'Implemented tax-loss harvesting', 'Prepared tax submission package'],
      meetingType: 'in_person',
      rating: 5
    }
  ] : [];

  // Mock communication timeline data - expanded for full experience
  const communicationHistory = isAdviserAssigned ? [
    {
      id: 1,
      date: new Date('2025-01-25'),
      type: 'email',
      subject: 'Market Update: January 2025 Economic Outlook',
      summary: 'Monthly market commentary and economic outlook for the first quarter, including insights on rand strength and JSE performance.',
      status: 'delivered',
      attachments: ['Market Outlook Jan 2025.pdf', 'JSE Performance Summary.pdf'],
      priority: 'normal'
    },
    {
      id: 2,
      date: new Date('2025-01-20'),
      type: 'message',
      subject: 'Tax Certificate Request Follow-up',
      summary: 'Confirmation that tax certificates have been generated and are available for download in your secure portal.',
      status: 'read',
      priority: 'normal'
    }
  ] : [];

  // Generate time slots for next week
  const generateTimeSlots = () => {
    const slots = [];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    for (let i = 0; i < 5; i++) { // Monday to Friday
      const date = new Date(nextWeek);
      date.setDate(date.getDate() + i);
      
      const times = ['10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
      times.forEach(time => {
        const slot = `${date.toLocaleDateString('en-ZA', { weekday: 'long', month: 'short', day: 'numeric' })} at ${time}`;
        slots.push(slot);
      });
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  const handleTimeSlotToggle = (slot: string) => {
    setSelectedTimeSlots(prev => {
      if (prev.includes(slot)) {
        return prev.filter(s => s !== slot);
      } else if (prev.length < 3) {
        return [...prev, slot];
      }
      return prev;
    });
  };

  const handleScheduleMeeting = () => {
    if (selectedTimeSlots.length === 3 && meetingPurpose) {
      setScheduleMeetingOpen(false);
      setSelectedTimeSlots([]);
      setMeetingPurpose('');
      alert('Meeting request submitted! Sarah\'s PA will contact you within 24 hours to confirm the best time slot.');
    }
  };

  const handleSendMessage = () => {
    if (messageContent.trim()) {
      setMessageAdviserOpen(false);
      setMessageContent('');
      alert('Message sent successfully! Sarah will respond within 24 hours.');
    }
  };

  const formatDate = (date: Date | null) => {
    if (!date) return '';
    return date.toLocaleDateString('en-ZA', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const formatRelativeDate = (date: Date | null) => {
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

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'report': return <BarChart3 className="h-4 w-4 text-blue-600" />;
      case 'recommendations': return <Target className="h-4 w-4 text-purple-600" />;
      case 'strategy': return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'legal': return <Shield className="h-4 w-4 text-red-600" />;
      case 'analysis': return <PieChart className="h-4 w-4 text-orange-600" />;
      case 'forms': return <FileCheck className="h-4 w-4 text-gray-600" />;
      case 'assessment': return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case 'notes': return <BookOpen className="h-4 w-4 text-indigo-600" />;
      case 'certificates': return <Award className="h-4 w-4 text-yellow-600" />;
      default: return <FileText className="h-4 w-4 text-gray-600" />;
    }
  };

  const getCommunicationIcon = (type: string) => {
    switch (type) {
      case 'email': return <Mail className="h-4 w-4 text-blue-600" />;
      case 'message': return <MessageCircle className="h-4 w-4 text-purple-600" />;
      case 'call': return <Phone className="h-4 w-4 text-green-600" />;
      case 'meeting_confirmation': return <Calendar className="h-4 w-4 text-orange-600" />;
      case 'document_upload': return <Upload className="h-4 w-4 text-gray-600" />;
      default: return <MessageSquare className="h-4 w-4 text-gray-600" />;
    }
  };

  const getMeetingTypeIcon = (type: string) => {
    switch (type) {
      case 'video_call': return <Video className="h-4 w-4 text-blue-600" />;
      case 'phone_call': return <Phone className="h-4 w-4 text-green-600" />;
      case 'in_person': return <Users className="h-4 w-4 text-purple-600" />;
      default: return <Calendar className="h-4 w-4 text-gray-600" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return <Badge className="bg-red-100 text-red-800 text-xs">High Priority</Badge>;
      case 'normal': return <Badge variant="outline" className="text-xs">Normal</Badge>;
      case 'low': return <Badge variant="outline" className="text-gray-500 text-xs">Low</Badge>;
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-black">My Adviser</h1>
          <p className="text-gray-600 mt-2">
            Your dedicated financial adviser and professional relationship hub
          </p>
        </div>

        {/* Adviser Profile Card - Top Section */}
        <Card className="border-gray-200 mb-8">
          <CardContent className="pt-6">
            {!isAdviserAssigned ? (
              /* No Adviser Assigned State */
              <div className="text-center py-12">
                <div className="w-24 h-24 bg-gray-100 rounded-full mx-auto mb-6 flex items-center justify-center">
                  <User className="h-12 w-12 text-gray-400" />
                </div>
                <h2 className="text-2xl font-bold text-black mb-4">Adviser Assignment in Progress</h2>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  You have not been assigned a financial adviser yet. One will be allocated to you shortly.
                </p>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 max-w-lg mx-auto">
                  <div className="flex items-center space-x-2 text-blue-800 mb-2">
                    <Info className="h-4 w-4" />
                    <span className="text-sm font-medium">What happens next?</span>
                  </div>
                  <p className="text-sm text-blue-700">
                    Our team is carefully matching you with the most suitable adviser based on your profile and needs. 
                    This typically takes 24-48 hours after account approval.
                  </p>
                </div>
              </div>
            ) : (
              /* Adviser Assigned State */
              <div className="grid lg:grid-cols-3 gap-8">
                {/* Adviser Details */}
                <div className="lg:col-span-2">
                  <div className="flex items-start space-x-6">
                    <div className="relative">
                      <Avatar className="h-24 w-24">
                        <ImageWithFallback 
                          src={adviserData.photo}
                          alt={adviserData.name}
                          className="w-full h-full object-cover"
                        />
                        <AvatarFallback className="bg-purple-100 text-purple-700 text-xl">
                          {adviserData.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                        <UserCheck className="h-3 w-3 text-white" />
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h2 className="text-2xl font-bold text-black">{adviserData.name}</h2>
                        <Badge className="bg-purple-100 text-purple-800">Primary Adviser</Badge>
                        <Badge variant="outline" className="border-green-200 text-green-700">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Verified
                        </Badge>
                      </div>
                      
                      <p className="text-lg text-gray-700 mb-3">{adviserData.title}</p>
                      
                      <div className="grid md:grid-cols-2 gap-4 mb-4">
                        <div className="flex items-center space-x-2">
                          <Star className="h-4 w-4 text-yellow-500 fill-current" />
                          <span className="text-sm font-medium">{adviserData.rating}/5</span>
                          <span className="text-sm text-gray-600">({adviserData.reviewCount} reviews)</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Award className="h-4 w-4 text-purple-600" />
                          <span className="text-sm text-gray-600">{adviserData.yearsExperience} years experience</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Users className="h-4 w-4 text-blue-600" />
                          <span className="text-sm text-gray-600">{adviserData.clientsServed}+ clients served</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4 text-gray-600" />
                          <span className="text-sm text-gray-600">{adviserData.location}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-orange-600" />
                          <span className="text-sm text-gray-600">Response: {adviserData.responseTime}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Handshake className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-gray-600">Since {formatDate(adviserData.joinedDate)}</span>
                        </div>
                      </div>
                      
                      <p className="text-sm text-gray-600 leading-relaxed mb-4">
                        {adviserData.bio}
                      </p>

                                       </div>
                  </div>
                </div>

                {/* Contact & Actions */}
                <div className="space-y-6">
                  {/* Contact Information */}
                  <div className="space-y-4">
                    <h3 className="font-medium text-black flex items-center">
                      <Phone className="h-4 w-4 mr-2 text-purple-600" />
                      Contact Information
                    </h3>
                    
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <Phone className="h-4 w-4 text-purple-600" />
                        <div>
                          <p className="text-sm font-medium text-black">{adviserData.phone}</p>
                          <p className="text-xs text-gray-500">Main line</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Phone className="h-4 w-4 text-green-600" />
                        <div>
                          <p className="text-sm font-medium text-black">{adviserData.directLine}</p>
                          <p className="text-xs text-gray-500">Direct line</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Mail className="h-4 w-4 text-blue-600" />
                        <div>
                          <p className="text-sm font-medium text-black">{adviserData.email}</p>
                          <p className="text-xs text-gray-500">Email</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <Clock className="h-4 w-4 text-orange-600" />
                        <div>
                          <p className="text-sm font-medium text-black">{adviserData.officeHours}</p>
                          <p className="text-xs text-gray-500">Office hours</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="space-y-3">
                    <Dialog open={scheduleMeetingOpen} onOpenChange={setScheduleMeetingOpen}>
                      <DialogTrigger asChild>
                        <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white">
                          <Calendar className="h-4 w-4 mr-2" />
                          Schedule Meeting
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-2xl">
                        <DialogHeader>
                          <DialogTitle>Schedule a Meeting with {adviserData.name}</DialogTitle>
                          <DialogDescription>
                            Please select 3 available time slots next week (10:00 AM - 4:00 PM). 
                            Your adviser's Personal Assistant will contact you to confirm the best time slot.
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-6">
                          <div>
                            <Label htmlFor="purpose">Meeting Purpose *</Label>
                            <Select value={meetingPurpose} onValueChange={setMeetingPurpose}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select meeting purpose" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="annual_review">Annual Portfolio Review</SelectItem>
                                <SelectItem value="tax_planning">Tax Planning Session</SelectItem>
                                <SelectItem value="investment_review">Investment Strategy Review</SelectItem>
                                <SelectItem value="insurance_review">Insurance Coverage Review</SelectItem>
                                <SelectItem value="estate_planning">Estate Planning Discussion</SelectItem>
                                <SelectItem value="general_consultation">General Financial Consultation</SelectItem>
                                <SelectItem value="urgent_matter">Urgent Financial Matter</SelectItem>
                                <SelectItem value="goal_review">Financial Goals Review</SelectItem>
                                <SelectItem value="market_discussion">Market Discussion</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label>Available Time Slots (Select 3) *</Label>
                            <p className="text-sm text-gray-600 mb-3">
                              Selected: {selectedTimeSlots.length}/3 time slots
                            </p>
                            <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                              {timeSlots.map((slot) => (
                                <div
                                  key={slot}
                                  className={`p-3 border rounded-lg cursor-pointer transition-all ${
                                    selectedTimeSlots.includes(slot)
                                      ? 'border-purple-300 bg-purple-50'
                                      : 'border-gray-200 hover:border-gray-300'
                                  }`}
                                  onClick={() => handleTimeSlotToggle(slot)}
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-sm">{slot}</span>
                                    {selectedTimeSlots.includes(slot) && (
                                      <CheckCircle className="h-4 w-4 text-purple-600" />
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>

                          <Alert className="bg-blue-50 border-blue-200">
                            <Info className="h-4 w-4 text-blue-600" />
                            <AlertDescription className="text-blue-800">
                              Meetings will be conducted via video call or phone. Your adviser's PA will send you 
                              the meeting details and agenda 24 hours before the confirmed time.
                            </AlertDescription>
                          </Alert>
                        </div>

                        <DialogFooter>
                          <Button
                            onClick={handleScheduleMeeting}
                            disabled={selectedTimeSlots.length !== 3 || !meetingPurpose}
                            className="bg-purple-600 hover:bg-purple-700"
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Submit Meeting Request
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Dialog open={messageAdviserOpen} onOpenChange={setMessageAdviserOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full border-purple-600 text-purple-600 hover:bg-purple-50">
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Message Adviser
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Send Message to {adviserData.name}</DialogTitle>
                          <DialogDescription>
                            Send a secure message to your adviser. You'll receive a response within 24 hours.
                          </DialogDescription>
                        </DialogHeader>
                        
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="message">Your Message *</Label>
                            <Textarea
                              id="message"
                              value={messageContent}
                              onChange={(e) => setMessageContent(e.target.value)}
                              placeholder="Type your message here..."
                              rows={6}
                              className="resize-none"
                            />
                            <p className="text-sm text-gray-500 mt-1">
                              {messageContent.length}/1000 characters
                            </p>
                          </div>
                        </div>

                        <DialogFooter>
                          <Button
                            onClick={handleSendMessage}
                            disabled={!messageContent.trim()}
                            className="bg-purple-600 hover:bg-purple-700"
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Send Message
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Button variant="outline" className="w-full border-gray-300 text-gray-700 hover:bg-gray-50">
                      <Phone className="h-4 w-4 mr-2" />
                      Request Call Back
                    </Button>
                  </div>

                        </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Professional Credentials - Show with appropriate content */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card className="border-gray-200">
            <CardContent className="pt-6 text-center">
              <GraduationCap className="h-8 w-8 text-purple-600 mx-auto mb-3" />
              <h3 className="font-medium text-black mb-2">Qualifications</h3>
              <div className="space-y-1">
                {isAdviserAssigned ? (
                  adviserData.qualifications.map((qual, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {qual}
                    </Badge>
                  ))
                ) : (
                  <p className="text-xs text-gray-500">Available once adviser is assigned</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-200">
            <CardContent className="pt-6 text-center">
              <Briefcase className="h-8 w-8 text-blue-600 mx-auto mb-3" />
              <h3 className="font-medium text-black mb-2">Specializations</h3>
              <div className="space-y-1">
                {isAdviserAssigned ? (
                  <div className="contents">
                    {adviserData.specializations.slice(0, 2).map((spec, index) => (
                      <p key={index} className="text-xs text-gray-600">{spec}</p>
                    ))}
                    {adviserData.specializations.length > 2 && (
                      <p className="text-xs text-purple-600">+{adviserData.specializations.length - 2} more</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">Available once adviser is assigned</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-200">
            <CardContent className="pt-6 text-center">
              <Globe className="h-8 w-8 text-green-600 mx-auto mb-3" />
              <h3 className="font-medium text-black mb-2">Languages</h3>
              <div className="space-y-1">
                {isAdviserAssigned ? (
                  adviserData.languages.map((lang, index) => (
                    <p key={index} className="text-xs text-gray-600">{lang}</p>
                  ))
                ) : (
                  <p className="text-xs text-gray-500">Available once adviser is assigned</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-gray-200">
            <CardContent className="pt-6 text-center">
              <Clock className="h-8 w-8 text-orange-600 mx-auto mb-3" />
              <h3 className="font-medium text-black mb-2">Meeting Stats</h3>
              <div className="space-y-1">
                {isAdviserAssigned ? (
                  <div className="contents">
                    <p className="text-xs text-gray-600">{adviserData.totalMeetings} total meetings</p>
                    <p className="text-xs text-gray-600">Avg. {adviserData.averageMeetingDuration}</p>
                    <p className="text-xs text-gray-600">Last: {formatRelativeDate(adviserData.lastContact)}</p>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">Available once adviser is assigned</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs - Show appropriate content */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="meetings">Meeting History</TabsTrigger>
            <TabsTrigger value="communications">Communications</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <Card className="border-gray-200">
              <CardHeader>
                <CardTitle className="text-black">Recent Activity Summary</CardTitle>
                <CardDescription>Latest interactions and important updates</CardDescription>
              </CardHeader>
              <CardContent>
                {isAdviserAssigned ? (
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium text-black mb-3">Last Meeting</h4>
                      <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center space-x-2 mb-2">
                          {getMeetingTypeIcon(meetingHistory[0]?.meetingType)}
                          <span className="text-sm font-medium text-blue-800">
                            {meetingHistory[0]?.type || 'No meetings yet'}
                          </span>
                          <div className="flex">
                            {[...Array(meetingHistory[0]?.rating || 0)].map((_, i) => (
                              <Star key={i} className="h-3 w-3 text-yellow-500 fill-current" />
                            ))}
                          </div>
                        </div>
                        <p className="text-sm text-blue-700">{formatDate(meetingHistory[0]?.date)} • {meetingHistory[0]?.duration}</p>
                        <p className="text-xs text-blue-600 mt-1">{meetingHistory[0]?.summary}</p>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-black mb-3">Recent Communication</h4>
                      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            {getCommunicationIcon(communicationHistory[0]?.type)}
                            <span className="text-sm font-medium text-green-800">
                              {communicationHistory[0]?.subject || 'No communications yet'}
                            </span>
                          </div>
                          {communicationHistory[0]?.priority && getPriorityBadge(communicationHistory[0].priority)}
                        </div>
                        <p className="text-sm text-green-700">{formatDate(communicationHistory[0]?.date)}</p>
                        <p className="text-xs text-green-600 mt-1">{communicationHistory[0]?.summary}</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h4 className="font-medium text-black mb-2">Ready for Your Financial Journey</h4>
                    <p className="text-gray-600 max-w-md mx-auto">
                      Once your adviser is assigned, you'll see your meeting history, communications, and relationship metrics here.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

                      </TabsContent>

          <TabsContent value="meetings" className="space-y-6">
            <Card className="border-gray-200">
              <CardHeader>
                <CardTitle className="text-black">Meeting History</CardTitle>
                <CardDescription>Complete record of all advisory meetings and sessions</CardDescription>
              </CardHeader>
              <CardContent>
                {isAdviserAssigned && meetingHistory.length > 0 ? (
                  <div className="space-y-6">
                    {meetingHistory.map((meeting, index) => (
                      <div key={meeting.id} className="border border-gray-200 rounded-lg p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center space-x-3 mb-2">
                              <h3 className="font-medium text-black">{meeting.type}</h3>
                              <Badge className="bg-green-100 text-green-800">{meeting.status}</Badge>
                              <span className="text-sm text-gray-500">{meeting.duration}</span>
                              {getMeetingTypeIcon(meeting.meetingType)}
                              <div className="flex">
                                {[...Array(meeting.rating)].map((_, i) => (
                                  <Star key={i} className="h-3 w-3 text-yellow-500 fill-current" />
                                ))}
                              </div>
                            </div>
                            <p className="text-sm text-gray-600">{formatDate(meeting.date)}</p>
                          </div>
                          <Button variant="outline" size="sm">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                        </div>

                        <p className="text-sm text-gray-700 mb-4">{meeting.summary}</p>

                        {meeting.documents.length > 0 && (
                          <div>
                            <h4 className="font-medium text-black text-sm mb-3">Meeting Documents</h4>
                            <div className="grid md:grid-cols-2 gap-3">
                              {meeting.documents.map((doc, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                  <div className="flex items-center space-x-3">
                                    {getDocumentIcon(doc.type)}
                                    <div>
                                      <p className="text-sm font-medium text-black">{doc.name}</p>
                                      <p className="text-xs text-gray-500">{doc.size}</p>
                                    </div>
                                  </div>
                                  <Button variant="ghost" size="sm">
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h4 className="font-medium text-black mb-2">No Meetings Yet</h4>
                    <p className="text-gray-600">
                      {isAdviserAssigned 
                        ? "Once you start meeting with your adviser, your meeting history will appear here."
                        : "Your meeting history will appear here once an adviser is assigned."
                      }
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="communications" className="space-y-6">
            <Card className="border-gray-200">
              <CardHeader>
                <CardTitle className="text-black">Communication Timeline</CardTitle>
                <CardDescription>Chronological view of all client-adviser interactions</CardDescription>
              </CardHeader>
              <CardContent>
                {isAdviserAssigned && communicationHistory.length > 0 ? (
                  <div className="space-y-4">
                    {communicationHistory.map((comm, index) => (
                      <div key={comm.id} className="flex items-start space-x-4 p-4 border border-gray-200 rounded-lg">
                        <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                          {getCommunicationIcon(comm.type)}
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-medium text-black">{comm.subject}</h4>
                            <div className="flex items-center space-x-2">
                              {comm.priority && getPriorityBadge(comm.priority)}
                              <Badge variant="outline" className="text-xs">
                                {comm.status}
                              </Badge>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{comm.summary}</p>
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span>{formatDate(comm.date)} • {formatRelativeDate(comm.date)}</span>
                            {comm.attachments && (
                              <span className="flex items-center space-x-1">
                                <FileText className="h-3 w-3" />
                                <span>{comm.attachments.length} attachment(s)</span>
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <Button variant="ghost" size="sm">
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <h4 className="font-medium text-black mb-2">No Communications Yet</h4>
                    <p className="text-gray-600">
                      {isAdviserAssigned 
                        ? "Your communication history with your adviser will appear here."
                        : "Communication history will appear here once an adviser is assigned."
                      }
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}