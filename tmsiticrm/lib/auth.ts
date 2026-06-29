import type { LoginResponse } from "./api";

const TOKEN_KEY = "crm_token";
const USER_KEY  = "crm_user";
const EXTRA_KEY = "crm_profile_extra";

export interface ProfileExtra {
  email?: string;
  ish_staji?: number;
}

export function getProfileExtra(): ProfileExtra {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(EXTRA_KEY) || "{}"); }
  catch { return {}; }
}

export function saveProfileExtra(extra: ProfileExtra) {
  localStorage.setItem(EXTRA_KEY, JSON.stringify(extra));
}

export function saveAuth(data: LoginResponse) {
  localStorage.setItem(TOKEN_KEY, data.access_token);
  localStorage.setItem(USER_KEY, JSON.stringify(data));
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getUser(): LoginResponse | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getRoleRedirect(role: string): string {
  switch (role) {
    case "superadmin":
    case "direktor":
    case "zamdirektor":          return "/superadmin";
    case "bolim_boshligi":
    case "boshqarma_boshligi":   return "/bolimboshliq/kpi";
    case "kadr":
    case "ijro":                 return "/xodim/kpi";
    case "xodim":                return "/xodim";
    default:                     return "/login";
  }
}
