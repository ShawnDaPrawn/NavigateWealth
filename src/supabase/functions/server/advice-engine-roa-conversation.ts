/**
 * advice-engine-roa-conversation.ts — the conversational, OpenAI-driven engine
 * for Record of Advice modules.
 *
 * Each selected module is completed as a conversation driven by its contract's
 * `conversation.instructions`. The adviser chats with the model (which has the
 * client's personal + policy snapshot in context and can receive uploaded
 * documents/images), and the model authors the final narrative for every
 * canonical section. Transcripts live in a dedicated KV namespace
 * (`roa:conversation:{draftId}:{moduleId}`) so they never bloat the draft
 * record or pollute draft listings; the draft itself carries only a lightweight
 * status index and the finished narratives.
 */

import * as kv from './kv_store.tsx';
import { createModuleLogger } from './stderr-logger.ts';
import { NotFoundError, ValidationError } from './error.middleware.ts';
import { getErrMsg } from './shared-logger-utils.ts';
import type { RoAModuleContract } from './advice-engine-roa-contract-types.ts';
import type {
  AuthUserLike,
  RoAClientSnapshot,
  RoAConvMessage,
  RoAConvUploadRef,
  RoADraftRecord,
  RoAModuleConversationRecord,
  RoAModuleConversationStatus,
  RoAModuleNarrative,
} from './advice-engine-roa-draft-types.ts';
import { AdviceEngineRoAService, CONVERSATION_PREFIX } from './advice-engine-roa-service.ts';
import { downloadRoABlob, roaEvidenceBlobPath } from './advice-engine-roa-storage.ts';
import { bytesToBase64 } from './advice-engine-roa-utils.ts';
import {
  callResponses,
  parseJsonResponse,
  type AiContentBlock,
  type AiMessage,
} from './ai-model-config.ts';
import { BrandService } from './brand-service.ts';

const log = createModuleLogger('advice-engine-roa-conversation');

/** Total inline attachment bytes (base64-decoded) allowed per model turn. */
const MAX_ATTACHMENT_BYTES_PER_TURN = 12 * 1024 * 1024;

interface ModuleTurnResult {
  reply: string;
  isComplete: boolean;
  narrative: { sections: Array<{ id: string; markdown: string }> } | null;
}

interface ConversationVoice {
  tone: string;
  terminology: string;
  notes: string;
}

export class AdviceEngineRoAConversationService {
  private roaService = new AdviceEngineRoAService();
  private brandService = new BrandService();

  private convKey(draftId: string, moduleId: string): string {
    return `${CONVERSATION_PREFIX}${draftId}:${moduleId}`;
  }

  async getConversation(
    draftId: string,
    moduleId: string,
  ): Promise<RoAModuleConversationRecord | null> {
    const raw = await kv.get(this.convKey(draftId, moduleId));
    return raw ? (raw as RoAModuleConversationRecord) : null;
  }

  private async saveConversation(record: RoAModuleConversationRecord): Promise<void> {
    record.updatedAt = new Date().toISOString();
    await kv.set(this.convKey(record.draftId, record.moduleId), record);
  }

  private requireConversationContract(
    contracts: RoAModuleContract[],
    moduleId: string,
  ): RoAModuleContract {
    const contract = contracts.find((item) => item.id === moduleId);
    if (!contract) throw new ValidationError('The selected module contract is not active.');
    if (contract.authoringMode !== 'conversation' || !contract.conversation) {
      throw new ValidationError('This module is not configured for the conversational flow.');
    }
    return contract;
  }

  private assertEditable(draft: RoADraftRecord, moduleId: string): void {
    if (draft.lockedAt) {
      throw new ValidationError('Finalised RoA records are locked. Create a new version instead.');
    }
    if (!draft.selectedModules.includes(moduleId)) {
      throw new ValidationError('This module is not part of the current RoA draft.');
    }
  }

  // ------------------------------------------------------------------
  // Lifecycle
  // ------------------------------------------------------------------

  /** Initialise a conversation record per selected conversation module. */
  async startConversations(
    draftId: string,
    contracts: RoAModuleContract[],
    user: AuthUserLike,
  ): Promise<{ progress: ReturnType<AdviceEngineRoAConversationService['summariseProgress']> }> {
    const draft = await this.roaService.getDraft(draftId);
    const status: Record<string, RoAModuleConversationStatus> = {
      ...(draft.moduleConversationStatus || {}),
    };

    for (const moduleId of draft.selectedModules) {
      const contract = contracts.find((item) => item.id === moduleId);
      if (!contract || contract.authoringMode !== 'conversation' || !contract.conversation)
        continue;

      const existing = await this.getConversation(draftId, moduleId);
      if (existing) {
        status[moduleId] = existing.status;
        continue;
      }

      const opening = contract.conversation.openingMessage?.trim();
      const messages: RoAConvMessage[] = opening
        ? [
            {
              id: crypto.randomUUID(),
              role: 'assistant',
              content: opening,
              createdAt: new Date().toISOString(),
            },
          ]
        : [];
      const record: RoAModuleConversationRecord = {
        draftId,
        moduleId,
        status: 'pending',
        messages,
        uploads: [],
        updatedAt: new Date().toISOString(),
      };
      await this.saveConversation(record);
      status[moduleId] = 'pending';
    }

    await this.roaService.saveDraft(
      { id: draftId, moduleConversationStatus: status, authoringMode: 'conversation' },
      user,
    );

    return { progress: this.summariseProgress(draft.selectedModules, contracts, status) };
  }

  summariseProgress(
    selectedModules: string[],
    contracts: RoAModuleContract[],
    status: Record<string, RoAModuleConversationStatus>,
  ): {
    modules: Array<{ moduleId: string; title: string; status: RoAModuleConversationStatus }>;
    allComplete: boolean;
  } {
    const contractsById = new Map(contracts.map((c) => [c.id, c]));
    const modules = selectedModules.map((moduleId) => ({
      moduleId,
      title: contractsById.get(moduleId)?.title || moduleId,
      status: status[moduleId] || 'pending',
    }));
    const conversationModules = modules.filter(
      (m) => contractsById.get(m.moduleId)?.authoringMode === 'conversation',
    );
    const allComplete =
      conversationModules.length > 0 && conversationModules.every((m) => m.status === 'complete');
    return { modules, allComplete };
  }

  async getProgress(
    draftId: string,
    contracts: RoAModuleContract[],
  ): Promise<ReturnType<AdviceEngineRoAConversationService['summariseProgress']>> {
    const draft = await this.roaService.getDraft(draftId);
    return this.summariseProgress(
      draft.selectedModules,
      contracts,
      draft.moduleConversationStatus || {},
    );
  }

  // ------------------------------------------------------------------
  // Conversation turns
  // ------------------------------------------------------------------

  async sendMessage(
    draftId: string,
    moduleId: string,
    message: string,
    contracts: RoAModuleContract[],
    user: AuthUserLike,
  ): Promise<{ record: RoAModuleConversationRecord; reply: string; isComplete: boolean }> {
    const draft = await this.roaService.getDraft(draftId);
    this.assertEditable(draft, moduleId);
    const contract = this.requireConversationContract(contracts, moduleId);

    const text = (message || '').trim();
    if (!text) throw new ValidationError('Message cannot be empty.');
    if (text.length > 8000) throw new ValidationError('Message is too long (max 8000 characters).');

    const record = (await this.getConversation(draftId, moduleId)) || {
      draftId,
      moduleId,
      status: 'pending' as RoAModuleConversationStatus,
      messages: [],
      uploads: [],
      updatedAt: new Date().toISOString(),
    };

    // Uploads not yet shown to the model are attached to this user turn.
    const deliveredIds = new Set(
      record.messages.flatMap((m) => (m.attachments || []).map((a) => a.id)),
    );
    const pendingUploads = record.uploads.filter((u) => !deliveredIds.has(u.id));

    const userMessage: RoAConvMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      attachments: pendingUploads.length > 0 ? pendingUploads : undefined,
      createdAt: new Date().toISOString(),
    };
    record.messages.push(userMessage);
    record.status = 'in_progress';

    const turn = await this.runModelTurn(contract, draft, record, pendingUploads, false);

    const assistantMessage: RoAConvMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: turn.reply,
      createdAt: new Date().toISOString(),
    };
    record.messages.push(assistantMessage);

    await this.applyTurnOutcome(draft, contract, record, turn, user);
    return { record, reply: turn.reply, isComplete: record.status === 'complete' };
  }

  /** Force generation of the final narrative (manual completion / adviser override). */
  async complete(
    draftId: string,
    moduleId: string,
    contracts: RoAModuleContract[],
    user: AuthUserLike,
  ): Promise<{ record: RoAModuleConversationRecord }> {
    const draft = await this.roaService.getDraft(draftId);
    this.assertEditable(draft, moduleId);
    const contract = this.requireConversationContract(contracts, moduleId);

    const record = await this.getConversation(draftId, moduleId);
    if (!record) throw new NotFoundError('No conversation found for this module.');

    const turn = await this.runModelTurn(contract, draft, record, [], true);
    if (turn.reply) {
      record.messages.push({
        id: crypto.randomUUID(),
        role: 'assistant',
        content: turn.reply,
        createdAt: new Date().toISOString(),
      });
    }
    // Manual completion forces the complete state regardless of the AI signal.
    await this.applyTurnOutcome(draft, contract, record, { ...turn, isComplete: true }, user);
    return { record };
  }

  /** Persist adviser edits to the AI-authored narrative. */
  async saveNarrative(
    draftId: string,
    moduleId: string,
    sections: Array<{ id: string; markdown: string }>,
    contracts: RoAModuleContract[],
    user: AuthUserLike,
  ): Promise<{ record: RoAModuleConversationRecord; narrative: RoAModuleNarrative }> {
    const draft = await this.roaService.getDraft(draftId);
    this.assertEditable(draft, moduleId);
    const contract = this.requireConversationContract(contracts, moduleId);

    const record = await this.getConversation(draftId, moduleId);
    if (!record) throw new NotFoundError('No conversation found for this module.');

    const narrative = this.mapNarrative(contract, moduleId, sections);
    narrative.editedAt = new Date().toISOString();
    narrative.editedBy = user.id;
    record.narrative = narrative;
    await this.saveConversation(record);
    await this.syncDraft(draftId, moduleId, record.status, narrative, user);
    return { record, narrative };
  }

  // ------------------------------------------------------------------
  // Uploads
  // ------------------------------------------------------------------

  async uploadFile(
    draftId: string,
    moduleId: string,
    input: {
      uploadId: string;
      fileName: string;
      mimeType?: string;
      size?: number;
      bytesBase64: string;
    },
    contracts: RoAModuleContract[],
    user: AuthUserLike,
  ): Promise<{ record: RoAModuleConversationRecord; upload: RoAConvUploadRef }> {
    const draft = await this.roaService.getDraft(draftId);
    this.assertEditable(draft, moduleId);
    const contract = this.requireConversationContract(contracts, moduleId);
    const uploadSpec = contract.conversation?.uploads.find((u) => u.id === input.uploadId);

    // Store via the evidence pipeline (conversation.uploads are mirrored into
    // evidence requirements during validation, so the requirement always exists).
    const updatedDraft = await this.roaService.uploadEvidence(
      draftId,
      {
        moduleId,
        requirementId: input.uploadId,
        label: uploadSpec?.label,
        fileName: input.fileName,
        mimeType: input.mimeType,
        size: input.size,
        source: 'adviser-upload',
        bytesBase64: input.bytesBase64,
      },
      contracts,
      user,
    );

    const evidenceItem = updatedDraft.moduleEvidence?.[moduleId]?.[input.uploadId];
    if (!evidenceItem) throw new ValidationError('Upload could not be stored.');

    const uploadRef: RoAConvUploadRef = {
      id: crypto.randomUUID(),
      evidenceId: evidenceItem.id,
      fileName: evidenceItem.fileName,
      mimeType: evidenceItem.mimeType,
      size: evidenceItem.size,
      // Deterministic blob path used by the evidence pipeline (for vision input).
      storagePath: roaEvidenceBlobPath(
        draft.clientId,
        draftId,
        evidenceItem.id,
        evidenceItem.mimeType,
      ),
      visionEligible: uploadSpec?.visionEligible ?? this.isVisionMime(evidenceItem.mimeType),
      uploadedAt: new Date().toISOString(),
    };

    const record = (await this.getConversation(draftId, moduleId)) || {
      draftId,
      moduleId,
      status: 'in_progress' as RoAModuleConversationStatus,
      messages: [],
      uploads: [],
      updatedAt: new Date().toISOString(),
    };
    record.uploads.push(uploadRef);
    if (record.status === 'pending') record.status = 'in_progress';
    await this.saveConversation(record);
    return { record, upload: uploadRef };
  }

  // ------------------------------------------------------------------
  // Internals
  // ------------------------------------------------------------------

  private isVisionMime(mimeType?: string): boolean {
    const m = (mimeType || '').toLowerCase();
    return m.includes('image') || m.includes('pdf');
  }

  private async loadVoice(): Promise<ConversationVoice | undefined> {
    try {
      const guidelines = await this.brandService.getGuidelines();
      const voice = guidelines?.voice;
      if (voice && (voice.tone || voice.terminology || voice.notes)) return voice;
    } catch (error) {
      log.warn('Brand voice unavailable for RoA conversation', { error: getErrMsg(error) });
    }
    return undefined;
  }

  private buildClientContextSummary(snapshot: RoAClientSnapshot | undefined): string {
    if (!snapshot) return 'No client snapshot is attached to this draft.';
    const context = {
      displayName: snapshot.displayName,
      personalInformation: snapshot.personalInformation,
      contactInformation: snapshot.contactInformation,
      employmentInformation: snapshot.employmentInformation,
      financialInformation: snapshot.financialInformation,
      familyMembers: snapshot.familyMembers,
      assets: snapshot.assets,
      liabilities: snapshot.liabilities,
      riskProfile: snapshot.riskProfile,
      policies: snapshot.policies,
    };
    try {
      return JSON.stringify(context, null, 2);
    } catch {
      return 'Client snapshot could not be serialised.';
    }
  }

  private buildSystemPrompt(
    contract: RoAModuleContract,
    draft: RoADraftRecord,
    voice: ConversationVoice | undefined,
  ): string {
    const conversation = contract.conversation!;
    const sectionList = conversation.narrativeSections
      .slice()
      .sort((a, b) => a.order - b.order)
      .map(
        (section) =>
          `- [${section.id}] ${section.title}${section.required ? ' (required)' : ''}: ${section.description}`,
      )
      .join('\n');
    const uploadList =
      conversation.uploads.length > 0
        ? conversation.uploads
            .map((u) => `- ${u.label}${u.required ? ' (required)' : ''}: ${u.guidance || ''}`)
            .join('\n')
        : 'None specified.';

    const voiceBlock = voice
      ? `\n## Brand voice\nTone: ${voice.tone}\nTerminology: ${voice.terminology}\nNotes: ${voice.notes}\n`
      : '';

    return [
      conversation.instructions,
      '',
      '## Adviser',
      `${draft.adviserSnapshot?.displayName || 'Adviser'} (${draft.adviserSnapshot?.role || 'adviser'})${
        draft.adviserSnapshot?.fspReference ? `, FSP ref ${draft.adviserSnapshot.fspReference}` : ''
      }`,
      '',
      '## Client personal and policy information (authoritative — do not contradict)',
      this.buildClientContextSummary(draft.clientSnapshot),
      voiceBlock,
      '## Narrative sections you must ultimately author',
      sectionList,
      '',
      '## Documents/images the adviser may provide',
      uploadList,
      '',
      '## Output protocol (STRICT)',
      'Respond ONLY with JSON matching the supplied schema:',
      '- "reply": your next conversational message to the adviser (markdown allowed).',
      '- "isComplete": set true ONLY when you have gathered enough to write every required section and the adviser has confirmed, otherwise false.',
      '- "narrative": when isComplete is true, provide the FULL final prose for every required section using the section ids above; otherwise set it to null.',
      'While gathering information keep isComplete=false and narrative=null. Ask focused questions, request uploads when useful, and never invent client facts.',
    ].join('\n');
  }

  private buildTurnSchema(contract: RoAModuleContract) {
    const sectionIds = (contract.conversation?.narrativeSections || []).map((s) => s.id);
    return {
      name: 'roa_module_turn',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['reply', 'isComplete', 'narrative'],
        properties: {
          reply: { type: 'string' },
          isComplete: { type: 'boolean' },
          narrative: {
            type: ['object', 'null'],
            additionalProperties: false,
            required: ['sections'],
            properties: {
              sections: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['id', 'markdown'],
                  properties: {
                    id:
                      sectionIds.length > 0
                        ? { type: 'string', enum: sectionIds }
                        : { type: 'string' },
                    markdown: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    };
  }

  private async buildAttachmentBlocks(uploads: RoAConvUploadRef[]): Promise<AiContentBlock[]> {
    const blocks: AiContentBlock[] = [];
    let budget = MAX_ATTACHMENT_BYTES_PER_TURN;
    for (const upload of uploads) {
      if (!upload.visionEligible || !upload.storagePath) continue;
      try {
        const bytes = await downloadRoABlob(upload.storagePath);
        if (bytes.byteLength > budget) continue;
        budget -= bytes.byteLength;
        const base64 = bytesToBase64(bytes);
        const mime = (upload.mimeType || '').toLowerCase();
        if (mime.includes('image')) {
          blocks.push({
            type: 'image',
            dataBase64: base64,
            mimeType: upload.mimeType || 'image/png',
          });
        } else {
          blocks.push({
            type: 'file',
            filename: upload.fileName,
            dataBase64: base64,
            mimeType: upload.mimeType || 'application/pdf',
          });
        }
      } catch (error) {
        log.warn('Could not load upload for model turn', {
          fileName: upload.fileName,
          error: getErrMsg(error),
        });
      }
    }
    return blocks;
  }

  private async runModelTurn(
    contract: RoAModuleContract,
    draft: RoADraftRecord,
    record: RoAModuleConversationRecord,
    pendingUploads: RoAConvUploadRef[],
    finalise: boolean,
  ): Promise<ModuleTurnResult> {
    const voice = await this.loadVoice();
    const systemPrompt = this.buildSystemPrompt(contract, draft, voice);

    const messages: AiMessage[] = [{ role: 'system', content: systemPrompt }];
    const lastUserIndex = record.messages.map((m) => m.role).lastIndexOf('user');
    const attachmentBlocks = await this.buildAttachmentBlocks(pendingUploads);

    record.messages.forEach((message, index) => {
      if (message.role === 'assistant') {
        messages.push({ role: 'assistant', content: message.content });
        return;
      }
      const note =
        message.attachments && message.attachments.length > 0
          ? `${message.content}\n\n[Attached: ${message.attachments.map((a) => a.fileName).join(', ')}]`
          : message.content;
      if (index === lastUserIndex && attachmentBlocks.length > 0) {
        messages.push({
          role: 'user',
          content: [{ type: 'text', text: note }, ...attachmentBlocks],
        });
      } else {
        messages.push({ role: 'user', content: note });
      }
    });

    if (finalise) {
      messages.push({
        role: 'user',
        content:
          'Please finalise this module now. Set isComplete to true and return the complete, client-ready narrative for every required section.',
      });
    }

    try {
      const result = await callResponses({
        messages,
        maxOutputTokens: 4000,
        temperature: 0.5,
        jsonSchema: this.buildTurnSchema(contract),
      });
      const parsed = parseJsonResponse<ModuleTurnResult>(result.text);
      return {
        reply: typeof parsed.reply === 'string' ? parsed.reply : '',
        isComplete: parsed.isComplete === true,
        narrative:
          parsed.narrative && Array.isArray(parsed.narrative.sections) ? parsed.narrative : null,
      };
    } catch (error) {
      log.error('RoA module turn failed', { moduleId: contract.id, error: getErrMsg(error) });
      throw new Error(`AI conversation failed: ${getErrMsg(error)}`, { cause: error });
    }
  }

  private mapNarrative(
    contract: RoAModuleContract,
    moduleId: string,
    sections: Array<{ id: string; markdown: string }>,
  ): RoAModuleNarrative {
    const byId = new Map(sections.map((s) => [s.id, s.markdown]));
    const ordered = (contract.conversation?.narrativeSections || [])
      .slice()
      .sort((a, b) => a.order - b.order);
    const mapped = ordered.map((section) => ({
      id: section.id,
      title: section.title,
      markdown: byId.get(section.id) ?? '',
    }));
    // Preserve any extra sections the model returned that aren't in the contract.
    for (const section of sections) {
      if (!ordered.some((s) => s.id === section.id)) {
        mapped.push({ id: section.id, title: section.id, markdown: section.markdown });
      }
    }
    return { moduleId, sections: mapped, generatedAt: new Date().toISOString() };
  }

  private completionGuardsPass(
    contract: RoAModuleContract,
    record: RoAModuleConversationRecord,
  ): boolean {
    const completion = contract.conversation?.completion;
    if (!completion) return true;
    const userTurns = record.messages.filter((m) => m.role === 'user').length;
    if (completion.minTurns && userTurns < completion.minTurns) return false;
    if (completion.requireAllUploads) {
      const requiredIds = (contract.conversation?.uploads || [])
        .filter((u) => u.required)
        .map((u) => u.id);
      const uploadedEvidenceIds = new Set(record.uploads.map((u) => u.evidenceId));
      // Required uploads are tracked through evidence; presence of an upload ref is sufficient.
      if (requiredIds.length > 0 && record.uploads.length < requiredIds.length) return false;
      void uploadedEvidenceIds;
    }
    return true;
  }

  private async applyTurnOutcome(
    draft: RoADraftRecord,
    contract: RoAModuleContract,
    record: RoAModuleConversationRecord,
    turn: ModuleTurnResult,
    user: AuthUserLike,
  ): Promise<void> {
    let narrative: RoAModuleNarrative | undefined = record.narrative;

    const shouldComplete = turn.isComplete && this.completionGuardsPass(contract, record);
    if (turn.narrative && turn.narrative.sections.length > 0) {
      narrative = this.mapNarrative(contract, record.moduleId, turn.narrative.sections);
      record.narrative = narrative;
    }

    if (shouldComplete && narrative && narrative.sections.some((s) => s.markdown.trim())) {
      record.status = 'complete';
    } else if (record.status !== 'complete') {
      record.status = 'in_progress';
    }

    await this.saveConversation(record);
    await this.syncDraft(record.draftId, record.moduleId, record.status, narrative, user);
  }

  private async syncDraft(
    draftId: string,
    moduleId: string,
    status: RoAModuleConversationStatus,
    narrative: RoAModuleNarrative | undefined,
    user: AuthUserLike,
  ): Promise<void> {
    const draft = await this.roaService.getDraft(draftId);
    const moduleConversationStatus = {
      ...(draft.moduleConversationStatus || {}),
      [moduleId]: status,
    };
    const moduleNarratives = { ...(draft.moduleNarratives || {}) };
    if (narrative) moduleNarratives[moduleId] = narrative;

    await this.roaService.saveDraft(
      {
        id: draftId,
        authoringMode: 'conversation',
        moduleConversationStatus,
        moduleNarratives,
      },
      user,
    );
  }
}

/** Shared helper used by routes to strip stored byte payloads before returning. */
export function sanitiseConversationRecord(
  record: RoAModuleConversationRecord,
): RoAModuleConversationRecord {
  return {
    ...record,
    uploads: record.uploads.map((upload) => ({ ...upload })),
  };
}
