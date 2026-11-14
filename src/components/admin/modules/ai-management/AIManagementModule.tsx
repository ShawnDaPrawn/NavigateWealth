/**
 * AI Management Module
 *
 * Control plane for Vasco and the other AI assistants. Five tabs, each with
 * one job:
 *
 *   Overview   — switch Vasco on/off, see usage, list the assistants
 *   Knowledge  — what Vasco can draw on (articles + knowledge base entries)
 *   Prompts    — the instructions that shape how each assistant answers
 *   Feedback   — ratings people gave to answers
 *   Leads      — visitors who asked to speak to an adviser
 *
 * The tab is in the address (?tab=knowledge). A knowledge base entry being
 * created or edited is a page of its own (?tab=knowledge&entry=new|<id>): the
 * module header and tabs step aside while it is open.
 *
 * Guidelines: §7, §8.3, §8.4
 */

import { useSearchParams } from 'react-router';
import { Tabs, TabsContent } from '../../../ui/tabs';
import {
  NavTabsList,
  NavTabsTrigger,
  PageHeader,
  useBreadcrumbTrail,
  useUrlState,
} from '../../layout/page';
import { KB_ENTRY_PARAM, TAB_CONFIG } from './constants';
import { OverviewTab } from './components/OverviewTab';
import { KnowledgeBase } from './components/KnowledgeBase';
import { PromptStudio } from './components/PromptStudio';
import { FeedbackReview } from './components/FeedbackReview';
import { HandoffQueue } from './components/HandoffQueue';
import { useHandoffs } from './hooks';
import type { AIManagementTab } from './types';

const AI_TABS = TAB_CONFIG.map((tab) => tab.id) as readonly AIManagementTab[];

export function AIManagementModule() {
  const [activeTab, setActiveTab] = useUrlState<AIManagementTab>('tab', 'overview', AI_TABS);
  const [searchParams, setSearchParams] = useSearchParams();
  // Same query the Overview's "Leads waiting" figure uses, so it is shared.
  const { data: newLeads } = useHandoffs('new');

  // A knowledge entry form is open: it is the page.
  const entryPageOpen = activeTab === 'knowledge' && searchParams.has(KB_ENTRY_PARAM);

  // Top-bar breadcrumb: AI Management / <tab> (/ New entry or Edit entry).
  const tabLabel = TAB_CONFIG.find((tab) => tab.id === activeTab)?.label ?? '';
  useBreadcrumbTrail(
    entryPageOpen
      ? [
          {
            label: tabLabel,
            onClick: () =>
              setSearchParams((current) => {
                const params = new URLSearchParams(current);
                params.delete(KB_ENTRY_PARAM);
                return params;
              }),
          },
          { label: searchParams.get(KB_ENTRY_PARAM) === 'new' ? 'New entry' : 'Edit entry' },
        ]
      : [{ label: tabLabel }],
  );

  return (
    <div className="min-h-screen pb-10">
      <div className="mx-auto max-w-[1800px] space-y-6 p-6 lg:p-8">
        {!entryPageOpen && (
          <PageHeader
            title="AI Management"
            description="Switch Vasco on or off, manage what it knows, and shape how it answers."
          />
        )}

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as AIManagementTab)}
          className="gap-6"
        >
          {!entryPageOpen && (
            <NavTabsList aria-label="AI Management sections">
              {TAB_CONFIG.map((tab) => (
                <NavTabsTrigger
                  key={tab.id}
                  value={tab.id}
                  title={tab.description}
                  count={tab.id === 'leads' && newLeads?.length ? newLeads.length : undefined}
                >
                  {tab.label}
                </NavTabsTrigger>
              ))}
            </NavTabsList>
          )}

          <TabsContent value="overview">
            <OverviewTab onNavigate={setActiveTab} />
          </TabsContent>
          <TabsContent value="knowledge">
            <KnowledgeBase />
          </TabsContent>
          <TabsContent value="prompts">
            <PromptStudio />
          </TabsContent>
          <TabsContent value="feedback">
            <FeedbackReview />
          </TabsContent>
          <TabsContent value="leads">
            <HandoffQueue />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
