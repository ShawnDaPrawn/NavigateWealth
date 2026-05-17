/**
 * ContactAdviserCard — Quick-action card for email / phone contact.
 */

import { ArrowUpRight, Headset, Mail, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../ui/card';
import { CONTACT } from '../constants';

export function ContactAdviserCard() {
  return (
    <Card className="overflow-hidden border border-slate-200 bg-white shadow-sm">
      <CardHeader className="space-y-3 pb-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#f5f3ff_0%,#ede9fe_100%)] text-[#6d28d9] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)]">
            <Headset className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Support
            </div>
            <CardTitle className="text-base text-slate-950">Need help?</CardTitle>
          </div>
        </div>
        <p className="text-sm leading-6 text-slate-600">
          Reach the Navigate Wealth team directly if you need help with a message, document, or next step.
        </p>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <button
          type="button"
          onClick={() => { window.location.href = CONTACT.emailHref; }}
          className="group flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-left transition-all hover:border-[#d8b4fe] hover:bg-white hover:shadow-sm"
        >
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white text-[#6d28d9] shadow-sm ring-1 ring-slate-200 transition-colors group-hover:bg-[#f5f3ff]">
            <Mail className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Email</div>
            <div className="truncate text-sm font-semibold text-slate-900">{CONTACT.email}</div>
          </div>
          <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-slate-400 transition-colors group-hover:text-[#6d28d9]" />
        </button>
        <button
          type="button"
          onClick={() => { window.location.href = CONTACT.phoneTel; }}
          className="group flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-left transition-all hover:border-[#c4b5fd] hover:bg-white hover:shadow-sm"
        >
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-white text-[#6d28d9] shadow-sm ring-1 ring-slate-200 transition-colors group-hover:bg-[#f5f3ff]">
            <Phone className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Call</div>
            <div className="text-sm font-semibold text-slate-900">{CONTACT.phoneNumber}</div>
          </div>
          <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-slate-400 transition-colors group-hover:text-[#6d28d9]" />
        </button>
      </CardContent>
    </Card>
  );
}
