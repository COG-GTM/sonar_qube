const ALLOWED_ORIGINS = ["https://app.cal.com", "https://cal.com", process.env.NEXT_PUBLIC_WEBAPP_URL].filter(
  Boolean
) as string[];

export function validateOrigin(origin: string | null): boolean {
  if (!origin) return false;

  try {
    const originUrl = new URL(origin);
    return ALLOWED_ORIGINS.some((allowedOrigin) => {
      if (!allowedOrigin) return false;
      const allowedUrl = new URL(allowedOrigin);
      return originUrl.origin === allowedUrl.origin;
    });
  } catch {
    return false;
  }
}
