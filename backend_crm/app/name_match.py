"""Turniket xlsx eksportidagi ismlarni (krill yoki lotin, to'liq ism-familiya-sharif)
tizimdagi xodim yozuvi ("Familiya I." formatida, lotincha) bilan moslashtirish.
Qo'shimcha kutubxonasiz — o'zbek krill alifbosini rasmiy lotin transliteratsiyasiga
o'girib, so'ng tizimning o'z "Familiya I." konvensiyasiga tushirib solishtiradi."""
import re
from typing import Dict, List, Optional, Tuple

_CYR_MULTI = {
    "ё": "yo", "ю": "yu", "я": "ya",
    "ў": "o'", "қ": "q", "ғ": "g'", "ҳ": "h",
    "ц": "ts", "ч": "ch", "ш": "sh", "щ": "sh",
    "ъ": "'", "ь": "",
}
_CYR_SINGLE = {
    "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e",
    "ж": "j", "з": "z", "и": "i", "й": "y", "к": "k", "л": "l",
    "м": "m", "н": "n", "о": "o", "п": "p", "р": "r", "с": "s",
    "т": "t", "у": "u", "ф": "f", "х": "x", "ы": "i", "э": "e",
}

_CYRILLIC_RE = re.compile(r"[а-яёўқғҳ]", re.IGNORECASE)
_APOSTROPHE_RE = re.compile(r"[ʼ’‘`´]")
_SUFFIX_WORDS = {"o'g'li", "ogli", "qizi", "kizi"}


def _transliterate(text: str) -> str:
    out = []
    prev_is_letter = False
    for ch in text:
        low = ch.lower()
        if low == "е" and not prev_is_letter:
            out.append("ye")
        elif low in _CYR_MULTI:
            out.append(_CYR_MULTI[low])
        elif low in _CYR_SINGLE:
            out.append(_CYR_SINGLE[low])
        else:
            out.append(low)
        prev_is_letter = low.isalpha()
    return "".join(out)


def normalize(text: Optional[str]) -> str:
    """Kichik harf, krill bo'lsa lotinlashtiradi, apostrof variantlarini bittaga
    keltiradi, o'g'li/qizi so'zlarini olib tashlaydi, bo'shliqlarni yig'adi."""
    if not text:
        return ""
    text = _APOSTROPHE_RE.sub("'", text.strip().lower())
    if _CYRILLIC_RE.search(text):
        text = _transliterate(text)
    words = [w for w in text.split() if w and w not in _SUFFIX_WORDS]
    return " ".join(words)


def to_surname_initial(full_name: Optional[str]) -> str:
    """'Abdikarimov Farxod Hakimjon o'g'li' -> 'abdikarimov f.'"""
    words = normalize(full_name).split()
    if not words:
        return ""
    if len(words) == 1:
        return words[0]
    return f"{words[0]} {words[1][0]}."


def surname_of(full_name: Optional[str]) -> str:
    words = normalize(full_name).split()
    return words[0] if words else ""


def match_employee(xlsx_name: str, employees: List) -> Tuple[Optional[object], str]:
    """`employees` — `.id`/`.full_name` bo'lgan obyektlar ro'yxati (models.Employee).
    Qaytaradi: (employee_yoki_None, "exact"|"surname_only"|"none")."""
    target = to_surname_initial(xlsx_name)
    if not target:
        return None, "none"

    exact_matches = [e for e in employees if to_surname_initial(e.full_name) == target]
    if len(exact_matches) == 1:
        return exact_matches[0], "exact"

    target_surname = surname_of(xlsx_name)
    if target_surname:
        surname_matches = [e for e in employees if surname_of(e.full_name) == target_surname]
        if len(surname_matches) == 1:
            return surname_matches[0], "surname_only"

    return None, "none"
