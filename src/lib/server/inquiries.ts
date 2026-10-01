import { randomUUID } from "node:crypto";
import type { Actor } from "./access";
import { inquiryReadDecision } from "./access";
import { getDb } from "./db";

export function addInquiry(input: { name: string; email: string; message: string }) {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const message = input.message.trim();
  if (name.length < 2 || name.length > 80) return { error: "Add your name." as const };
  if (email.length > 120 || !email.includes("@") || !email.includes(".")) {
    return { error: "Add an email so the seller can reply." as const };
  }
  if (message.length < 8 || message.length > 2000) return { error: "Write a short note." as const };
  getDb()
    .prepare("INSERT INTO inquiries (id, name, email, message, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(randomUUID(), name, email, message, Date.now());
  return { ok: true as const };
}

export function listInquiries() {
  return getDb()
    .prepare("SELECT id, name, email, message, created_at FROM inquiries ORDER BY created_at DESC LIMIT 40")
    .all() as { id: string; name: string; email: string; message: string; created_at: number }[];
}

export function inquiriesFor(account: Actor | null) {
  const decision = inquiryReadDecision(account);
  if (decision) return decision;
  return { status: 200 as const, inquiries: listInquiries() };
}
