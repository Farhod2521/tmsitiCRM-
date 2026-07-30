"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import TelegramLinkPrompt from "@/components/auth/TelegramLinkPrompt";
import CheckInPrompt from "@/components/auth/CheckInPrompt";

interface Me { telegram_id?: number | null; }

/** Har bir sahifa yuklanganda (bir marta): agar xodim hali Telegramga
 * bog'lanmagan bo'lsa — bog'lash modalini, bog'langan bo'lsa-yu bugun
 * ishga kelganini belgilamagan bo'lsa — "Ishga keldim" modalini ko'rsatadi. */
export default function PostLoginPrompts() {
  const [mode, setMode] = useState<"none" | "telegram" | "checkin">("none");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await apiFetch<Me>("/auth/me");
        if (cancelled) return;
        if (!me.telegram_id) {
          setMode("telegram");
          return;
        }
        const today = await apiFetch<unknown | null>("/attendance/today");
        if (cancelled) return;
        if (!today) setMode("checkin");
      } catch {
        // login qilinmagan yoki so'rov xato bo'lsa — hech narsa ko'rsatilmaydi
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (mode === "telegram") return <TelegramLinkPrompt onClose={() => setMode("none")} />;
  if (mode === "checkin")  return <CheckInPrompt onClose={() => setMode("none")} />;
  return null;
}
