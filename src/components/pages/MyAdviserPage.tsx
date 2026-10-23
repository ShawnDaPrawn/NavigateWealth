import { useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback } from '../ui/avatar';
import { ImageWithFallback } from '../shared/ImageWithFallback';
import { useAuth } from '../auth/AuthContext';
import {
  User,
  Phone,
  Mail,
  Clock,
  Award,
  UserCheck,
  MapPin,
  Globe,
  Briefcase,
  Info,
} from 'lucide-react';

import type { AdviserCommunication, AdviserMeeting } from './myAdviserPageShared';
import { COMPANY, FOUNDER } from '@/config/companyFacts';
import { getOptimizedImageUrl } from '../../utils/optimizedImages';
import { AdviserQuickActionDialogs } from './AdviserQuickActionDialogs';
import { AdviserContentTabs } from './AdviserContentTabs';

export function MyAdviserPage() {
  const { user } = useAuth();
  const [scheduleMeetingOpen, setScheduleMeetingOpen] = useState(false);
  const [messageAdviserOpen, setMessageAdviserOpen] = useState(false);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>([]);
  const [meetingPurpose, setMeetingPurpose] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  // Navigate Wealth is founder-led: an assigned client's adviser is the
  // founder. Every detail comes from companyFacts — this page used to show a
  // made-up adviser profile (with invented credentials, ratings, an office the
  // firm does not have, and mock meetings and messages) to every approved client.
  const isAdviserAssigned = Boolean(user?.adviserAssigned);
  const adviserData = {
    name: FOUNDER.name,
    title: `${FOUNDER.title}, ${COMPANY.tradingName}`,
    photo: getOptimizedImageUrl(FOUNDER.imageKey, 480, 'webp'),
    email: COMPANY.email,
    phone: COMPANY.phone.display,
    phoneHref: COMPANY.phone.tel,
    location: COMPANY.office,
    specializations: [
      'Financial Planning',
      'Retirement Planning',
      'Investment Management',
      'Risk Management',
      'Estate Planning',
      'Medical Aid',
    ],
    languages: [...COMPANY.languages],
    officeHours: COMPANY.officeHours.label,
    bio: FOUNDER.note[1],
  };

  // Meeting and message history will appear here once it is recorded against
  // the client; until then the tabs show their empty states rather than
  // invented meetings.
  const meetingHistory: AdviserMeeting[] = [];
  const communicationHistory: AdviserCommunication[] = [];

  // Generate time slots for next week
  const generateTimeSlots = () => {
    const slots: string[] = [];
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    for (let i = 0; i < 5; i++) {
      // Monday to Friday
      const date = new Date(nextWeek);
      date.setDate(date.getDate() + i);

      const times = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'];
      times.forEach((time) => {
        const slot = `${date.toLocaleDateString('en-ZA', { weekday: 'long', month: 'short', day: 'numeric' })} at ${time}`;
        slots.push(slot);
      });
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  const handleTimeSlotToggle = (slot: string) => {
    setSelectedTimeSlots((prev) => {
      if (prev.includes(slot)) {
        return prev.filter((s) => s !== slot);
      } else if (prev.length < 3) {
        return [...prev, slot];
      }
      return prev;
    });
  };

  // Requests go to the firm's mailbox through the client's own email app, so
  // nothing claims to have been sent when it has not.
  const openEmail = (subject: string, body: string) => {
    window.location.href = `mailto:${COMPANY.email}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
  };

  const handleScheduleMeeting = () => {
    if (selectedTimeSlots.length === 3 && meetingPurpose) {
      openEmail(
        'Meeting request',
        `Purpose: ${meetingPurpose}\n\nPreferred times:\n${selectedTimeSlots
          .map((slot) => `- ${slot}`)
          .join('\n')}`,
      );
      setScheduleMeetingOpen(false);
      setSelectedTimeSlots([]);
      setMeetingPurpose('');
    }
  };

  const handleSendMessage = () => {
    if (messageContent.trim()) {
      openEmail('Message for my adviser', messageContent.trim());
      setMessageAdviserOpen(false);
      setMessageContent('');
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
                <h2 className="text-2xl font-bold text-black mb-4">
                  Adviser Assignment in Progress
                </h2>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  You have not been assigned a financial adviser yet. One will be allocated to you
                  shortly.
                </p>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200 max-w-lg mx-auto">
                  <div className="flex items-center space-x-2 text-blue-800 mb-2">
                    <Info className="h-4 w-4" />
                    <span className="text-sm font-medium">What happens next?</span>
                  </div>
                  <p className="text-sm text-blue-700">
                    We are setting up your adviser relationship. This typically takes 24–48 hours
                    after account approval.
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
                          {adviserData.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                        <UserCheck className="h-3 w-3 text-white" />
                      </div>
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h2 className="text-2xl font-bold text-black">{adviserData.name}</h2>
                        <Badge className="bg-purple-100 text-purple-800">Your Adviser</Badge>
                      </div>

                      <p className="text-lg text-gray-700 mb-3">{adviserData.title}</p>

                      <div className="grid md:grid-cols-2 gap-4 mb-4">
                        <div className="flex items-center space-x-2">
                          <MapPin className="h-4 w-4 text-gray-600" />
                          <span className="text-sm text-gray-600">{adviserData.location}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Clock className="h-4 w-4 text-orange-600" />
                          <span className="text-sm text-gray-600">{adviserData.officeHours}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Globe className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-gray-600">
                            {adviserData.languages.join(' and ')}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Award className="h-4 w-4 text-purple-600" />
                          <span className="text-sm text-gray-600">
                            FSCA-authorised FSP {COMPANY.fspNumber}
                          </span>
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
                          <p className="text-xs text-gray-500">Office line</p>
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
                          <p className="text-sm font-medium text-black">
                            {adviserData.officeHours}
                          </p>
                          <p className="text-xs text-gray-500">Office hours</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="space-y-3">
                    <AdviserQuickActionDialogs
                      adviserData={adviserData}
                      scheduleMeetingOpen={scheduleMeetingOpen}
                      setScheduleMeetingOpen={setScheduleMeetingOpen}
                      messageAdviserOpen={messageAdviserOpen}
                      setMessageAdviserOpen={setMessageAdviserOpen}
                      timeSlots={timeSlots}
                      selectedTimeSlots={selectedTimeSlots}
                      handleTimeSlotToggle={handleTimeSlotToggle}
                      meetingPurpose={meetingPurpose}
                      setMeetingPurpose={setMeetingPurpose}
                      messageContent={messageContent}
                      setMessageContent={setMessageContent}
                      handleScheduleMeeting={handleScheduleMeeting}
                      handleSendMessage={handleSendMessage}
                    />

                    <Button
                      variant="outline"
                      className="w-full border-gray-300 text-gray-700 hover:bg-gray-50"
                      asChild
                    >
                      <a href={adviserData.phoneHref}>
                        <Phone className="h-4 w-4 mr-2" />
                        Call the Office
                      </a>
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
              <Award className="h-8 w-8 text-purple-600 mx-auto mb-3" />
              <h3 className="font-medium text-black mb-2">Regulation</h3>
              <div className="space-y-1">
                <p className="text-xs text-gray-600">FSCA-authorised</p>
                <p className="text-xs text-gray-600">FSP {COMPANY.fspNumber}</p>
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
                      <p key={index} className="text-xs text-gray-600">
                        {spec}
                      </p>
                    ))}
                    {adviserData.specializations.length > 2 && (
                      <p className="text-xs text-purple-600">
                        +{adviserData.specializations.length - 2} more
                      </p>
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
                    <p key={index} className="text-xs text-gray-600">
                      {lang}
                    </p>
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
              <h3 className="font-medium text-black mb-2">Office Hours</h3>
              <div className="space-y-1">
                <p className="text-xs text-gray-600">{adviserData.officeHours}</p>
                <p className="text-xs text-gray-600">In person or online</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs - Show appropriate content */}
        <AdviserContentTabs
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          isAdviserAssigned={isAdviserAssigned}
          meetingHistory={meetingHistory}
          communicationHistory={communicationHistory}
        />
      </div>
    </div>
  );
}

export default MyAdviserPage;
