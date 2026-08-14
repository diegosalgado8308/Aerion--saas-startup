import { NextResponse } from "next/server";
import { getTasksDueForReminder, markManyDueRemindersSent } from "@/lib/tasks";
import { sendTaskDueReminder } from "@/lib/email";

/**
 * No per-recipient locale is stored anywhere in this app, so there's no
 * real "their locale" to format for here (unlike on-page dates, which defer
 * to the browser's actual locale via FormattedDate). ISO 8601 sidesteps the
 * question rather than guessing: every locale reads YYYY-MM-DD unambiguously,
 * whereas a hardcoded "en-US" MM/DD style is actively misleading to a
 * recipient who reads dates DD/MM.
 */
function formatDueDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function taskUrl(task) {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  return `${base}/projects/${task.projectId}/tasks/${task.id}`;
}

/**
 * Triggered by Vercel Cron (see vercel.json). Requires CRON_SECRET — this
 * route sits outside the session-based auth gate in proxy.js (a cron
 * trigger has no user cookie), so the secret is the only thing standing
 * between this endpoint and the public internet.
 */
export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const tasks = await getTasksDueForReminder();
  const sentTaskIds = [];
  let failed = 0;

  for (const task of tasks) {
    try {
      await sendTaskDueReminder({
        to: task.assignee.email,
        assigneeName: task.assignee.name,
        taskTitle: task.title,
        dueDate: formatDueDate(task.dueDate),
        taskUrl: taskUrl(task),
      });
      sentTaskIds.push(task.id);
    } catch {
      failed += 1;
    }
  }

  // One UPDATE for every task reminded about this run, instead of one per task.
  await markManyDueRemindersSent(sentTaskIds);

  return NextResponse.json({ checked: tasks.length, sent: sentTaskIds.length, failed });
}
