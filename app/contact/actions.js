"use server";

import { prisma } from "@/lib/prisma";

export async function submitLead(_prevState, formData) {
  const name = formData.get("name")?.toString().trim();
  const email = formData.get("email")?.toString().trim().toLowerCase();
  const company = formData.get("company")?.toString().trim() || null;
  const budget = formData.get("budget")?.toString().trim() || null;
  const message = formData.get("message")?.toString().trim();

  if (!name || !email || !message) {
    return { ok: false, error: "Please fill in your name, email, and project details." };
  }

  await prisma.lead.create({ data: { name, email, company, budget, message } });

  return { ok: true, error: null };
}
