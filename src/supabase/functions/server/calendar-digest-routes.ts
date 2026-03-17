/**
 * ****************************************************************************
 * CALENDAR DAILY DIGEST ROUTES
 * ****************************************************************************
 *
 * VERSION: 1.0.0
 *
 * Sends a daily calendar digest email each weekday morning at 06:00 SAST.
 * Lists all calendar events for the current day.
 *
 * Endpoint:
 *   POST /calendar-digest/send-daily
 *
 * Auth: Requires SUPABASE_SERVICE_ROLE_KEY or SUPER_ADMIN_PASSWORD
 *       via the Authorization Bearer header (cron / server-to-server only).
 *
 * ****************************************************************************
 */

import { Hono } from "npm:hono";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import { createModuleLogger } from "./stderr-logger.ts";
import { asyncHandler } from "./error.middleware.ts";
import {
  sendEmail,
  createEmailTemplate,
  getFooterSettings,
} from "./email-service.tsx";

const app = new Hono();
const log = createModuleLogger("calendar-digest");

const ADMIN_EMAIL = "info@navigatewealth.co";

// ---------------------------------------------------------------------------
// Supabase client — service role for reading across all users
// ---------------------------------------------------------------------------

const getSupabase = () =>
  createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(isoStr: string): string {
  try {
    return new Date(isoStr).toLocaleTimeString("en-ZA", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Africa/Johannesburg",
    });
  } catch {
    return isoStr;
  }
}

function formatDate(isoStr: string): string {
  try {
    return new Date(isoStr).toLocaleDateString("en-ZA", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Africa/Johannesburg",
    });
  } catch {
    return isoStr;
  }
}

/** Map event_type to a human label. */
const EVENT_TYPE_LABELS: Record<string, string> = {
  meeting: "Meeting",
  review: "Review",
  call: "Call",
  webinar: "Webinar",
  internal: "Internal",
  consultation: "Consultation",
  deadline: "Deadline",
  other: "Other",
};

/** Map event_type to badge colours for the email. */
const EVENT_TYPE_COLOURS: Record<string, { bg: string; text: string }> = {
  meeting: { bg: "#6d28d9", text: "#ffffff" },
  review: { bg: "#2563eb", text: "#ffffff" },
  call: { bg: "#059669", text: "#ffffff" },
  webinar: { bg: "#d97706", text: "#ffffff" },
  internal: { bg: "#6b7280", text: "#ffffff" },
  consultation: { bg: "#7c3aed", text: "#ffffff" },
  deadline: { bg: "#dc2626", text: "#ffffff" },
  other: { bg: "#9ca3af", text: "#ffffff" },
};

// ---------------------------------------------------------------------------
// Auth middleware — cron-only (service-role key or super-admin password)
// ---------------------------------------------------------------------------

async function requireCronAuth(
  c: { req: { header: (n: string) => string | undefined } },
  next: () => Promise<void>
) {
  const authHeader = c.req.header("Authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");

  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const superAdminPw = Deno.env.get("SUPER_ADMIN_PASSWORD") || "";

  if (
    (serviceRoleKey && token === serviceRoleKey) ||
    (superAdminPw && token === superAdminPw)
  ) {
    return next();
  }

  return new Response("Unauthorized — cron auth required", { status: 401 });
}

// ---------------------------------------------------------------------------
// POST /calendar-digest/send-daily
// ---------------------------------------------------------------------------

app.post(
  "/send-daily",
  requireCronAuth,
  asyncHandler(async (c) => {
    log.info("=== Daily Calendar Digest: Starting ===");

    // 1. Determine today's boundaries in SAST (UTC+2)
    const now = new Date();
    const sastOffset = 2 * 60 * 60 * 1000;
    const sastNow = new Date(now.getTime() + sastOffset);
    const todayStart = new Date(
      Date.UTC(
        sastNow.getUTCFullYear(),
        sastNow.getUTCMonth(),
        sastNow.getUTCDate(),
        0, 0, 0, 0
      )
    );
    // Convert back to UTC for the DB query
    const dayStartUtc = new Date(todayStart.getTime() - sastOffset);
    const dayEndUtc = new Date(dayStartUtc.getTime() + 24 * 60 * 60 * 1000);

    log.info(
      `Querying events between ${dayStartUtc.toISOString()} and ${dayEndUtc.toISOString()}`
    );

    // 2. Query all events for today across all users
    const { data: events, error } = await getSupabase()
      .from("events")
      .select("*, client:clients(id, full_name, email)")
      .gte("start_at", dayStartUtc.toISOString())
      .lt("start_at", dayEndUtc.toISOString())
      .neq("status", "cancelled")
      .order("start_at", { ascending: true });

    if (error) {
      log.error("Failed to query calendar events", error);
      return c.json({ success: false, error: `DB query failed: ${error.message}` }, 500);
    }

    const todayFormatted = new Date().toLocaleDateString("en-ZA", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: "Africa/Johannesburg",
    });

    if (!events || events.length === 0) {
      log.info("No calendar events for today — sending 'clear day' email");

      const footerSettings = await getFooterSettings();
      const html = createEmailTemplate(
        `<p>You have <strong>no events</strong> scheduled for today.</p>
         <p style="font-size: 13px; color: #6b7280; margin-top: 12px;">
           Enjoy the free time — or use it to catch up on pending tasks.
         </p>`,
        {
          title: "Daily Calendar",
          subtitle: todayFormatted,
          greeting: "Good morning,",
          buttonUrl: "https://navigatewealth.co/admin/calendar",
          buttonLabel: "Open Calendar",
          footerNote: "This is an automated daily digest from Navigate Wealth.",
          footerSettings,
        }
      );

      const sent = await sendEmail({
        to: ADMIN_EMAIL,
        subject: `Daily Calendar — ${todayFormatted} (No events)`,
        html,
        text: `Daily Calendar — ${todayFormatted}\n\nNo events scheduled for today.\n\nOpen calendar: https://navigatewealth.co/admin/calendar`,
      });

      return c.json({ success: true, sent, event_count: 0 });
    }

    log.info(`Found ${events.length} event(s) for today — building digest`);

    // 3. Build event table rows
    const eventRows = events
      .map((evt: Record<string, unknown>) => {
        const eventType = (evt.event_type as string) || "other";
        const typeLabel = EVENT_TYPE_LABELS[eventType] || "Other";
        const typeColour = EVENT_TYPE_COLOURS[eventType] || EVENT_TYPE_COLOURS.other;
        const timeStr = `${formatTime(evt.start_at as string)} – ${formatTime(evt.end_at as string)}`;
        const clientName =
          (evt.client as Record<string, unknown>)?.full_name || "—";
        const location = (evt.location as string) || (evt.video_link as string) || "—";

        return `
          <tr>
            <td style="padding: 12px 14px; border-bottom: 1px solid #f3f4f6; vertical-align: top;">
              <div style="font-weight: 600; color: #111827; font-size: 14px; margin-bottom: 3px;">
                ${evt.title}
              </div>
              ${evt.description ? `<div style="font-size: 12px; color: #6b7280; margin-top: 2px;">${(evt.description as string).substring(0, 80)}${(evt.description as string).length > 80 ? '…' : ''}</div>` : ""}
            </td>
            <td style="padding: 12px 10px; border-bottom: 1px solid #f3f4f6; text-align: center; vertical-align: top;">
              <span style="
                display: inline-block;
                padding: 2px 10px;
                border-radius: 999px;
                font-size: 11px;
                font-weight: 600;
                background-color: ${typeColour.bg};
                color: ${typeColour.text};
              ">${typeLabel}</span>
            </td>
            <td style="padding: 12px 10px; border-bottom: 1px solid #f3f4f6; text-align: center; vertical-align: top; white-space: nowrap;">
              <div style="font-size: 13px; color: #374151; font-weight: 600;">${timeStr}</div>
            </td>
            <td style="padding: 12px 10px; border-bottom: 1px solid #f3f4f6; vertical-align: top;">
              <div style="font-size: 13px; color: #374151;">${clientName}</div>
            </td>
            <td style="padding: 12px 10px; border-bottom: 1px solid #f3f4f6; vertical-align: top;">
              <div style="font-size: 12px; color: #6b7280;">${location}</div>
            </td>
          </tr>`;
      })
      .join("");

    // 4. Summary by event type
    const typeCounts: Record<string, number> = {};
    for (const evt of events) {
      const t = (evt.event_type as string) || "other";
      typeCounts[t] = (typeCounts[t] || 0) + 1;
    }

    const summaryBadges = Object.entries(typeCounts)
      .map(([type, count]) => {
        const colour = EVENT_TYPE_COLOURS[type] || EVENT_TYPE_COLOURS.other;
        const label = EVENT_TYPE_LABELS[type] || "Other";
        return `<span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:600;background:${colour.bg}20;color:${colour.bg};margin-right:6px;margin-bottom:4px;">${label}: ${count}</span>`;
      })
      .join("");

    // 5. Compose body HTML
    const bodyHtml = `
      <p style="margin-bottom: 16px;">
        You have <strong style="color: #6d28d9;">${events.length}</strong> event${events.length !== 1 ? "s" : ""} scheduled for today.
      </p>

      <!-- Type Summary -->
      <div style="margin-bottom: 20px;">
        ${summaryBadges}
      </div>

      <!-- Events Table -->
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
              Event
            </th>
            <th style="padding: 10px 10px; text-align: center; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e5e7eb;">
              Type
            </th>
            <th style="padding: 10px 10px; text-align: center; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e5e7eb;">
              Time
            </th>
            <th style="padding: 10px 10px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e5e7eb;">
              Client
            </th>
            <th style="padding: 10px 10px; text-align: left; font-size: 12px; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 2px solid #e5e7eb;">
              Location
            </th>
          </tr>
        </thead>
        <tbody>
          ${eventRows}
        </tbody>
      </table>

      <p style="font-size: 13px; color: #6b7280; margin-top: 16px;">
        Have a productive day!
      </p>
    `;

    // 6. Build full email
    const footerSettings = await getFooterSettings();

    const html = createEmailTemplate(bodyHtml, {
      title: "Daily Calendar",
      subtitle: todayFormatted,
      greeting: "Good morning,",
      buttonUrl: "https://navigatewealth.co/admin/calendar",
      buttonLabel: "Open Calendar",
      footerNote: "This is an automated daily digest from Navigate Wealth.",
      footerSettings,
    });

    // 7. Plain-text fallback
    const eventLines = events
      .map((evt: Record<string, unknown>, i: number) => {
        const timeStr = `${formatTime(evt.start_at as string)} – ${formatTime(evt.end_at as string)}`;
        const typeLabel = EVENT_TYPE_LABELS[(evt.event_type as string) || "other"] || "Other";
        return `  ${i + 1}. [${typeLabel}] ${evt.title} — ${timeStr}`;
      })
      .join("\n");

    const text = `
Daily Calendar — ${todayFormatted}

Good morning,

You have ${events.length} event(s) scheduled for today:

${eventLines}

Open calendar: https://navigatewealth.co/admin/calendar

—
This is an automated daily digest from Navigate Wealth.
    `.trim();

    // 8. Send
    const sent = await sendEmail({
      to: ADMIN_EMAIL,
      subject: `Daily Calendar (${events.length}) — ${todayFormatted}`,
      html,
      text,
    });

    log.info(`Calendar digest email ${sent ? "sent" : "FAILED"} to ${ADMIN_EMAIL}`);

    return c.json({
      success: true,
      sent,
      event_count: events.length,
      by_type: typeCounts,
    });
  })
);

export default app;
