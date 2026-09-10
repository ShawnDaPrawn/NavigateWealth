import { describe, expect, it } from 'vitest';
import { formToPatch, settingsToForm } from '../assetsModel';
import type { SocialAutomationSettings } from '../assetsTypes';

const settings: SocialAutomationSettings = {
  id: 'default',
  enabled: true,
  assets_per_channel: 5,
  posts_per_channel_per_week: 2,
  channels: ['linkedin', 'x'],
  posting_timezone: 'Africa/Johannesburg',
  site_origin: 'https://www.navigatewealth.co',
  preferred_slots: { linkedin: ['tue 07:30'], x: ['wed 08:00'] },
  style_guide: 'style',
  compliance_rules: 'rules',
  updated_by: null,
  updated_at: '',
};

describe('settings form', () => {
  it('round-trips settings through the form', () => {
    const form = settingsToForm(settings);
    expect(form.slots).toEqual({ linkedin: 'tue 07:30', instagram: '', x: 'wed 08:00' });
    const { patch, error } = formToPatch(form);
    expect(error).toBeUndefined();
    expect(patch).toEqual({
      enabled: true,
      assets_per_channel: 5,
      posts_per_channel_per_week: 2,
      channels: ['linkedin', 'x'],
      posting_timezone: 'Africa/Johannesburg',
      site_origin: 'https://www.navigatewealth.co',
      preferred_slots: { linkedin: ['tue 07:30'], instagram: [], x: ['wed 08:00'] },
      style_guide: 'style',
      compliance_rules: 'rules',
    });
  });

  it('explains each validation failure', () => {
    const form = settingsToForm(settings);
    expect(formToPatch({ ...form, assets_per_channel: '0' }).error).toMatch(/Assets per channel/);
    expect(formToPatch({ ...form, posts_per_channel_per_week: '9' }).error).toMatch(
      /Posts per channel/,
    );
    expect(formToPatch({ ...form, channels: [] }).error).toMatch(/at least one channel/);
    expect(formToPatch({ ...form, site_origin: 'navigatewealth.co' }).error).toMatch(/full URL/);
    expect(formToPatch({ ...form, slots: { ...form.slots, x: 'wednesday 8' } }).error).toMatch(
      /X slot "wednesday 8"/,
    );
  });
});
