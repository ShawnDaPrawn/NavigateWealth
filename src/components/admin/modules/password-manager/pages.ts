/** The pages that open inside the Password Manager, kept in the address bar. */
import { useSearchParams } from 'react-router';

export type Tab = 'logins' | 'skills' | 'agents' | 'activity';

/** Address parameters for the pages that open inside the module. */
export const PAGE_PARAMS = ['login', 'skill', 'skillService', 'skillLogin'] as const;

export function useModulePages() {
  const [params, setParams] = useSearchParams();
  const open = (next: Partial<Record<(typeof PAGE_PARAMS)[number], string>>, tab?: Tab) =>
    setParams((current) => {
      const p = new URLSearchParams(current);
      for (const k of PAGE_PARAMS) p.delete(k);
      for (const [k, v] of Object.entries(next)) if (v) p.set(k, v);
      if (tab) {
        if (tab === 'logins') p.delete('tab');
        else p.set('tab', tab);
      }
      return p;
    });
  return {
    loginId: params.get('login'),
    skillId: params.get('skill'),
    skillService: params.get('skillService'),
    skillLogin: params.get('skillLogin'),
    openLogin: (id: string) => open({ login: id }, 'logins'),
    openSkill: (id: string, from?: { serviceId?: string; loginId?: string }) =>
      open({ skill: id, skillService: from?.serviceId, skillLogin: from?.loginId }),
    close: () => open({}),
  };
}
