/**
 * Email template for article notifications
 *
 * Uses the shared `createEmailTemplate` base layout from email-service.ts
 * to ensure consistent branding, footer settings, and visual language
 * across all transactional emails (Guidelines §8 — Design System adherence).
 *
 * The footer is NOT hardcoded here — it comes from `BASE_EMAIL_TEMPLATE`
 * via `createEmailTemplate`, which respects admin-configured footer settings.
 */

import { createEmailTemplate, getFooterSettings } from './email-service.ts';

export async function createArticleNotificationEmail(data: {
  firstName: string;
  articleTitle: string;
  articleExcerpt: string;
  articleUrl: string;
  unsubscribeUrl?: string;
}): Promise<{ html: string; text: string }> {
  const { firstName, articleTitle, articleExcerpt, articleUrl, unsubscribeUrl } = data;

  const footerSettings = await getFooterSettings();

  const greeting = firstName ? `Hi ${firstName},` : '';

  const bodyContent = `
    <p style="font-size:14px; color:#6b7280; margin-bottom:28px;">
      We've just published a new insight for you on the Navigate Wealth platform.
    </p>

    <div style="
      font-size:14px;
      color:#374151;
      line-height:1.6;
      text-align:center;
      margin:0 auto 28px auto;
      max-width:100%;
      border-radius:10px;
      background-color:#f9fafb;
      border:1px solid #e5e7eb;
      padding:20px 24px;
    ">
      <p style="margin:0 0 10px 0; font-size:15px; font-weight:bold; color:#111827;">
        ${articleTitle}
      </p>
      <p style="margin:0; font-size:14px; color:#4b5563;">
        ${articleExcerpt}
      </p>
    </div>
  `;

  const html = createEmailTemplate(bodyContent, {
    title: 'New article now available',
    greeting,
    buttonUrl: articleUrl,
    buttonLabel: 'Read the full article',
    unsubscribeLink: unsubscribeUrl,
    footerSettings,
  });

  const text = `
New Article Published - Navigate Wealth

${greeting ? greeting + '\n\n' : ''}We've just published a new insight for you on the Navigate Wealth platform.

${articleTitle}

${articleExcerpt}

Read the full article: ${articleUrl}
${unsubscribeUrl ? `\n---\nUnsubscribe: ${unsubscribeUrl}` : ''}

---

Navigate Wealth
Independent Financial Advisory Services
Email: info@navigatewealth.co

© ${new Date().getFullYear()} Navigate Wealth. All rights reserved.
  `.trim();

  return { html, text };
}
