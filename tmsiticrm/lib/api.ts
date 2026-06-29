const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface LoginResponse {
  access_token: string;
  token_type: string;
  id: number;
  full_name: string;
  role: string;
  department_id: number | null;
  phone: string;
}

export async function loginApi(phone: string, password: string): Promise<LoginResponse> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, password }),
    });
  } catch {
    throw new Error("Server bilan ulanib bo'lmadi. Backend ishlayaptimi?");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Telefon raqam yoki parol noto'g'ri");
  }

  return res.json();
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = typeof window !== "undefined"
    ? localStorage.getItem("crm_token")
    : null;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Server xatosi");
  }

  return res.json();
}
