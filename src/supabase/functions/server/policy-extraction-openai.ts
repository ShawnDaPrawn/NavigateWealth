/**
 * policy-extraction-openai.ts — raw OpenAI extraction I/O for the policy
 * extraction pipeline (Phase 7 max-lines split). Extracted verbatim from
 * policy-extraction-service.ts: downloads the PDF from Supabase Storage,
 * calls GPT-4o (Responses API with a Chat Completions fallback), and parses
 * the response into canonical ExtractedPolicyData. The service module imports
 * downloadPdfAsBase64 + callOpenAIExtraction from here.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2.49.8';
import { createModuleLogger } from './stderr-logger.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import {
  OPENAI_PRIMARY_MODEL,
  applyChatTokenLimit,
  isResponsesOnlyModel,
} from './ai-model-config.ts';
import type { ExtractedPolicyData } from './policy-extraction-types.ts';

const log = createModuleLogger('policy-extraction-openai');

const POLICY_DOC_BUCKET = 'make-91ed8379-policy-documents';

// ---------------------------------------------------------------------------
// Supabase + OpenAI helpers
// ---------------------------------------------------------------------------

const getSupabase = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

function getOpenAIKey(): string {
  const key = Deno.env.get('OPENAI_API_KEY');
  if (!key) throw new Error('OPENAI_API_KEY not configured on server');
  return key;
}

// ---------------------------------------------------------------------------
// PDF Text Extraction (via OpenAI file processing)
// ---------------------------------------------------------------------------

/**
 * Download a policy PDF from Supabase Storage and return it as a
 * base64-encoded string suitable for the OpenAI API.
 */
export async function downloadPdfAsBase64(storageKey: string): Promise<string> {
  const supabase = getSupabase();

  const { data, error } = await supabase.storage.from(POLICY_DOC_BUCKET).download(storageKey);

  if (error || !data) {
    throw new Error(`Failed to download policy document: ${error?.message || 'Unknown error'}`);
  }

  const buffer = await data.arrayBuffer();
  const uint8 = new Uint8Array(buffer);

  // Convert to base64
  let binary = '';
  for (let i = 0; i < uint8.length; i++) {
    binary += String.fromCharCode(uint8[i]);
  }
  return btoa(binary);
}

// ---------------------------------------------------------------------------
// OpenAI Extraction Call
// ---------------------------------------------------------------------------

/**
 * Send the PDF to OpenAI and extract structured policy data.
 *
 * Strategy:
 *   1. Attempt the Responses API with the PDF as a base64 file attachment
 *   2. Fall back to Chat Completions API if Responses API fails
 */
export async function callOpenAIExtraction(
  pdfBase64: string,
  systemPrompt: string,
): Promise<ExtractedPolicyData> {
  const apiKey = getOpenAIKey();

  // ── Attempt 1: Responses API with file input ──────────────────────
  try {
    const responsesBody = {
      model: OPENAI_PRIMARY_MODEL,
      input: [
        {
          role: 'developer',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: [
            {
              type: 'file',
              file: {
                filename: 'policy_document.pdf',
                file_data: `data:application/pdf;base64,${pdfBase64}`,
              },
            },
            {
              type: 'text',
              text: 'Extract all structured policy data from this document. Return ONLY valid JSON matching the schema described in your instructions.',
            },
          ],
        },
      ],
    };

    const res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(responsesBody),
    });

    if (res.ok) {
      const resJson = await res.json();

      // Extract text from the response output
      let outputText = '';
      if (resJson.output && Array.isArray(resJson.output)) {
        for (const item of resJson.output) {
          if (item.type === 'message' && item.content) {
            for (const block of item.content) {
              if (block.type === 'output_text' || block.type === 'text') {
                outputText += block.text || '';
              }
            }
          }
        }
      }

      if (outputText) {
        return parseExtractionResponse(outputText);
      }

      log.error('Responses API returned OK but no extractable text', { resJson });
    } else {
      const errBody = await res.text();
      log.error('Responses API failed, falling back to Chat Completions', {
        status: res.status,
        body: errBody.substring(0, 500),
      });
    }
  } catch (err) {
    log.error('Responses API error, falling back to Chat Completions:', getErrMsg(err));
  }

  // ── Attempt 2: Chat Completions API ───────────────────────────────
  try {
    const chatBody: Record<string, unknown> = {
      model: OPENAI_PRIMARY_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            {
              type: 'file',
              file: {
                filename: 'policy_document.pdf',
                file_data: `data:application/pdf;base64,${pdfBase64}`,
              },
            },
            {
              type: 'text',
              text: 'Extract all structured policy data from this document. Return ONLY valid JSON matching the schema described in your instructions.',
            },
          ],
        },
      ],
    };
    // Low temperature for extraction accuracy (only for models that accept it)
    if (!isResponsesOnlyModel(OPENAI_PRIMARY_MODEL)) chatBody.temperature = 0.1;
    applyChatTokenLimit(chatBody, OPENAI_PRIMARY_MODEL, 4096);

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(chatBody),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Chat Completions API failed (${res.status}): ${errBody.substring(0, 500)}`);
    }

    const chatJson = await res.json();
    const content = chatJson.choices?.[0]?.message?.content || '';

    if (!content) {
      throw new Error('Chat Completions API returned empty content');
    }

    return parseExtractionResponse(content);
  } catch (err) {
    log.error('Chat Completions extraction also failed:', getErrMsg(err));
    throw new Error(`AI extraction failed: ${getErrMsg(err)}`, { cause: err });
  }
}

// ---------------------------------------------------------------------------
// Response Parsing
// ---------------------------------------------------------------------------

/**
 * Parse the raw AI response text into an ExtractedPolicyData object.
 * Handles potential markdown fences and malformed JSON gracefully.
 */
function parseExtractionResponse(rawText: string): ExtractedPolicyData {
  // Strip markdown fences if present
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  try {
    const parsed = JSON.parse(cleaned);

    // Validate minimum structure
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('Parsed result is not an object');
    }

    // Ensure benefits is an array
    if (!Array.isArray(parsed.benefits)) {
      parsed.benefits = [];
    }

    // Ensure overallConfidence exists
    if (typeof parsed.overallConfidence !== 'number') {
      // Calculate from available fields
      const confidences: number[] = [];
      for (const key of [
        'policyNumber',
        'providerName',
        'productName',
        'premiumAmount',
        'policyStartDate',
      ]) {
        if (parsed[key]?.confidence !== undefined) {
          confidences.push(parsed[key].confidence);
        }
      }
      for (const benefit of parsed.benefits) {
        if (benefit.canonicalType?.confidence !== undefined) {
          confidences.push(benefit.canonicalType.confidence);
        }
      }
      parsed.overallConfidence =
        confidences.length > 0
          ? confidences.reduce((a: number, b: number) => a + b, 0) / confidences.length
          : 0.5;
    }

    return parsed as ExtractedPolicyData;
  } catch (parseErr) {
    log.error('Failed to parse extraction JSON:', {
      error: getErrMsg(parseErr),
      rawText: cleaned.substring(0, 500),
    });
    throw new Error(`Failed to parse AI extraction response: ${getErrMsg(parseErr)}`, {
      cause: parseErr,
    });
  }
}

// ---------------------------------------------------------------------------
// Provider Terminology Application
// ---------------------------------------------------------------------------

/**
 * Apply provider-specific terminology mappings to the extracted data.
 * If a provider has a stored terminology map, we use it to refine
 * the canonical benefit types.
 */
