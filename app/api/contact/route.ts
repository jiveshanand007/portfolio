import { z } from "zod";
import { site } from "@/lib/site";

/**
 * The contact form's backend: validates a visitor's message and emails it to
 * the site owner through Resend (https://resend.com), using only `fetch`.
 *
 * Environment (never in code):
 *   RESEND_API_KEY   required; without it the form reports "not set up yet"
 *   CONTACT_TO       optional; where messages go (defaults to site.json `email`)
 *   CONTACT_FROM     optional; sender (defaults to Resend's test sender, which
 *                    can deliver only to the Resend account's own address)
 *
 * Spam: a hidden "website" field real visitors never fill, and a small
 * per-visitor limit kept in memory (best effort; resets when the server restarts).
 */

const Body = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().email().max(120),
  message: z.string().trim().min(10).max(4000),
  website: z.string().max(200).optional(), // honeypot
});

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 3;
const recent = new Map<string, number[]>();

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function allowed(ip: string, now = Date.now()): boolean {
  const hits = (recent.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) {
    recent.set(ip, hits);
    return false;
  }
  hits.push(now);
  recent.set(ip, hits);
  return true;
}

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return json({ ok: false, error: "Please add your name, a valid email, and a message of at least 10 characters." }, 400);
  }
  const { name, email, message, website } = parsed.data;

  // a filled honeypot is a bot: pretend it worked, send nothing
  if (website) return json({ ok: true }, 200);

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return json({ ok: false, error: "The contact form isn't set up yet.", notConfigured: true }, 503);
  }

  if (!allowed(clientIp(req))) {
    return json({ ok: false, error: "You've sent a few messages already. Please try again in an hour." }, 429);
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.CONTACT_FROM ?? "Portfolio contact <onboarding@resend.dev>",
      to: [process.env.CONTACT_TO ?? site.email],
      reply_to: email,
      subject: `Portfolio message from ${name}`,
      text: `${message}\n\n— ${name} <${email}>\n(sent from the contact form on your portfolio)`,
    }),
  }).catch(() => null);

  if (!res || !res.ok) {
    return json({ ok: false, error: "The message couldn't be sent right now. Please try again in a moment." }, 502);
  }
  return json({ ok: true }, 200);
}
