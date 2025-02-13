import { WEBAPP_URL } from "./constants";
import { isOriginAllowed } from "./isOriginAllowed";

/**
 * Validates the origin of a postMessage event against allowed origins
 * @param origin The origin to validate
 * @returns boolean indicating if the origin is allowed
 */

export function validatePostMessageOrigin(origin: string): boolean {
  // Default allowed origins include WEBAPP_URL and its embed subdomain
  const defaultAllowedOrigins = [
    WEBAPP_URL,
    WEBAPP_URL.replace("https://", "https://embed."),
    "http://localhost:3000",
  ];

  return isOriginAllowed(origin, defaultAllowedOrigins);
}

/**
 * Type-safe wrapper for postMessage that enforces origin validation
 * @param target The target window to post to
 * @param message The message to send
 * @param targetOrigin The target origin (must be explicit, no wildcards)
 */
export function securePostMessage<T extends Record<string, unknown>>(
  target: Window,
  message: T,
  targetOrigin: string
): void {
  if (!targetOrigin || targetOrigin === "*") {
    throw new Error("Target origin must be explicitly specified");
  }
  target.postMessage(message, targetOrigin);
}
