export interface AuthSession {
  user: {
    id: string;
    email: string;
    createdAt: number;
  };
}

interface AuthRequestPayload {
  email: string;
  password: string;
  turnstileToken?: string | null;
}

const readErrorDetail = async (response: Response) => {
  try {
    const data = await response.json() as { error?: string; message?: string };
    return data.message || data.error || '';
  } catch {
    return '';
  }
};

const withBase = (path: string) => {
  const base = (import.meta.env.VITE_API_BASE_URL || '').trim();
  return `${base}${path}`;
};

export const authClient = {
  async getSession() {
    const response = await fetch(withBase('/api/auth/session'), { credentials: 'include' });
    if (response.status === 401) return null;
    if (!response.ok) {
      const detail = await readErrorDetail(response);
      throw new Error(`session failed (${response.status}${detail ? `: ${detail}` : ''})`);
    }
    return response.json() as Promise<AuthSession>;
  },

  async signUp(email: string, password: string, turnstileToken?: string | null) {
    const response = await fetch(withBase('/api/auth/sign-up'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, turnstileToken } satisfies AuthRequestPayload),
    });
    if (!response.ok) {
      const detail = await readErrorDetail(response);
      throw new Error(`sign-up failed (${response.status}${detail ? `: ${detail}` : ''})`);
    }
    return response.json() as Promise<AuthSession>;
  },

  async signIn(email: string, password: string, turnstileToken?: string | null) {
    const response = await fetch(withBase('/api/auth/sign-in'), {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password, turnstileToken } satisfies AuthRequestPayload),
    });
    if (!response.ok) {
      const detail = await readErrorDetail(response);
      throw new Error(`sign-in failed (${response.status}${detail ? `: ${detail}` : ''})`);
    }
    return response.json() as Promise<AuthSession>;
  },

  async signOut() {
    const response = await fetch(withBase('/api/auth/sign-out'), {
      method: 'POST',
      credentials: 'include',
    });
    if (!response.ok) {
      const detail = await readErrorDetail(response);
      throw new Error(`sign-out failed (${response.status}${detail ? `: ${detail}` : ''})`);
    }
  },
};
