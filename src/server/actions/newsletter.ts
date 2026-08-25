"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

const newsletterSchema = z.object({
  email: z.string().trim().email(),
  language: z.enum(["en", "ar"]),
});

export interface NewsletterState {
  ok: boolean;
  error?: string;
}

export async function subscribeToNewsletter(input: { email: string; language: string }): Promise<NewsletterState> {
  const parsed = newsletterSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "invalidEmail" };
  }

  const ip = await getClientIp();
  if (!rateLimit(`newsletter:${ip}`, 5, 60 * 60 * 1000)) {
    return { ok: false, error: "generic" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("newsletter_subscribers").insert({
    email: parsed.data.email,
    language: parsed.data.language,
  });

  if (error) {
    if (error.code === "23505") return { ok: false, error: "alreadySubscribed" };
    return { ok: false, error: "generic" };
  }
  return { ok: true };
}
