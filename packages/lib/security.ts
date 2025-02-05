import { z } from "zod";

// Allowed origins for postMessage communication
export const ALLOWED_ORIGINS = [
  "https://cal.com",
  "https://app.cal.com",
  "http://localhost:3000", // For development
  "http://localhost:3001", // For development iframe
] as const;

export const originSchema = z.enum(ALLOWED_ORIGINS);

/**
 * Verifies if a message origin is in our allowed list
 * @param origin - The origin to verify
 * @returns boolean indicating if origin is allowed
 */
export const verifyMessageOrigin = (origin: string): boolean => {
  const result = originSchema.safeParse(origin);
  return result.success;
};

/**
 * Gets the appropriate target origin for postMessage
 * If in development, returns localhost, otherwise returns production URL
 */
export const getTargetOrigin = (): string => {
  const isDevelopment = process.env.NODE_ENV === "development";
  return isDevelopment ? "http://localhost:3000" : "https://cal.com";
};
