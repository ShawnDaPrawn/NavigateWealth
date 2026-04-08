/**
 * ****************************************************************************
 * TASKS DIGEST ROUTES
 * ****************************************************************************
 *
 * VERSION: 1.0.0
 *
 * Scheduled email digest for overdue tasks.
 * Called by a Supabase cron job each weekday morning at 06:00 SAST.
 *
 * Endpoint:
 *   POST /tasks-digest/send-overdue
 *
 * Auth: Requires the SUPER_ADMIN_PASSWORD header (server-to-server only).
 *       The Supabase cron sends this via the Authorization header so that
 *       no public user can trigger the email.
 *
 * KV key pattern: task:{uuid}
 *
 * ****************************************************************************
 */

import { Hono } from "npm:hono";
import { createModuleLogger } from "./stderr-logger.ts";
import { asyncHandler } from "./error.middleware.ts";
import * as kv from "./kv_store.tsx";
import type { RawKvTask, KvTask } from "./tasks-types.ts";
import {
  sendEmail,
  createEmailTemplate,
  getFooterSettings,
} from "./email-service.tsx";

const app = new Hono();
const log = createModuleLogger("tasks-digest");

const ADMIN_EMAIL = "info@navigatewealth.co";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Normalise a raw KV task (same logic as tasks-routes.ts). */
function normaliseTask(raw: RawKvTask): KvTask {
  if (!raw || typeof raw !== "object") return raw as unknown as KvTask;
  return {
    ...raw,
    due_date: raw.due_date ?? raw.dueDate ?? null,
    is_template: raw.is_template ?? (raw as Record<string, unknown>).isTemplate as boolean ?? false,
    assignee_initials:
      raw.assignee_initials ??
      (raw as Record<string, unknown>).assigneeInitials as string ??
      null,
    assignee_id:
      raw.assignee_id ??
      (raw as Record<string, unknown>).assigneeId as string ??
      null,
    created_by:
      (raw as Record<string, unknown>).created_by as string ??
      (raw as Record<string, unknown>).createdBy as string ??
      "",
    created_at:
      (raw as Record<string, unknown>).created_at as string ??
      (raw as Record<string, unknown>).createdAt as string ??
      new Date().toISOString(),
    updated_at:
      (raw as Record<string, unknown>).updated_at as string ??
      (raw as Record<string, unknown>).updatedAt as string ??
      new Date().toISOString(),
    completed_at:
      (raw as Record<string, unknown>).completed_at as string ??
      (raw as Record<string, unknown>).completedAt as string ??
      null,
    sort_order: raw.sort_order ?? raw.sortOrder ?? 0,
    reminder_frequency:
      (raw as Record<string, unknown>).reminder_frequency as string ??
      (raw as Record<string, unknown>).reminderFrequency as string ??
      null,
    last_reminder_sent:
      (raw as Record<string, unknown>).last_reminder_sent as string ??
      (raw as Record<string, unknown>).lastReminderSent as string ??
      null,
    tags: (raw as Record<string, unknown>).tags as string[] ?? [],
    category: (raw as Record<string, unknown>).category as string ?? null,
    priority: raw.priority as KvTask["priority"] ?? "medium",
    status: raw.status as KvTask["status"] ?? "new",
    description: (raw as Record<string, unknown>).description as string ?? null,
    title: raw.title ?? "",
    id: raw.id ?? "",
  } as KvTask;
}

/** Format a date string to en-ZA locale (dd MMM yyyy). */
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

/** How many days overdue. */
function daysOverdue(dueDateIso: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDateIso);
  due.setHours(0, 0, 0, 0);
  return Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
}

/** Priority → sort weight (higher = more urgent). */
const PRIORITY_WEIGHT: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/** Priority badge colours for the email. */
const PRIORITY_COLOURS: Record<string, { bg: string; text: string }> = {
  critical: { bg: "#dc2626", text: "#ffffff" },
  high: { bg: "#ea580c", text: "#ffffff" },
  medium: { bg: "#d97706", text: "#ffffff" },
  low: { bg: "#6b7280", text: "#ffffff" },
};

// ---------------------------------------------------------------------------
// Auth middleware — cron-only (service-role key or super-admin password)
// Also accepts admin JWT (for frontend-triggered digest)
// ---------------------------------------------------------------------------

async function requireCronOrAdminAuth(c: { req: { header: (n: string) => string | undefined }; set: (key: string, value: unknown) => void }, next: () => Promise<void>) {
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const superAdminPw = Deno.env.get("SUPER_ADMIN_PASSWORD") || "";

  // 1. Service-role key or super-admin password (cron path)
  if (
    (serviceRoleKey && token === serviceRoleKey) ||
    (superAdminPw && token === superAdminPw)
  ) {
    return next();
  }

  // 2. Admin JWT (frontend path) — validate via Supabase Auth
  if (token) {
    try {
      const { createClient } = await import("jsr:@supabase/supabase-js@2.49.8");
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user?.id) {
        const role = user.user_metadata?.role || user.user_metadata?.systemRole;
        if (role === "admin" || role === "super_admin") {
          c.set("userId", user.id);
          return next();
        }
      }
    } catch {
      // Fall through to 401
    }
  }

  return new Response("Unauthorized — cron or admin auth required", { status: 401 });
}

// ---------------------------------------------------------------------------
// GET /tasks-digest/status — Check if today's digest has been sent
// ---------------------------------------------------------------------------

app.get(
  "/status",
  requireCronOrAdminAuth,
  asyncHandler(async (c) => {
    const todayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const kvKey = `tasks_digest:last_sent`;
    const lastSent = await kv.get(kvKey) as { date: string; overdueCount: number } | null;

    return c.json({
      lastSentDate: lastSent?.date || null,
      lastOverdueCount: lastSent?.overdueCount || 0,
      alreadySentToday: lastSent?.date === todayKey,
      todayKey,
    });
  })
);

// ---------------------------------------------------------------------------
// POST /tasks-digest/send-overdue
// ---------------------------------------------------------------------------

app.post(
  "/send-overdue",
  requireCronOrAdminAuth,
  asyncHandler(async (c) => {
    log.info("=== Overdue Tasks Digest: Starting ===");

    // ── Deduplication: only send once per calendar day ──────────────────
    const todayKey = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const dedupKvKey = `tasks_digest:last_sent`;
    const lastSent = await kv.get(dedupKvKey) as { date: string } | null;

    // Allow force-send via query param (?force=true) for manual retriggers
    const forceParam = c.req.query("force");
    const force = forceParam === "true" || forceParam === "1";

    if (lastSent?.date === todayKey && !force) {
      log.info("Digest already sent today — skipping (use ?force=true to override)", { date: todayKey });
      return c.json({ success: true, sent: false, reason: "already_sent_today", date: todayKey });
    }

    // 1. Fetch all tasks from KV
    const allRaw = await kv.getByPrefix("task:");
    if (!Array.isArray(allRaw) || allRaw.length === 0) {
      log.info("No tasks found in KV store — skipping digest");
      return c.json({ success: true, sent: false, reason: "no_tasks" });
    }

    // 2. Filter for overdue tasks
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const overdueTasks = allRaw
      .filter((raw: RawKvTask) => {
        if (!raw || typeof raw !== "object" || !raw.id || !raw.title) return false;
        const status = (raw.status as string) || "new";
        if (status === "completed" || status === "archived") return false;
        const dd = raw.due_date ?? raw.dueDate;
        if (!dd) return false;
        const dueDate = new Date(dd as string);
        dueDate.setHours(0, 0, 0, 0);
        return dueDate.getTime() < now.getTime();
      })
      .map(normaliseTask)
      .sort((a: KvTask, b: KvTask) => {
        // Sort by priority (critical first), then by how overdue
        const pw = (PRIORITY_WEIGHT[b.priority] || 0) - (PRIORITY_WEIGHT[a.priority] || 0);
        if (pw !== 0) return pw;
        const dA = a.due_date ? new Date(a.due_date).getTime() : 0;
        const dB = b.due_date ? new Date(b.due_date).getTime() : 0;
        return dA - dB; // Oldest overdue first
      });

    if (overdueTasks.length === 0) {
      log.info("No overdue tasks — skipping digest email");
      return c.json({ success: true, sent: false, reason: "no_overdue_tasks" });
    }

    log.info(`Found ${overdueTasks.length} overdue task(s) — building email`);

    // 3. Build task table rows
    const taskRows = overdueTasks
      .map((task: KvTask) => {
        const days = task.due_date ? daysOverdue(task.due_date) : 0;
        const dueStr = task.due_date ? formatDate(task.due_date) : "—";
        const priorityColour = PRIORITY_COLOURS[task.priority] || PRIORITY_COLOURS.medium;
        const daysLabel =
          days === 1 ? "1 day overdue" : `${days} days overdue`;
        const daysColour = days >= 7 ? "#dc2626" : days >= 3 ? "#ea580c" : "#d97706";

        return `
          <tr>
            <td style="padding: 12px 14px; border-bottom: 1px solid #f3f4f6; vertical-align: top;">
              <div style="font-weight: 600; color: #111827; font-size: 14px; margin-bottom: 3px;">
                ${task.title}
              </div>
              ${task.category ? `<span style="font-size: 11px; color: #6b7280;">${task.category}</span>` : ""}
            </td>
            <td style="padding: 12px 10px; border-bottom: 1px solid #f3f4f6; text-align: center; vertical-align: top;">
              <span style="
                display: inline-block;
                padding: 2px 10px;
                border-radius: 999px;
                font-size: 11px;
                font-weight: 600;
                background-color: ${priorityColour.bg};
                color: ${priorityColour.text};
                text-transform: capitalize;
              ">${task.priority}</span>
            </td>
            <td style="padding: 12px 10px; border-bottom: 1px solid #f3f4f6; text-align: center; vertical-align: top; white-space: nowrap;">
              <div style="font-size: 13px; color: #374151;">${dueStr}</div>
              <div style="font-size: 11px; color: ${daysColour}; font-weight: 600; margin-top: 2px;">${daysLabel}</div>
            </td>
          </tr>`;
      })
      .join("");

    // 4. Summary counts by priority
    const byCritical = overdueTasks.filter((t: KvTask) => t.priority === "critical").length;
    const byHigh = overdueTasks.filter((t: KvTask) => t.priority === "high").length;
    const byMedium = overdueTasks.filter((t: KvTask) => t.priority === "medium").length;
    const byLow = overdueTasks.filter((t: KvTask) => t.priority === "low").length;

    const todayFormatted = new Date().toLocaleDateString("en-ZA", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    // 5. Build summary badges
    const summaryBadges = [
      byCritical > 0
        ? `<span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:600;background:#fef2f2;color:#dc2626;margin-right:6px;">Critical: ${byCritical}</span>`
        : "",
      byHigh > 0
        ? `<span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:600;background:#fff7ed;color:#ea580c;margin-right:6px;">High: ${byHigh}</span>`
        : "",
      byMedium > 0
        ? `<span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:600;background:#fffbeb;color:#d97706;margin-right:6px;">Medium: ${byMedium}</span>`
        : "",
      byLow > 0
        ? `<span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:600;background:#f9fafb;color:#6b7280;margin-right:6px;">Low: ${byLow}</span>`
        : "",
    ]
      .filter(Boolean)
      .join("");

    // 6. Compose the body HTML
    const bodyHtml = `
      <p style="margin-bottom: 16px;">
        You have <strong style="color: #dc2626;">${overdueTasks.length}</strong> overdue task${overdueTasks.length !== 1 ? "s" : ""} that require${overdueTasks.length === 1 ? "s" : ""} attention.
      </p>

      <!-- Priority Summary -->
      <div style="margin-bottom: 20px;">
        ${summaryBadges}
      </div>

      <!-- Tasks Table -->
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        border-collapse: separate;
        overflow: hidden;
        margin-bottom: 20px;
      ">
        <thead>
          <tr style="background-color: #f9fafb;">
            <th style="padding: 10px 14px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e5e7eb;">
              Task
            </th>
            <th style="padding: 10px 10px; text-align: center; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e5e7eb;">
              Priority
            </th>
            <th style="padding: 10px 10px; text-align: center; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e5e7eb;">
              Due Date
            </th>
          </tr>
        </thead>
        <tbody>
          ${taskRows}
        </tbody>
      </table>

      <p style="font-size: 13px; color: #6b7280; margin-top: 16px;">
        Please review these items and update their status at your earliest convenience.
      </p>
    `;

    // 7. Build full email using the Navigate Wealth base template
    const footerSettings = await getFooterSettings();

    const html = createEmailTemplate(bodyHtml, {
      title: "Overdue Tasks Report",
      subtitle: todayFormatted,
      greeting: "Good morning,",
      buttonUrl: "https://www.navigatewealth.co/admin/tasks",
      buttonLabel: "Open Task Board",
      footerNote: "This is an automated daily digest from Navigate Wealth.",
      footerSettings,
    });

    // 8. Plain-text fallback
    const taskLines = overdueTasks
      .map((t: KvTask, i: number) => {
        const days = t.due_date ? daysOverdue(t.due_date) : 0;
        const dueStr = t.due_date ? formatDate(t.due_date) : "No date";
        return `  ${i + 1}. [${t.priority.toUpperCase()}] ${t.title} — due ${dueStr} (${days}d overdue)`;
      })
      .join("\n");

    const text = `
Overdue Tasks Report — ${todayFormatted}

Good morning,

You have ${overdueTasks.length} overdue task(s):

${taskLines}

Please review: https://www.navigatewealth.co/admin/tasks

—
This is an automated daily digest from Navigate Wealth.
    `.trim();

    // 9. Send
    const sent = await sendEmail({
      to: ADMIN_EMAIL,
      subject: `Overdue Tasks (${overdueTasks.length}) — ${todayFormatted}`,
      html,
      text,
    });

    log.info(`Digest email ${sent ? "sent" : "FAILED"} to ${ADMIN_EMAIL}`);

    // 10. Record the send in KV for deduplication
    if (sent) {
      await kv.set(dedupKvKey, { date: todayKey, overdueCount: overdueTasks.length });
    }

    return c.json({
      success: true,
      sent,
      overdue_count: overdueTasks.length,
      breakdown: { critical: byCritical, high: byHigh, medium: byMedium, low: byLow },
    });
  })
);

// ---------------------------------------------------------------------------
// GET /tasks-digest/health
// ---------------------------------------------------------------------------

app.get("/", (c) =>
  c.json({ service: "tasks-digest", status: "active", version: "1.0.0" })
);

export default app;