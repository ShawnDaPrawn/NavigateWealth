/**
 * Password Manager — the bridge between outside AI agents and the systems the
 * firm signs in to. Super admins only.
 *
 *   Logins     — saved sign-ins, grouped by service (Navigate Wealth first)
 *   Skills     — plain-English instructions agents follow, shared by a
 *                service's logins or belonging to one login
 *   AI agents  — connect Claude, ChatGPT or another MCP client
 *   Activity   — password requests waiting for you, and everything that happened
 *
 * One login (?login=<id>) and one skill (?skill=new|<id>) open as pages of
 * their own: the module header and tabs step aside while they are open.
 */
import { Tabs, TabsContent } from '../../../ui/tabs';
import {
  NavTabsList,
  NavTabsTrigger,
  PageHeader,
  useBreadcrumbTrail,
  useUrlState,
} from '../../layout/page';
import { useApprovals, useLogins, useSkills } from './hooks';
import { LoginsTab } from './LoginsTab';
import { LoginPage } from './LoginPage';
import { SkillsTab } from './SkillsTab';
import { SkillEditor } from './SkillEditor';
import { AgentsTab } from './AgentsTab';
import { ActivityTab } from './ActivityTab';

import { useModulePages, type Tab } from './pages';

const TABS = [
  { id: 'logins', label: 'Logins', description: 'Saved sign-ins, grouped by service' },
  { id: 'skills', label: 'Skills', description: 'Instructions your AI agents follow' },
  { id: 'agents', label: 'AI agents', description: 'Connect Claude, ChatGPT and other agents' },
  { id: 'activity', label: 'Activity', description: 'Requests waiting for you, and the log' },
] as const satisfies readonly { id: Tab; label: string; description: string }[];
const TAB_IDS = TABS.map((t) => t.id) as readonly Tab[];

export function PasswordManagerModule() {
  const [tab, setTab] = useUrlState<Tab>('tab', 'logins', TAB_IDS);
  const pages = useModulePages();
  const { data: approvals } = useApprovals();
  const { data: logins } = useLogins();
  const { data: skills } = useSkills();

  const tabLabel = TABS.find((t) => t.id === tab)?.label ?? '';
  const login = pages.loginId ? logins?.find((l) => l.id === pages.loginId) : undefined;
  const skill =
    pages.skillId && pages.skillId !== 'new'
      ? skills?.find((s) => s.id === pages.skillId)
      : undefined;
  const pageOpen = Boolean(pages.loginId || pages.skillId);

  useBreadcrumbTrail(
    pages.skillId
      ? [
          { label: tabLabel, onClick: pages.close },
          { label: pages.skillId === 'new' ? 'New skill' : (skill?.name ?? 'Skill') },
        ]
      : pages.loginId
        ? [{ label: 'Logins', onClick: pages.close }, { label: login?.name ?? 'Login' }]
        : [{ label: tabLabel }],
  );

  return (
    <div className="min-h-screen pb-10">
      <div className="ds-page">
        {!pageOpen && (
          <PageHeader
            title="Password Manager"
            description="Save the firm’s logins, write the skills your AI agents follow, and connect Claude or ChatGPT to use them."
          />
        )}

        {pages.skillId ? (
          <SkillEditor
            key={pages.skillId}
            skillId={pages.skillId}
            presetServiceId={pages.skillService}
            presetLoginId={pages.skillLogin}
            onClose={pages.close}
          />
        ) : pages.loginId ? (
          <LoginPage
            key={pages.loginId}
            loginId={pages.loginId}
            onClose={pages.close}
            onOpenSkill={pages.openSkill}
          />
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="gap-6">
            <NavTabsList aria-label="Password Manager sections">
              {TABS.map((t) => (
                <NavTabsTrigger
                  key={t.id}
                  value={t.id}
                  title={t.description}
                  count={t.id === 'activity' && approvals?.length ? approvals.length : undefined}
                >
                  {t.label}
                </NavTabsTrigger>
              ))}
            </NavTabsList>
            <TabsContent value="logins">
              <LoginsTab onOpenLogin={pages.openLogin} onOpenSkill={pages.openSkill} />
            </TabsContent>
            <TabsContent value="skills">
              <SkillsTab onOpenSkill={pages.openSkill} />
            </TabsContent>
            <TabsContent value="agents">
              <AgentsTab />
            </TabsContent>
            <TabsContent value="activity">
              <ActivityTab />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
