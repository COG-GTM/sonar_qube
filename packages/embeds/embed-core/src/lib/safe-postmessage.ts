import { z } from "zod";

export const ALLOWED_ORIGINS = ["https://cal.com", "https://app.cal.com"] as const;
export type AllowedOrigin = (typeof ALLOWED_ORIGINS)[number];

export function validateMessageOrigin(origin: string): origin is AllowedOrigin {
  return ALLOWED_ORIGINS.includes(origin as AllowedOrigin);
}

export function sendSafeMessage(target: Window, message: unknown, origin: AllowedOrigin) {
  target.postMessage(message, origin);
}

export const messageSchema = z.object({
  type: z.string(),
  data: z.unknown(),
});
