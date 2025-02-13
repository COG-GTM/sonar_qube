import { WEBAPP_URL } from "./constants";

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

  return defaultAllowedOrigins.includes(origin);
}
