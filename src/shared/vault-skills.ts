/**
 * What an AI agent reads before working with a login, assembled from the
 * platform map, the login's service and its skills. The MCP tool `get_skills`
 * returns this, and the admin screen previews exactly the same text.
 *
 * Order: the platform map (Navigate Wealth only), the skills shared by every
 * login of the service, then the login's own skills, which add to the shared
 * ones and win where they differ.
 */
import {
  NAVIGATE_WEALTH_SERVICE_ID,
  type Service,
  type Skill,
  type VaultSummary,
} from './password-manager.ts';
import { renderPlatformGuide } from './platform-guide.ts';

/** The skills that apply to one login: its service's shared ones, then its own. */
export function skillsFor(login: Pick<VaultSummary, 'id' | 'serviceId'>, all: Skill[]) {
  return {
    shared: all.filter((s) => s.credentialId === null && s.serviceId === login.serviceId),
    own: all.filter((s) => s.credentialId === login.id),
  };
}

function renderOne(s: Skill) {
  return [
    '### ' + s.name,
    ...(s.whenToUse ? ['When to use it: ' + s.whenToUse, ''] : []),
    s.instructions,
  ].join('\n');
}

/** Everything an agent should read before working with a login, as Markdown. */
export function renderSkillsFor(
  login: Pick<VaultSummary, 'id' | 'serviceId' | 'name' | 'url' | 'username'>,
  service: Pick<Service, 'id' | 'name' | 'description'>,
  all: Skill[],
) {
  const { shared, own } = skillsFor(login, all);
  const parts = [
    '# Working with “' + login.name + '” (' + service.name + ')',
    'Website: ' + login.url,
    'Username: ' + (login.username || '—'),
    ...(service.description ? ['', service.description] : []),
  ];
  if (service.id === NAVIGATE_WEALTH_SERVICE_ID) parts.push('', renderPlatformGuide());
  parts.push(
    '',
    '## Skills for every ' + service.name + ' login',
    shared.length
      ? shared.map(renderOne).join('\n\n')
      : 'None written yet. If the task is unclear, ask the person you are working for.',
  );
  if (own.length)
    parts.push(
      '',
      '## Skills for this login only',
      'These add to the shared skills above. Where they differ, follow these.',
      own.map(renderOne).join('\n\n'),
    );
  parts.push(
    '',
    '## Always',
    '- Sign in yourself with the username and password from get_login. Never paste a password into chat or anywhere other than the sign-in page.',
    '- Stop and ask the person you are working for before you submit anything you were not clearly asked to submit.',
  );
  return parts.join('\n');
}
