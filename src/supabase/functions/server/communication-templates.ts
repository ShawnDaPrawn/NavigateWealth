/**
 * Email templates and the shared footer settings.
 *
 * Split out of `communication-service.ts` (1,387 lines), a stateless class whose
 * `this.` only ever called a sibling method. The class remains as a facade with
 * field assignments; the logger keeps its channel name.
 */
import { createModuleLogger } from './stderr-logger.ts';
import * as kv from './kv_store.tsx';
import { NotFoundError } from './error.middleware.ts';
import { DEFAULT_TEMPLATES } from './email-service.ts';
import type { Template } from './communication-types.ts';
import { generateId } from './communication-service-helpers.ts';

const log = createModuleLogger('communication-service');

export async function getAllTemplates(): Promise<Template[]> {
  const kvTemplates = await kv.getByPrefix('email_template:');

  // If no templates in KV store, seed with defaults
  if (!kvTemplates || kvTemplates.length === 0) {
    log.info('No templates found in KV store, seeding defaults');

    const defaultTemplates = Object.values(DEFAULT_TEMPLATES).map((dt) => ({
      id: dt.id,
      name: dt.name,
      subject: dt.subject,
      content: dt.bodyHtml,
      title: dt.title,
      subtitle: dt.subtitle,
      greeting: dt.greeting,
      buttonLabel: dt.buttonLabel,
      buttonUrl: dt.buttonUrl,
      footerNote: dt.footerNote,
      enabled: dt.enabled,
      category: dt.id === 'general_campaign' ? 'marketing' : 'transactional',
      isSystem: true,
      createdAt: new Date().toISOString(),
    }));

    // Save default templates to KV store
    for (const template of defaultTemplates) {
      await kv.set(`email_template:${template.id}`, template);
    }

    log.success('Seeded default templates', { count: defaultTemplates.length });

    return defaultTemplates;
  }

  // Check if any default templates are missing and add them
  const existingIds = new Set(kvTemplates.map((t: Template) => t.id));
  const missingTemplates: Template[] = [];

  for (const [id, dt] of Object.entries(DEFAULT_TEMPLATES)) {
    if (!existingIds.has(id)) {
      const newTemplate: Template = {
        id: dt.id,
        name: dt.name,
        subject: dt.subject,
        content: dt.bodyHtml,
        title: dt.title,
        subtitle: dt.subtitle,
        greeting: dt.greeting,
        buttonLabel: dt.buttonLabel,
        buttonUrl: dt.buttonUrl,
        footerNote: dt.footerNote,
        enabled: dt.enabled,
        category: dt.id === 'general_campaign' ? 'marketing' : 'transactional',
        isSystem: true,
        createdAt: new Date().toISOString(),
      };

      await kv.set(`email_template:${id}`, newTemplate);
      missingTemplates.push(newTemplate);
      log.info('Added missing default template', { templateId: id, name: dt.name });
    }
  }

  if (missingTemplates.length > 0) {
    log.success('Added missing default templates', { count: missingTemplates.length });
    // Refresh the list
    return (await kv.getByPrefix('email_template:')) || [];
  }

  return kvTemplates || [];
}

export async function getTemplateById(id: string): Promise<Template | null> {
  return await kv.get(`email_template:${id}`);
}

export async function createTemplate(data: Partial<Template>): Promise<Template> {
  const templateId = generateId();

  const template: Template = {
    id: templateId,
    name: data.name!,
    subject: data.subject!,
    content: data.content!,
    title: data.title,
    subtitle: data.subtitle,
    greeting: data.greeting,
    buttonLabel: data.buttonLabel,
    buttonUrl: data.buttonUrl,
    footerNote: data.footerNote,
    enabled: data.enabled ?? true,
    category: data.category,
    createdAt: new Date().toISOString(),
  };

  await kv.set(`email_template:${templateId}`, template);

  log.success('Template created', { templateId });

  return template;
}

export async function updateTemplate(id: string, updates: Partial<Template>): Promise<Template> {
  const template = await getTemplateById(id);

  if (!template) {
    throw new NotFoundError('Template not found');
  }

  const updatedTemplate: Template = {
    ...template,
    ...updates,
    id, // Ensure ID doesn't change
    createdAt: template.createdAt, // Ensure createdAt doesn't change
  };

  await kv.set(`email_template:${id}`, updatedTemplate);

  log.success('Template updated', { templateId: id });

  return updatedTemplate;
}

export async function deleteTemplate(id: string): Promise<void> {
  await kv.del(`email_template:${id}`);
  log.success('Template deleted', { templateId: id });
}

export async function getFooterSettings(): Promise<Record<string, unknown>> {
  const settings = await kv.get('email_footer_settings');

  if (!settings) {
    // Return default settings
    return {
      companyName: 'Navigate Wealth',
      address: '',
      contactEmail: '',
      contactPhone: '',
      socialLinks: {},
      copyrightText: '© 2026 Navigate Wealth. All rights reserved.',
    };
  }

  return settings;
}

export async function saveFooterSettings(settings: Record<string, unknown>): Promise<void> {
  await kv.set('email_footer_settings', settings);
  log.success('Email footer settings saved');
}
