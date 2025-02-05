import type { WEBAPP_URL } from "@calcom/lib/constants";

type AllowedOrigin = typeof WEBAPP_URL | `${typeof WEBAPP_URL}/*`;

export const validateOrigin = (origin: string, allowedOrigins: AllowedOrigin[]): boolean => {
  return allowedOrigins.some((allowed) => {
    if (allowed.endsWith("/*")) {
      const prefix = allowed.slice(0, -2);
      return origin.startsWith(prefix);
    }
    return origin === allowed;
  });
};

export const sendSafeMessage = (target: Window, message: unknown, allowedOrigin: AllowedOrigin) => {
  target.postMessage(message, allowedOrigin);
};
