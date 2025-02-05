import { WEBAPP_URL } from "@calcom/lib/constants";

export const ALLOWED_ORIGINS = [
  WEBAPP_URL,
  "https://app.cal.com",
  "https://cal.com",
  // Allow localhost for development
  "http://localhost:3000",
  "http://localhost:3001",
  "http://localhost:3002",
] as const;

export function verifyPostMessageOrigin(origin: string): boolean {
  return ALLOWED_ORIGINS.some(
    (allowedOrigin) =>
      origin === allowedOrigin ||
      origin.startsWith(`${allowedOrigin}/`) ||
      // Support custom deployment domains
      (origin.startsWith("https://") && origin.endsWith(".cal.com"))
  );
}

export function sendSafeMessage(target: Window, message: Record<string, unknown>) {
  // Use * for embed scenarios where we don't know the exact origin
  // This is safe because we verify incoming messages' origins
  target.postMessage(message, "*");
}
