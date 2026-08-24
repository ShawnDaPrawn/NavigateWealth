/**
 * OpenAI transport for the publications AI writing service: the direct
 * chat call and the article workflow call. Moved verbatim from
 * publications-ai-service.ts.
 */
import { createModuleLogger } from './stderr-logger.ts';

const log = createModuleLogger('publications-ai');
import { BASE_SYSTEM_PROMPT } from './publications-ai-prompts.ts';

export async function callOpenAI(
  systemPrompt: string,
  userPrompt: string,
  options: { temperature?: number; maxTokens?: number } = {},
): Promise<{ text: string; tokensUsed: number }> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const { temperature = 0.7, maxTokens = 2000 } = options;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    log.error('OpenAI API error', { status: response.status, body: errorBody });
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.choices?.[0]?.message?.content?.trim() || '';
  const tokensUsed = data.usage?.total_tokens || 0;

  return { text, tokensUsed };
}

// ---------------------------------------------------------------------------
// OpenAI Responses API (Workflow) Integration
// ---------------------------------------------------------------------------

const ARTICLE_WORKFLOW_ID = 'wf_699c7dc864988190b8897ab9552fe1bc0c5d0a63afa541d1';

export async function callOpenAIWorkflow(
  prompt: string,
): Promise<{ text: string; tokensUsed: number }> {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  log.info('Calling OpenAI Responses API with workflow', { workflowId: ARTICLE_WORKFLOW_ID });

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: ARTICLE_WORKFLOW_ID,
        input: prompt,
      }),
      signal: AbortSignal.timeout(90000), // 90 second timeout for workflow
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'unable to read error body');
      log.error('OpenAI Responses API error — falling back to Chat Completions', {
        status: response.status,
        body: errorBody.slice(0, 500),
      });

      // Fallback to Chat Completions API for ANY error (not just 404/400)
      return callOpenAI(BASE_SYSTEM_PROMPT, prompt, { temperature: 0.7, maxTokens: 4000 });
    }

    const data = await response.json();

    // Responses API returns output array
    let text = '';
    if (data.output) {
      for (const item of data.output) {
        if (item.type === 'message' && item.content) {
          for (const block of item.content) {
            if (block.type === 'output_text' || block.type === 'text') {
              text += block.text;
            }
          }
        }
      }
    }

    // Fallback: try top-level text field
    if (!text && data.output_text) {
      text = data.output_text;
    }

    // If workflow returned empty text, fall back to Chat Completions
    if (!text.trim()) {
      log.error('OpenAI Responses API returned empty text — falling back to Chat Completions');
      return callOpenAI(BASE_SYSTEM_PROMPT, prompt, { temperature: 0.7, maxTokens: 4000 });
    }

    const tokensUsed = data.usage?.total_tokens || 0;

    return { text: text.trim(), tokensUsed };
  } catch (err) {
    // Network errors, timeouts, JSON parse failures — all fall back to Chat Completions
    const errMsg = err instanceof Error ? err.message : String(err);
    log.error('OpenAI Responses API failed with exception — falling back to Chat Completions', {
      error: errMsg,
    });
    return callOpenAI(BASE_SYSTEM_PROMPT, prompt, { temperature: 0.7, maxTokens: 4000 });
  }
}

// ---------------------------------------------------------------------------
// Unsplash Image Search
// ---------------------------------------------------------------------------
