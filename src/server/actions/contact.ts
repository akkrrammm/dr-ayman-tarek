"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

const contactMessageSchema = z.object({
  fullName: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  email: z.string().trim().email(),
  service: z.string().trim().optional(),
  message: z.string().trim().optional(),
});

export interface ContactFormState {
  ok: boolean;
  error?: string;
}

export async function submitContactMessage(input: {
  fullName: string;
  phone: string;
  email: string;
  service?: string;
  message?: string;
}): Promise<ContactFormState> {
  const parsed = contactMessageSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please check the form fields and try again." };
  }

  const ip = await getClientIp();
  if (!rateLimit(`contact:${ip}`, 5, 10 * 60 * 1000)) {
    return { ok: false, error: "Too many submissions. Please try again in a few minutes." };
  }

  const supabase = await createClient();
  // Anon insert-only RLS policy — never .select() the row back (no read
  // access for anon, PostgREST would otherwise fail trying to return it).
  const { error } = await supabase.from("contact_messages").insert({
    full_name: parsed.data.fullName,
    phone: parsed.data.phone,
    email: parsed.data.email,
    service_of_interest: parsed.data.service || null,
    message: parsed.data.message || null,
  });

  if (error) {
    return { ok: false, error: "Something went wrong. Please try again or contact us directly." };
  }
  return { ok: true };
}
