import { NextResponse } from "next/server";
import { getTasksDueForReminder, markDueReminderSent } from "@/lib/tasks";
import { sendTaskDueReminder } from "@/lib/email";

function formatDueDate(date) {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
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
  let sent = 0;
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
      await markDueReminderSent(task.id);
      sent += 1;
    } catch {
      failed += 1;
    }
  }

  return NextResponse.json({ checked: tasks.length, sent, failed });
}
