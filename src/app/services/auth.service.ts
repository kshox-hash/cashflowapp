// src/services/auth.service.ts

const TOKEN_KEY = "cashflow_auth_token";
const USER_KEY = "cashflow_user";

type AuthUser = {
  id: string;
  companyId: string;
  email: string;
  role: string;
};

type LoginResponse = {
  ok: boolean;
  message?: string;
  token?: string;
  user?: AuthUser;
};

export async function login(
  email: string,
  password: string
): Promise<AuthUser | undefined> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "https://cashflow-axxk.onrender.com/api";
  const response = await fetch(
    `${baseUrl}/auth/login`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
      }),
    }
  );

  if (!response.body) {
    throw new Error("El servidor respondió vacío");
  }

  const data = (await response.json()) as LoginResponse;

  if (!response.ok || data.ok !== true) {
    throw new Error(data.message || "Error al iniciar sesión");
  }

  if (!data.token) {
    throw new Error("El servidor no devolvió token");
  }

  localStorage.setItem(TOKEN_KEY, data.token);
  if (data.user) {
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  }
  // Cookie for server-side middleware route protection
  document.cookie = `${TOKEN_KEY}=${data.token}; path=/; SameSite=Lax`;

  return data.user;
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  // Clear middleware cookie
  document.cookie = `${TOKEN_KEY}=; path=/; max-age=0`;
}

export function getUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function getToken() {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem(TOKEN_KEY);
}

export function isLoggedIn() {
  return Boolean(getToken());
}