/**
 * P4.8 — Packet workflow service.
 *
 * A "packet" is an authored sequence of templates that should be sent to a
 * shared set of recipients one after the other. A "packet run" is the live
 * execution of a packet — it stores the recipient slots, the per-step
 * document ids that have already been uploaded, and the materialised
 * envelope ids as they are spawned.
 *
 * The completion workflow (esign-workflow.ts) calls
 * `advancePacketRunFromCompletion(envelopeId)` whenever an envelope
 * finishes. If the envelope belongs to a packet run, that step is marked
 * completed and the next step's envelope is materialised + sent. This is
 * what gives us the "envelope N completes → envelope N+1 sends"
 * guarantee.
 *
 * Materialisation is deliberately minimal:
 *   - one document per step (no multi-doc concatenation, no manifest)
 *   - no CRM prefill resolution at send-time
 *   - sequential signing only (parallel packets can be added later)
 * These are acceptable v1 trade-offs because everything more advanced is
 * already supported on a per-envelope basis through the standard wizard;
 * packets just chain those simpler envelopes.
 */

import * as kv from "./kv_store.tsx";
import { EsignKeys } from "./esign-keys.ts";
import { createModuleLogger } from "./stderr-logger.ts";
import { getErrMsg } from "./shared-logger-utils.ts";
import {
  createEnvelope,
  addSignersToEnvelope,
  addFieldsToEnvelope,
  updateEnvelopeStatus,
  updateSignerStatus,
  getEnvelopeSigners,
  logAuditEvent,
} from "./esign-services.tsx";
import { getTemplate, getTemplateVersion } from "./esign-template-service.ts";
import { sendEmail } from "./email-service.ts";
import { createSigningInviteEmail } from "./esign-email-templates.ts";
import type {
  PacketRecord,
  PacketRecipient,
  PacketRunRecord,
  PacketRunStepRecord,
  PacketStepDefinition,
} from "./esign-types.ts";

const log = createModuleLogger("esign-packet-service");

// ============================================================================
// Packets (definitions)
// ============================================================================

export async function createPacket(params: {
  firmId: string;
  name: string;
  description?: string;
  steps: Array<{ templateId: string; templateVersion?: number; label?: string }>;
  createdByUserId: string;
}): Promise<{ packet?: PacketRecord; error?: string }> {
  try {
    const trimmedName = params.name.trim();
    if (!trimmedName) return { error: "Packet name is required" };
    if (!params.steps || params.steps.length === 0) {
      return { error: "Packet must contain at least one step" };
    }

    // Resolve + snapshot template versions so the packet stays
    // reproducible even if templates are later edited.
    const resolvedSteps: PacketStepDefinition[] = [];
    for (const s of params.steps) {
      const tpl = await getTemplate(s.templateId);
      if (!tpl) return { error: `Template ${s.templateId} not found` };
      resolvedSteps.push({
        templateId: tpl.id,
        templateVersion: s.templateVersion ?? tpl.version ?? 1,
        label: s.label?.trim() || tpl.name,
      });
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const packet: PacketRecord = {
      id,
      firm_id: params.firmId,
      name: trimmedName,
      description: params.description?.trim(),
      steps: resolvedSteps,
      created_by_user_id: params.createdByUserId,
      created_at: now,
      updated_at: now,
    };

    await kv.set(EsignKeys.packet(id), packet);
    const list: string[] = (await kv.get(EsignKeys.packetsList())) || [];
    list.push(id);
    await kv.set(EsignKeys.packetsList(), list);

    log.success(`Packet created: "${packet.name}" (${id}) with ${resolvedSteps.length} step(s)`);
    return { packet };
  } catch (error) {
    log.error("Failed to create packet:", error);
    return { error: getErrMsg(error) };
  }
}

export async function getPacket(id: string): Promise<PacketRecord | null> {
  try {
    return ((await kv.get(EsignKeys.packet(id))) as PacketRecord | null) || null;
  } catch (error) {
    log.error(`Failed to get packet ${id}:`, error);
    return null;
  }
}

export async function listPackets(): Promise<PacketRecord[]> {
  try {
    const ids: string[] = (await kv.get(EsignKeys.packetsList())) || [];
    if (ids.length === 0) return [];
    const records = await Promise.all(ids.map((id) => kv.get(EsignKeys.packet(id))));
    return (records.filter(Boolean) as PacketRecord[]).sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  } catch (error) {
    log.error("Failed to list packets:", error);
    return [];
  }
}

export async function deletePacket(id: string): Promise<{ ok: boolean; error?: string }> {
  try {
    await kv.del(EsignKeys.packet(id));
    const ids: string[] = (await kv.get(EsignKeys.packetsList())) || [];
    await kv.set(EsignKeys.packetsList(), ids.filter((x) => x !== id));
    return { ok: true };
  } catch (error) {
    log.error(`Failed to delete packet ${id}:`, error);
    return { ok: false, error: getErrMsg(error) };
  }
}

// ============================================================================
// Packet runs (executions)
// ============================================================================

export interface StartPacketRunParams {
  packetId: string;
  firmId: string;
  clientId: string;
  recipients: PacketRecipient[];
  /** Per-step uploaded document ids, parallel to packet.steps. Required:
   *  packets need a source PDF for every step at run-start so that
   *  later auto-advances do not need user interaction. */
  documentIdsByStep: string[];
  createdByUserId: string;
  /** Optional sender email used to populate the From line in invites. */
  senderEmail?: string;
  expiryDays?: number;
  message?: string;
}

export async function startPacketRun(
  params: StartPacketRunParams,
): Promise<{ run?: PacketRunRecord; firstEnvelopeId?: string; error?: string }> {
  try {
    const packet = await getPacket(params.packetId);
    if (!packet) return { error: "Packet not found" };
    if (params.documentIdsByStep.length !== packet.steps.length) {
      return {
        error: `Expected ${packet.steps.length} document id(s) (one per step), got ${params.documentIdsByStep.length}`,
      };
    }
    if (!params.recipients || params.recipients.length === 0) {
      return { error: "At least one recipient required" };
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const steps: PacketRunStepRecord[] = packet.steps.map((s, idx) => ({
      step_index: idx,
      template_id: s.templateId,
      template_version: s.templateVersion,
      status: "pending",
    }));

    const run: PacketRunRecord = {
      id,
      firm_id: params.firmId,
      packet_id: params.packetId,
      recipients: params.recipients,
      created_by_user_id: params.createdByUserId,
      created_at: now,
      updated_at: now,
      status: "running",
      current_step_index: 0,
      steps,
    };

    // Stash per-run plan so completion-driven advancement can look it
    // up without the user being involved. We deliberately keep this in
    // a side-channel KV record (not the run object the dashboard
    // reads) so we don't leak document_ids over the listing endpoint.
    await kv.set(EsignKeys.packetRun(id), run);
    await kv.set(`${EsignKeys.packetRun(id)}:plan`, {
      documentIdsByStep: params.documentIdsByStep,
      clientId: params.clientId,
      senderEmail: params.senderEmail,
      expiryDays: params.expiryDays,
      message: params.message,
    });
    const runList: string[] = (await kv.get(EsignKeys.packetRunsList())) || [];
    runList.push(id);
    await kv.set(EsignKeys.packetRunsList(), runList);

    // Materialise step 0 immediately so the first signer gets an
    // invite right away; subsequent steps are triggered from the
    // completion workflow.
    const dispatch = await materialisePacketStep(run, 0);
    if (dispatch.error) {
      run.status = "failed";
      run.steps[0] = { ...run.steps[0], status: "failed", error: dispatch.error };
      run.updated_at = new Date().toISOString();
      await kv.set(EsignKeys.packetRun(id), run);
      return { run, error: dispatch.error };
    }

    return { run: dispatch.run, firstEnvelopeId: dispatch.envelopeId };
  } catch (error) {
    log.error("Failed to start packet run:", error);
    return { error: getErrMsg(error) };
  }
}

export async function getPacketRun(id: string): Promise<PacketRunRecord | null> {
  try {
    return ((await kv.get(EsignKeys.packetRun(id))) as PacketRunRecord | null) || null;
  } catch (error) {
    log.error(`Failed to get packet run ${id}:`, error);
    return null;
  }
}

export async function listPacketRuns(): Promise<PacketRunRecord[]> {
  try {
    const ids: string[] = (await kv.get(EsignKeys.packetRunsList())) || [];
    if (ids.length === 0) return [];
    const records = await Promise.all(ids.map((id) => kv.get(EsignKeys.packetRun(id))));
    return (records.filter(Boolean) as PacketRunRecord[]).sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );
  } catch (error) {
    log.error("Failed to list packet runs:", error);
    return [];
  }
}

export async function cancelPacketRun(id: string): Promise<{ run?: PacketRunRecord; error?: string }> {
  try {
    const run = await getPacketRun(id);
    if (!run) return { error: "Packet run not found" };
    if (run.status === "completed") return { error: "Run already completed" };
    run.status = "cancelled";
    run.steps = run.steps.map((s) => (s.status === "pending" ? { ...s, status: "skipped" } : s));
    run.updated_at = new Date().toISOString();
    await kv.set(EsignKeys.packetRun(id), run);
    return { run };
  } catch (error) {
    log.error(`Failed to cancel packet run ${id}:`, error);
    return { error: getErrMsg(error) };
  }
}

// ============================================================================
// Completion → advancement hook
// ============================================================================

/**
 * Called from the completion workflow after envelope N is fully signed
 * and sealed. If the envelope was spawned from a packet run, mark the
 * step completed and materialise the next step (or finalise the run).
 */
export async function advancePacketRunFromCompletion(
  envelopeId: string,
  runId: string,
  stepIndex: number,
): Promise<void> {
  try {
    const run = await getPacketRun(runId);
    if (!run) {
      log.warn(`advancePacketRunFromCompletion: run ${runId} not found`);
      return;
    }
    if (run.status === "cancelled" || run.status === "completed") return;

    const completedStep = run.steps.find((s) => s.step_index === stepIndex);
    if (completedStep) {
      completedStep.status = "completed";
      completedStep.envelope_id = envelopeId;
      completedStep.completed_at = new Date().toISOString();
    }

    const nextIndex = stepIndex + 1;
    if (nextIndex >= run.steps.length) {
      run.status = "completed";
      run.current_step_index = stepIndex;
      run.updated_at = new Date().toISOString();
      await kv.set(EsignKeys.packetRun(runId), run);
      log.success(`Packet run ${runId} completed (last step ${stepIndex})`);
      return;
    }

    run.current_step_index = nextIndex;
    run.updated_at = new Date().toISOString();
    await kv.set(EsignKeys.packetRun(runId), run);

    // Spawn the next envelope. Failures here don't crash the
    // completion of envelope N — they just leave the run in a
    // recoverable 'failed' state the user can retry from.
    const dispatch = await materialisePacketStep(run, nextIndex);
    if (dispatch.error) {
      const fresh = await getPacketRun(runId);
      if (fresh) {
        const stepRec = fresh.steps.find((s) => s.step_index === nextIndex);
        if (stepRec) {
          stepRec.status = "failed";
          stepRec.error = dispatch.error;
        }
        fresh.status = "failed";
        fresh.updated_at = new Date().toISOString();
        await kv.set(EsignKeys.packetRun(runId), fresh);
      }
    }
  } catch (error) {
    log.error("advancePacketRunFromCompletion failed:", error);
  }
}

// ============================================================================
// Materialisation (server-side envelope spawn for one step)
// ============================================================================

interface PlanRecord {
  documentIdsByStep: string[];
  clientId: string;
  senderEmail?: string;
  expiryDays?: number;
  message?: string;
}

interface MaterialiseResult {
  run?: PacketRunRecord;
  envelopeId?: string;
  error?: string;
}

async function materialisePacketStep(
  run: PacketRunRecord,
  stepIndex: number,
): Promise<MaterialiseResult> {
  try {
    const stepRec = run.steps.find((s) => s.step_index === stepIndex);
    if (!stepRec) return { error: `Step ${stepIndex} not found on run ${run.id}` };

    const plan = (await kv.get(`${EsignKeys.packetRun(run.id)}:plan`)) as PlanRecord | null;
    if (!plan) return { error: `Run plan missing for ${run.id}` };
    const documentId = plan.documentIdsByStep[stepIndex];
    if (!documentId) return { error: `No document uploaded for step ${stepIndex}` };

    // Resolve template — prefer the pinned snapshot for reproducibility.
    const tpl =
      (await getTemplateVersion(stepRec.template_id, stepRec.template_version)) ||
      (await getTemplate(stepRec.template_id));
    if (!tpl) return { error: `Template ${stepRec.template_id} not found` };

    // 1. Create envelope (stamps packet provenance for completion hook).
    const stepDef = (await getPacket(run.packet_id))?.steps[stepIndex];
    const title = stepDef?.label || tpl.name;
    const created = await createEnvelope({
      firmId: run.firm_id,
      clientId: plan.clientId,
      title,
      documentId,
      createdByUserId: run.created_by_user_id,
      signers: [],
      message: plan.message ?? tpl.defaultMessage,
      expiryDays: plan.expiryDays ?? tpl.defaultExpiryDays,
      signingMode: tpl.signingMode,
      templateId: tpl.id,
      templateVersion: tpl.version,
      packetRunId: run.id,
      packetStepIndex: stepIndex,
    });
    if (created.error || !created.envelopeId) return { error: created.error || "Failed to create envelope" };
    const envelopeId = created.envelopeId;

    // 2. Add signers from the packet-run recipient slots. Templates
    //    keep a separate `recipients` array; we map by `order` if it
    //    aligns, otherwise we just use the run's recipients verbatim.
    const orderedRecipients = [...run.recipients].sort((a, b) => a.order - b.order);
    const { signerIds, error: signerErr } = await addSignersToEnvelope(
      envelopeId,
      orderedRecipients.map((r) => ({
        name: r.name,
        email: r.email,
        role: r.role,
        kind: "signer",
        requiresOtp: false,
      })),
    );
    if (signerErr) return { error: signerErr };

    // 3. Materialise template fields → envelope fields. Map
    //    `recipientIndex` on each template field to the freshly-created
    //    signerId at that index.
    if (tpl.fields && tpl.fields.length > 0) {
      const envelopeFields = tpl.fields.map((f) => ({
        signerId: signerIds[f.recipientIndex] ?? signerIds[0],
        type: f.type,
        page: f.page,
        x: f.x,
        y: f.y,
        width: f.width,
        height: f.height,
        required: f.required,
      }));
      await addFieldsToEnvelope(envelopeId, envelopeFields);
    }

    // 4. Mark envelope sent + invite the first signer (sequential mode
    //    is the only supported mode for packets in v1; sending only the
    //    first signer matches the standard sequential-flow contract).
    await updateEnvelopeStatus(envelopeId, "sent", {
      sent_at: new Date().toISOString(),
      signing_mode: "sequential",
    });

    const signers = await getEnvelopeSigners(envelopeId);
    const sorted = [...signers].sort((a, b) => (a.order || 0) - (b.order || 0));
    const first = sorted[0];
    if (first) {
      const signingUrl = `https://www.navigatewealth.co/sign?token=${first.access_token}`;
      const emailContent = createSigningInviteEmail({
        signerName: first.name,
        envelopeTitle: title,
        senderName: plan.senderEmail || "Navigate Wealth",
        signingLink: signingUrl,
        message: plan.message ?? tpl.defaultMessage,
      });
      const sent = await sendEmail({
        to: first.email,
        subject: `Signature Request: ${title}`,
        html: emailContent.html,
        text: emailContent.text,
      });
      if (sent) {
        await updateSignerStatus(first.id, "sent", { invite_sent_at: new Date().toISOString() });
      }
      await logAuditEvent({
        envelopeId,
        actorType: "system",
        action: "invite_sent",
        email: first.email,
        metadata: {
          signerId: first.id,
          signerName: first.name,
          via: "packet_run",
          packetRunId: run.id,
          packetStepIndex: stepIndex,
        },
      });
    }

    // 5. Update the run record.
    const updatedRun = await getPacketRun(run.id);
    if (updatedRun) {
      const target = updatedRun.steps.find((s) => s.step_index === stepIndex);
      if (target) {
        target.envelope_id = envelopeId;
        target.status = "sent";
        target.started_at = new Date().toISOString();
      }
      updatedRun.current_step_index = stepIndex;
      updatedRun.updated_at = new Date().toISOString();
      await kv.set(EsignKeys.packetRun(run.id), updatedRun);
      return { run: updatedRun, envelopeId };
    }
    return { run, envelopeId };
  } catch (error) {
    log.error(`materialisePacketStep failed for run ${run.id} step ${stepIndex}:`, error);
    return { error: getErrMsg(error) };
  }
}
