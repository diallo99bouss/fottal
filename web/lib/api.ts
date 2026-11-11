// Appels à l'API Express (/api/...). Le cookie de session est envoyé automatiquement.

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

// Émis quand la session a expiré : AuthProvider renvoie vers la page de connexion
export const SESSION_EXPIREE = "fottal:session-expiree";

export async function api<T = unknown>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch("/api" + url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && url !== "/auth/login" && url !== "/auth/me") {
    window.dispatchEvent(new Event(SESSION_EXPIREE));
  }
  if (!res.ok) throw new ApiError(data.erreur || `Erreur ${res.status}`, res.status);
  return data as T;
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Erreur inattendue");
