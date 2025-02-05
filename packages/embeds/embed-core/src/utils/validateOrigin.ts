export function validateMessageOrigin(origin: string) {
  try {
    const allowedOrigins = [
      process.env.NEXT_PUBLIC_WEBAPP_URL,
      "https://app.cal.com",
      window.location.origin,
    ].filter(Boolean);

    return allowedOrigins.some((allowedOrigin) => {
      try {
        return new URL(allowedOrigin as string).origin === new URL(origin).origin;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}
