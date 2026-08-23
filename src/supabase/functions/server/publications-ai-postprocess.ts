/**
 * Post-processing for the publications AI writing service: shaping raw
 * model output per action and HTML cleanup. Moved verbatim from
 * publications-ai-service.ts.
 */
import type { AIAction, AIWritingResponse } from './publications-ai-model.ts';

export function postProcess(
  action: AIAction,
  rawText: string,
  tokensUsed: number,
): AIWritingResponse {
  switch (action) {
    case 'headline': {
      try {
        const headlines = JSON.parse(rawText);
        return {
          result: headlines[0] || rawText,
          suggestions: Array.isArray(headlines) ? headlines : [rawText],
          action,
          tokensUsed,
        };
      } catch {
        // If JSON parse fails, split by newlines
        const lines = rawText
          .split('\n')
          .map((l: string) =>
            l
              .replace(/^\d+\.\s*/, '')
              .replace(/^["']|["']$/g, '')
              .trim(),
          )
          .filter(Boolean);
        return {
          result: lines[0] || rawText,
          suggestions: lines.length > 1 ? lines : [rawText],
          action,
          tokensUsed,
        };
      }
    }

    case 'compliance_check': {
      try {
        const parsed = JSON.parse(rawText);
        return {
          result: parsed.summary || 'Compliance review complete.',
          warnings: parsed.issues?.map(
            (i: { text: string; issue: string; severity: string; suggestion: string }) =>
              `[${i.severity?.toUpperCase()}] ${i.issue}: "${i.text}" — ${i.suggestion}`,
          ),
          suggestions: [
            parsed.overallRisk ? `Overall risk: ${parsed.overallRisk}` : 'Review complete',
          ],
          action,
          tokensUsed,
        };
      } catch {
        return {
          result: rawText,
          action,
          tokensUsed,
        };
      }
    }

    case 'seo_optimize': {
      try {
        const parsed = JSON.parse(rawText);
        return {
          result: parsed.metaDescription || rawText,
          suggestions: [
            parsed.seoTitle && `SEO Title: ${parsed.seoTitle}`,
            parsed.readabilityScore && `Readability: ${parsed.readabilityScore}`,
            ...(parsed.improvements || []),
            ...(parsed.suggestedKeywords?.map((k: string) => `Keyword: ${k}`) || []),
          ].filter(Boolean),
          action,
          tokensUsed,
        };
      } catch {
        return { result: rawText, action, tokensUsed };
      }
    }

    case 'generate_callout': {
      try {
        const parsed = JSON.parse(rawText);
        return {
          result: parsed.content || rawText,
          suggestions: [parsed.type || 'takeaway'],
          action,
          tokensUsed,
        };
      } catch {
        return { result: rawText, suggestions: ['takeaway'], action, tokensUsed };
      }
    }

    case 'excerpt':
      return {
        result: rawText.replace(/<[^>]+>/g, '').slice(0, 250),
        action,
        tokensUsed,
      };

    default:
      return {
        result: cleanHTML(rawText),
        action,
        tokensUsed,
      };
  }
}

/**
 * Strip markdown code fences and ensure valid HTML output.
 */
export function cleanHTML(text: string): string {
  let cleaned = text
    .replace(/^```html?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();

  // If the result doesn't contain any HTML tags, wrap in <p>
  if (!/<[a-z][\s\S]*>/i.test(cleaned)) {
    cleaned = cleaned
      .split('\n\n')
      .map((para: string) => `<p>${para.trim()}</p>`)
      .join('\n');
  }

  return cleaned;
}
