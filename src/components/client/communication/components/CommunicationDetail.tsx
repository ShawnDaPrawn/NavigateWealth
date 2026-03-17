/**
 * CommunicationDetail — Modal dialog showing full message content.
 *
 * Message content may be HTML from the admin compose editor.
 * Renders HTML via dangerouslySetInnerHTML with scoped prose-like styles.
 * Plain-text messages are rendered with whitespace-pre-wrap.
 *
 * Guidelines refs: §7 (presentation layer), §5.3 (config-driven contact)
 */

import React, { useMemo } from 'react';
import { User, Calendar, Mail, Phone } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../../ui/dialog';
import { Badge } from '../../../ui/badge';
import { Button } from '../../../ui/button';
import { CATEGORY_CONFIG, CONTACT } from '../constants';
import { formatFullDate, isHtmlContent, sanitizeHtml } from '../utils';
import type { Communication, CommunicationCategory } from '../types';

interface CommunicationDetailProps {
  communication: Communication | null;
  onClose: () => void;
}

export function CommunicationDetail({ communication, onClose }: CommunicationDetailProps) {
  if (!communication) return null;

  const cfg = CATEGORY_CONFIG[communication.category as CommunicationCategory] ?? CATEGORY_CONFIG.General;
  const CategoryIcon = cfg.icon;

  const contentIsHtml = useMemo(
    () => isHtmlContent(communication.message),
    [communication.message],
  );

  /** Sanitised HTML — strips XSS vectors while preserving safe formatting */
  const sanitisedMessage = useMemo(
    () => contentIsHtml ? sanitizeHtml(communication.message) : communication.message,
    [communication.message, contentIsHtml],
  );

  return (
    <Dialog open={communication !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[95vw] max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="contents">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-start gap-3 mb-3">
              <div
                className={`h-12 w-12 rounded-lg ${cfg.badgeClass} flex items-center justify-center flex-shrink-0`}
              >
                {React.createElement(CategoryIcon, { className: 'h-6 w-6' })}
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg mb-2 break-words">{communication.subject}</DialogTitle>
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <Badge variant="outline" className={cfg.badgeClass}>
                    {cfg.label}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600 flex-wrap">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 flex-shrink-0" />
                    <span>
                      <strong>From:</strong> {communication.from}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 flex-shrink-0" />
                    <span>{formatFullDate(communication.timestamp)}</span>
                  </div>
                </div>
              </div>
            </div>
          </DialogHeader>

          {/* Message body — scrollable */}
          <div className="flex-1 overflow-y-auto py-6 border-t border-b border-gray-100 min-h-0">
            {contentIsHtml ? (
              <div
                className="comm-html-content text-gray-700 text-sm leading-relaxed break-words overflow-hidden"
                dangerouslySetInnerHTML={{ __html: sanitisedMessage }}
              />
            ) : (
              <p className="text-gray-700 leading-relaxed whitespace-pre-wrap break-words text-sm">
                {communication.message}
              </p>
            )}
          </div>

          {/* Contact actions */}
          <div className="pt-4 flex-shrink-0">
            <h4 className="text-sm font-medium text-gray-900 mb-3">
              Need to respond or have questions?
            </h4>
            <div className="flex gap-3 flex-wrap">
              <Button
                onClick={() => { window.location.href = CONTACT.emailHref; }}
                className="bg-[#6d28d9] hover:bg-[#5b21b6] text-white"
              >
                <Mail className="h-4 w-4 mr-2 flex-shrink-0" />
                Email us: {CONTACT.email}
              </Button>
              <Button
                onClick={() => { window.location.href = CONTACT.phoneTel; }}
                variant="outline"
                className="border-[#6d28d9] text-[#6d28d9] hover:bg-[#6d28d9] hover:text-white"
              >
                <Phone className="h-4 w-4 mr-2 flex-shrink-0" />
                Call us: {CONTACT.phoneNumber}
              </Button>
            </div>
          </div>
        </div>

        {/* Scoped styles for HTML email / rich-text content */}
        <style>{`
          .comm-html-content {
            word-break: break-word;
            overflow-wrap: break-word;
          }
          .comm-html-content h1,
          .comm-html-content h2,
          .comm-html-content h3 {
            font-weight: 600;
            color: #111827;
            margin-top: 1rem;
            margin-bottom: 0.5rem;
            line-height: 1.3;
          }
          .comm-html-content h1 { font-size: 1.125rem; }
          .comm-html-content h2 { font-size: 1rem; }
          .comm-html-content h3 { font-size: 0.875rem; }
          .comm-html-content p {
            margin-bottom: 0.5rem;
            line-height: 1.6;
          }
          .comm-html-content ul,
          .comm-html-content ol {
            margin-bottom: 0.75rem;
            padding-left: 1.5rem;
          }
          .comm-html-content ul { list-style-type: disc; }
          .comm-html-content ol { list-style-type: decimal; }
          .comm-html-content li {
            margin-bottom: 0.25rem;
            line-height: 1.5;
            font-size: 0.875rem;
          }
          .comm-html-content a {
            color: #6d28d9;
            text-decoration: underline;
            word-break: break-all;
          }
          .comm-html-content a:hover {
            color: #5b21b6;
          }
          .comm-html-content blockquote {
            border-left: 3px solid #d1d5db;
            padding-left: 1rem;
            margin: 0.75rem 0;
            color: #4b5563;
            font-style: italic;
          }
          .comm-html-content strong,
          .comm-html-content b {
            font-weight: 600;
          }
          .comm-html-content em,
          .comm-html-content i {
            font-style: italic;
          }
          .comm-html-content img {
            max-width: 100%;
            height: auto;
            border-radius: 0.375rem;
            margin: 0.5rem 0;
          }
          .comm-html-content table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 0.75rem;
          }
          .comm-html-content td,
          .comm-html-content th {
            border: 1px solid #e5e7eb;
            padding: 0.5rem;
            text-align: left;
            font-size: 0.875rem;
          }
          .comm-html-content th {
            background-color: #f9fafb;
            font-weight: 600;
          }
          .comm-html-content hr {
            border: none;
            border-top: 1px solid #e5e7eb;
            margin: 1rem 0;
          }
          .comm-html-content br + br {
            display: block;
            content: "";
            margin-top: 0.5rem;
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}