import { Resend } from "resend";

let resend;
function client() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY is not set — email sending is not configured.");
  }
  resend ||= new Resend(process.env.RESEND_API_KEY);
  return resend;
}

const FROM = process.env.RESEND_FROM_EMAIL || "Aerion Software <onboarding@resend.dev>";

export async function sendInviteEmail({ to, inviterName, workspaceName, inviteUrl }) {
  await client().emails.send({
    from: FROM,
    to,
    subject: `${inviterName} invited you to join ${workspaceName} on Aerion Software`,
    html: `
      <p>${inviterName} invited you to join <strong>${workspaceName}</strong> on Aerion Software.</p>
      <p><a href="${inviteUrl}">Accept the invite</a></p>
      <p style="color:#666;font-size:13px;">If the link doesn't work, go to sign up and choose "Join a workspace" — this invite's code is embedded in the link above.</p>
    `,
  });
}

export async function sendPasswordResetEmail({ to, resetUrl }) {
  await client().emails.send({
    from: FROM,
    to,
    subject: "Reset your Aerion Software password",
    html: `
      <p>Someone requested a password reset for this email address on Aerion Software.</p>
      <p><a href="${resetUrl}">Choose a new password</a></p>
      <p style="color:#666;font-size:13px;">This link expires in 1 hour. If you didn't request this, you can ignore this email — your password hasn't been changed.</p>
    `,
  });
}

export async function sendTaskDueReminder({ to, assigneeName, taskTitle, dueDate, taskUrl }) {
  await client().emails.send({
    from: FROM,
    to,
    subject: `Reminder: "${taskTitle}" is due soon`,
    html: `
      <p>Hi ${assigneeName},</p>
      <p>Your task <strong>${taskTitle}</strong> is due on ${dueDate}.</p>
      <p><a href="${taskUrl}">View task</a></p>
    `,
  });
}
