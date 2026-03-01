function parseCookieValue(cookieHeader: string | null, key: string): string | null {
  if (!cookieHeader) return null;
  const items = cookieHeader.split(';').map((part) => part.trim());
  const found = items.find((item) => item.startsWith(`${key}=`));
  if (!found) return null;

  const raw = found.slice(key.length + 1);
  if (!raw) return null;

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function firstForwardedIp(raw: string | null): string | null {
  if (!raw) return null;
  const first = raw.split(',')[0]?.trim();
  return first || null;
}

export function actorFromRequest(request: Request): {
  actorIdentifier: string;
  actorIp: string | null;
  actorUserAgent: string | null;
} {
  const appUser = parseCookieValue(request.headers.get('cookie'), 'app_user');
  const actorIdentifier = appUser || 'unknown-user';
  const actorIp =
    firstForwardedIp(request.headers.get('x-forwarded-for')) ??
    firstForwardedIp(request.headers.get('x-real-ip')) ??
    null;
  const actorUserAgent = request.headers.get('user-agent');

  return {
    actorIdentifier,
    actorIp,
    actorUserAgent,
  };
}
