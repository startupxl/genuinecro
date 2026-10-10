// fetch() that attaches the signed-in user's Firebase ID token when there is
// one. Anonymous visitors (the free first scan) simply send no token.
//
// The Firebase client is imported lazily so a failure to initialise it (or a
// test environment without it) can never block a request.
async function getIdToken(): Promise<string | null> {
  try {
    const { auth } = await import("@/integrations/firebase/client");
    return (await auth.currentUser?.getIdToken()) ?? null;
  } catch {
    return null;
  }
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getIdToken();
  if (!token) return fetch(path, init);
  return fetch(path, {
    ...init,
    headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${token}` },
  });
}
