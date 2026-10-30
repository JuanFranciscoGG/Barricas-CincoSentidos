export function appUrl(path: string): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

export function publicWineUrl(publicToken: string): string {
  return appUrl(`/wine/${publicToken}`);
}
