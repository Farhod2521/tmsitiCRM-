"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { apiFetch } from "@/lib/api";

export interface NotificationItem {
  key: string;
  section: "izohlar" | "hujjatlar" | "ijro";
  title: string;
  count: number;
  href: string;
}
export interface NotificationsData {
  total: number;
  items: NotificationItem[];
}

// Header (qo'ng'iroqcha) va menyu (qizil sonlar) bitta so'rovdan foydalanadi.
const EMPTY: NotificationsData = { total: 0, items: [] };
let data: NotificationsData = EMPTY;
let inflight: Promise<void> | null = null;
let lastFetch = 0;
let lastToken: string | null = null;
const listeners = new Set<(d: NotificationsData) => void>();
let timer: number | undefined;
const onFocus = () => { refreshNotifications(); };
const onMutated = () => { refreshNotifications(true); };

export function refreshNotifications(force = false): Promise<void> {
  const token = typeof window !== "undefined" ? localStorage.getItem("crm_token") : null;
  if (!token) return Promise.resolve();
  // Boshqa foydalanuvchi kirgan bo'lsa — eskisining sonlari ko'rinmasin
  if (token !== lastToken) {
    lastToken = token;
    data = EMPTY;
    listeners.forEach(l => l(data));
    force = true;
  }
  if (inflight) return inflight;
  if (!force && Date.now() - lastFetch < 5000) return Promise.resolve();
  inflight = apiFetch<NotificationsData>("/notifications")
    .then(d => { data = d ?? EMPTY; listeners.forEach(l => l(data)); })
    .catch(() => {})
    .finally(() => { inflight = null; lastFetch = Date.now(); });
  return inflight;
}

/** Bildirishnomalar — har 60 soniyada, sahifa almashganda va oynaga qaytilganda yangilanadi. */
export function useNotifications(): NotificationsData {
  const [state, setState] = useState<NotificationsData>(data);
  const pathname = usePathname();

  useEffect(() => {
    listeners.add(setState);
    // Bitta umumiy taymer — nechta komponent ishlatsa ham
    if (listeners.size === 1) {
      window.addEventListener("focus", onFocus);
      window.addEventListener("crm:mutated", onMutated);
      timer = window.setInterval(() => refreshNotifications(true), 60_000);
    }
    return () => {
      listeners.delete(setState);
      if (listeners.size === 0) {
        window.removeEventListener("focus", onFocus);
        window.removeEventListener("crm:mutated", onMutated);
        window.clearInterval(timer);
      }
    };
  }, []);

  useEffect(() => { refreshNotifications(); }, [pathname]);

  return state;
}

/** Menyu bandi uchun son: shu sahifaga olib boradigan bildirishnomalar yig'indisi. */
export function countForHref(d: NotificationsData, href: string): number {
  return d.items.filter(i => i.href === href).reduce((s, i) => s + i.count, 0);
}
