"""Tashqi havo parametrlari — ШНҚ 2.01.01-22 «Лойиҳалаш учун иқлимий ва физикавий-геологик
маълумотлар», 4-жадвал (Ташқи ҳавонинг параметрлари).

Har bir stansiya uchun:
  t_hisob — eng sovuq vaqtdagi harorat, ta'minlanganlik 0,92 (17-ustun) — issiqlik yo'qotishi Δt uchun;
  z       — isitish davri: sutkalik o'rtacha harorat t ≤ 8 °C bo'lgan davr davomiyligi, sutka (19-ustun);
  t_ort   — shu davrning o'rtacha harorati, °C (20-ustun).
Dd (иситиш даврининг градус-суткалари) = (t_ichki − t_ort) × z.

Tanlangan tuman jadvalda bo'lmasa — viloyat markazidagi stansiya olinadi."""
import re
from typing import Optional

# viloyat → {stansiya: (t_hisob [17-ust.], z [19-ust.], t_ort [20-ust.])}
STATIONS: dict[str, dict[str, tuple[float, int, float]]] = {
    "Қорақалпоғистон Республикаси": {
        "Қорақалпоқ": (-29, 174, -2.4), "Мўйноқ": (-23, 167, -1.2), "Нукус": (-24, 143, -0.6), "Чимбой": (-24, 163, -1.3),
    },
    "Андижон вилояти": {"Андижон": (-16, 130, 1.6), "Хонобод": (-18, 140, 1.1)},
    "Бухоро вилояти": {"Бухоро": (-16, 126, 3.1), "Ғиждувон": (-17, 127, 2.9), "Қоракўл": (-15, 122, 3.2)},
    "Жиззах вилояти": {"Ғаллаорол": (-23, 144, 1.4), "Жиззах": (-19, 126, 2.7), "Дўстлик": (-18, 126, 2.5)},
    "Қашқадарё вилояти": {
        "Ғузор": (-14, 100, 4.7), "Қарши": (-18, 115, 3.7), "Минчукур": (-17, 187, 1.6),
        "Муборак": (-16, 122, 3.5), "Шаҳрисабз": (-14, 115, 4.1),
    },
    "Навоий вилояти": {"Зарафшон": (-15, 136, 1.5), "Навоий": (-16, 123, 3.5), "Нурота": (-19, 136, 2.8), "Учқудуқ": (-20, 144, 1.6)},
    "Наманган вилояти": {"Косонсой": (-15, 138, 2.0), "Наманган": (-17, 128, 1.5), "Поп": (-13, 125, 1.8)},
    "Самарқанд вилояти": {"Каттақўрғон": (-16, 134, 2.8), "Қўшработ": (-20, 145, 1.9), "Самарқанд": (-15, 133, 3.3)},
    "Сурхондарё вилояти": {"Денов": (-12, 89, 5.1), "Термиз": (-12, 91, 4.5), "Шеробод": (-10, 80, 5.4)},
    "Сирдарё вилояти": {"Гулистон": (-22, 130, 1.8), "Сирдарё": (-21, 134, 1.8), "Янгиер": (-19, 121, 2.9)},
    "Тошкент вилояти": {
        "Олмалиқ": (-15, 124, 3.2), "Оҳангарон": (-15, 135, 2.9), "Бекобод": (-18, 112, 3.4), "Ойгаинг": (-23, 236, -2.7),
        "Тошкент": (-16, 129, 2.7), "Чорвоқ": (-16, 144, 1.7), "Чирчиқ": (-16, 130, 2.8),
    },
    "Фарғона вилояти": {"Қўқон": (-14, 131, 1.8), "Фарғона": (-15, 132, 1.9), "Шоҳимардон": (-15, 160, 0.6)},
    "Хоразм вилояти": {"Урганч": (-21, 148, 0.8), "Хива": (-20, 143, 0.5)},
}
STATIONS["Тошкент шаҳри"] = {"Тошкент": STATIONS["Тошкент вилояти"]["Тошкент"]}

# Viloyat markazi (tuman jadvalda bo'lmasa)
CENTER = {
    "Қорақалпоғистон Республикаси": "Нукус", "Андижон вилояти": "Андижон", "Бухоро вилояти": "Бухоро",
    "Жиззах вилояти": "Жиззах", "Қашқадарё вилояти": "Қарши", "Навоий вилояти": "Навоий",
    "Наманган вилояти": "Наманган", "Самарқанд вилояти": "Самарқанд", "Сурхондарё вилояти": "Термиз",
    "Сирдарё вилояти": "Гулистон", "Тошкент вилояти": "Тошкент", "Тошкент шаҳри": "Тошкент",
    "Фарғона вилояти": "Фарғона", "Хоразм вилояти": "Урганч",
}

# Nomi stansiyaga to'g'ri kelmaydigan, lekin hududida stansiya joylashgan tumanlar
ALIAS = {"Бўстонлиқ тумани": "Чорвоқ"}


def _base(name: str) -> str:
    return re.sub(r"\s+(тумани|шаҳри)$", "", (name or "").strip())


def lookup(viloyat: Optional[str], tuman: Optional[str]) -> Optional[dict]:
    """{stansiya, t_hisob, z, t_ort, markaz: bool} yoki None (viloyat tanlanmagan/noma'lum)."""
    st = STATIONS.get((viloyat or "").strip())
    if not st:
        return None
    name = ALIAS.get((tuman or "").strip()) or _base(tuman or "")
    found = name in st
    if not found:
        name = CENTER.get(viloyat.strip(), next(iter(st)))
    markaz = not found and len(st) > 1   # Toshkent shahri — yagona stansiya, "markaz" deb ko'rsatilmaydi
    t_hisob, z, t_ort = st[name]
    return {"stansiya": name, "t_hisob": t_hisob, "z": z, "t_ort": t_ort, "markaz": markaz}
