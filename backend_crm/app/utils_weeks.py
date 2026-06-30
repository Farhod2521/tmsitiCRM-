"""Oyni taqvim haftalariga (Dushanba-Yakshanba) bo'lish — haftalik hisobot tizimi uchun."""
from datetime import date, timedelta
from calendar import monthrange

WEEKLY_MAX_TOTAL = 65  # bo'lim_ball oylik maksimumi — haftalar orasida taqsimlanadi

MON_NAMES_SHORT = [
    "Yan", "Fev", "Mar", "Apr", "May", "Iyun",
    "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek",
]


def get_month_weeks(year: int, month: int) -> list[dict]:
    """Berilgan oy ichidagi taqvim haftalarini qaytaradi (oy chegarasiga qisqartirilgan).

    Har bir element: {"week": 1.., "start": date, "end": date, "label": "1-7 iyun"}
    """
    first_day = date(year, month, 1)
    last_day = date(year, month, monthrange(year, month)[1])

    seen_mondays: set[date] = set()
    d = first_day
    while d <= last_day:
        monday = d - timedelta(days=d.weekday())
        seen_mondays.add(monday)
        d += timedelta(days=1)

    weeks = []
    for monday in sorted(seen_mondays):
        start = max(monday, first_day)
        end = min(monday + timedelta(days=6), last_day)
        weeks.append({"start": start, "end": end})

    # Chegaradagi juda qisqa (< 4 kun) haftalarni qo'shni haftaga qo'shib yuborish —
    # 1 kunlik "hafta" hisobot yuklash uchun noqulay
    MIN_DAYS = 4
    if len(weeks) > 1 and (weeks[0]["end"] - weeks[0]["start"]).days + 1 < MIN_DAYS:
        weeks[1]["start"] = weeks[0]["start"]
        weeks.pop(0)
    if len(weeks) > 1 and (weeks[-1]["end"] - weeks[-1]["start"]).days + 1 < MIN_DAYS:
        weeks[-2]["end"] = weeks[-1]["end"]
        weeks.pop()

    result = []
    for i, w in enumerate(weeks):
        start, end = w["start"], w["end"]
        if start.day == end.day:
            label = f"{start.day} {MON_NAMES_SHORT[month - 1]}"
        else:
            label = f"{start.day}-{end.day} {MON_NAMES_SHORT[month - 1]}"
        result.append({"week": i + 1, "start": start, "end": end, "label": label})
    return result


def weekly_max(year: int, month: int) -> float:
    """Shu oy uchun bitta haftaning maksimal balli (65 / haftalar soni)."""
    n = len(get_month_weeks(year, month))
    return round(WEEKLY_MAX_TOTAL / n, 2) if n else 0.0
