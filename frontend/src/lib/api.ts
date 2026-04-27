export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), init?.timeoutMs ?? 30000);
  const base = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
  const url = `${base}${path}`;
  const isDevBypassEnabled =
    process.env.NODE_ENV === "development" &&
    (process.env.NEXT_PUBLIC_API_URL?.includes("localhost") ?? false) &&
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY === "your-firebase-api-key";
  const authHeader = isDevBypassEnabled ? { Authorization: "Bearer dev-bypass-token" } : {};

  try {
    const response = await fetch(url, {
      credentials: "include",
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...authHeader,
        ...(init?.headers ?? {}),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Request failed with ${response.status}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export function q(value: string | number | undefined | null) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return String(value);
}

export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/health`);
    return res.ok;
  } catch {
    return false;
  }
}
