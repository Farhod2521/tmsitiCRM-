"""Energoaudit hisoboti — "Хисобот Уй-жойлар шаблон.docx" asosida.

Shablondagi sariq (highlight) joylar formadan to'ldiriladi, hisob-kitoblar
(R₀, Q, ulushlar, "мос/мос эмас", tavsiyalardagi tejash) shu yerda bajariladi.
Elementlar shablondagi tartib raqami bo'yicha olinadi (shablon o'zgarmas —
app/templates/energoaudit_uyjoy.docx)."""
import base64
import copy
import io
import os
from typing import Any, Optional

import docx
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm

TEMPLATE_PATH = os.path.join(os.path.dirname(__file__), "templates", "energoaudit_uyjoy.docx")
KWH_TO_GCAL = 0.00086

# Foto joylari: shablondagi jadval (element tartibi), qator, 3 ta katak
PHOTO_SLOTS = {
    "tom_1": (34, 0, 0), "tom_2": (34, 0, 1), "tom_3": (34, 0, 2),
    "deraza_1": (37, 0, 0), "deraza_2": (37, 0, 1), "deraza_3": (37, 0, 2),
    "eshik_1": (37, 2, 0), "eshik_2": (37, 2, 1), "eshik_3": (37, 2, 2),
}

DEFAULT_DATA: dict[str, Any] = {
    "bino_nomi": "",
    "sarlavha": "",
    "ilova": "1-илова",
    "qurilgan_yil": 1973,
    "umumiy_maydon": 2906,
    "qavatlar_soni": 3,
    "fasad_izolyatsiya": "мавжуд эмас",
    "isitish_turi": "марказий иситиш тизими",
    "issiq_suv": "Автоном (алоҳида)",
    "resurslar": "электр энергияси ва иссиқлик энергиясини",
    "issiqlik_manbai": "марказий иссиқлик таъминоти",
    "uzunlik": 38.7,
    "kenglik": 24.4,
    "balandlik": 10.8,
    "hajm": 5291.3,
    "pastki_konstruksiya": "ертўла ораёпмаси",
    "deraza_soni": 88, "deraza_maydon": 213.4,
    "yolak_deraza_soni": 10, "yolak_deraza_maydon": 45,
    "eshik_soni": 6, "eshik_maydon": 22.94,
    "devor_maydon": None,            # bo'sh bo'lsa: 2·(L+W)·H − derazalar − eshiklar
    "tom_maydon": 648.63,
    "tom_turi": "чордоқли икки нишабли",
    "tom_tavsif": "Томёпмаси темир-бетон плиталардан бажарилган бўлиб, иссиқлик изоляцияси сифатида керамзит тўшалган.",
    "devor_qatlamlar": [
        {"nomi": "Ички сувоқ", "qalinlik": 15, "lambda": 0.93},
        {"nomi": "Пишиқ ғишт", "qalinlik": 380, "lambda": 0.52},
        {"nomi": "Ташқи сувоқ", "qalinlik": 15, "lambda": 0.93},
    ],
    "tom_qatlamlar": [
        {"nomi": "Темир-бетон плита", "qalinlik": 220, "lambda": 2.04},
        {"nomi": "Цемент-қум стяжкаси", "qalinlik": 150, "lambda": 0.93},
    ],
    "alfa_ichki": 8.7, "alfa_devor": 23, "alfa_tom": 12,
    "deraza_R": 0.62, "eshik_R": 0.56,
    "t_ichki": 20, "t_tashqi": -15,
    "bino_toifa": "Кўп қаватли уй-жойлар",
    "dd": 2877,
    "pol_R": None,
    "norma_toifa": "3 қаватдан юқори турар-жой бинолари ва даволаш-профилактика муассасалари",
    "norma_dd": "2000-3000",
    "norma_devor": 2.2, "norma_tom": 3.0, "norma_pol": 2.8, "norma_deraza": 0.53, "norma_fonar": 0.31,
    "tavsiya_devor_material": "базалт плита", "tavsiya_devor_qalinlik": 6, "tavsiya_devor_lambda": 0.045,
    "tavsiya_tom_material": "енгил базалт плита", "tavsiya_tom_qalinlik": 100, "tavsiya_tom_lambda": 0.036,
    "isitish_soati": 2112,
}


# ── Hisob-kitob ──────────────────────────────────────────────────────────────

def _num(v, default=0.0) -> float:
    try:
        if v is None or v == "":
            return float(default)
        return float(str(v).replace(",", ".").replace(" ", ""))
    except (TypeError, ValueError):
        return float(default)


def fmt(v: Optional[float], nd: int = 2) -> str:
    """O'zbekcha son: vergul bilan, keraksiz nollarsiz (0,921; 41056,5; 2906)."""
    if v is None:
        return "—"
    s = f"{v:.{nd}f}"
    if "." in s:
        s = s.rstrip("0").rstrip(".")
    return s.replace(".", ",")


def fmt_group(v: float) -> str:
    return f"{round(v):,}".replace(",", " ")


def merged(data: dict) -> dict:
    d = dict(DEFAULT_DATA)
    d.update({k: v for k, v in (data or {}).items() if v is not None or k in ("devor_maydon", "pol_R")})
    return d


def _layers(raw) -> list[dict]:
    out = []
    for l in raw or []:
        t, lam = _num(l.get("qalinlik")), _num(l.get("lambda"))
        r = round(t / 1000 / lam, 3) if t > 0 and lam > 0 else 0.0
        out.append({"nomi": (l.get("nomi") or "").strip() or "Қатлам", "qalinlik": t, "lambda": lam, "R": r})
    return out


def _recommend(r0, r_req, area, dt, add_thickness_m, lam, hours, q_old_kw):
    need = max(0.0, r_req - r0)
    r_add = add_thickness_m / lam if lam > 0 else 0.0
    r_new = r0 + r_add
    q_new = area * dt / r_new / 1000 if r_new > 0 else 0.0
    dq = max(0.0, q_old_kw - q_new)
    kwh = dq * hours
    return {"kerak_R": round(need, 3), "qoshimcha_R": round(r_add, 2), "yangi_R": round(r_new, 2),
            "yangi_Q_kw": round(q_new, 1), "kamayish_kw": round(dq, 1),
            "kamayish_foiz": round(dq / q_old_kw * 100) if q_old_kw else 0,
            "tejash_kwh": round(kwh, 1), "tejash_gkal": round(kwh * KWH_TO_GCAL)}


def calculate(data: dict) -> dict:
    d = merged(data)
    ai, ad, at = _num(d["alfa_ichki"], 8.7), _num(d["alfa_devor"], 23), _num(d["alfa_tom"], 12)
    dt = _num(d["t_ichki"], 20) - _num(d["t_tashqi"], -15)

    wall_layers, roof_layers = _layers(d["devor_qatlamlar"]), _layers(d["tom_qatlamlar"])
    wall_rk = round(sum(l["R"] for l in wall_layers), 3)
    roof_rk = round(sum(l["R"] for l in roof_layers), 3)
    wall_r0 = round(1 / ai + wall_rk + 1 / ad, 3) if ai and ad else wall_rk
    roof_r0 = round(1 / ai + roof_rk + 1 / at, 3) if ai and at else roof_rk

    win_n = int(_num(d["deraza_soni"])) + int(_num(d["yolak_deraza_soni"]))
    win_a = round(_num(d["deraza_maydon"]) + _num(d["yolak_deraza_maydon"]), 2)
    door_n, door_a = int(_num(d["eshik_soni"])), round(_num(d["eshik_maydon"]), 2)
    L, W, H = _num(d["uzunlik"]), _num(d["kenglik"]), _num(d["balandlik"])
    wall_auto = round(max(0.0, 2 * (L + W) * H - win_a - door_a), 2)
    wall_a = round(_num(d["devor_maydon"]), 2) if d.get("devor_maydon") not in (None, "") else wall_auto
    roof_a = round(_num(d["tom_maydon"]), 2)
    rw, rd = _num(d["deraza_R"], 0.62), _num(d["eshik_R"], 0.56)

    def q(a, r):
        return round(a * dt / r, 1) if r > 0 else 0.0

    losses = [
        {"key": "tom", "nomi": "Том", "A": roof_a, "R": roof_r0, "Q": q(roof_a, roof_r0)},
        {"key": "devor", "nomi": "Деворлар", "A": wall_a, "R": wall_r0, "Q": q(wall_a, wall_r0)},
        {"key": "deraza", "nomi": "Ойналар", "A": win_a, "R": rw, "Q": q(win_a, rw)},
        {"key": "eshik", "nomi": "Эшиклар", "A": door_a, "R": rd, "Q": q(door_a, rd)},
    ]
    total_w = sum(x["Q"] for x in losses)
    for x in losses:
        x["kw"] = round(x["Q"] / 1000, 2)
        x["ulush"] = round(x["Q"] / total_w * 100, 1) if total_w else 0.0

    n_wall, n_roof = _num(d["norma_devor"], 2.2), _num(d["norma_tom"], 3.0)
    pol_r = None if d.get("pol_R") in (None, "") else _num(d["pol_R"])
    compare = {
        "devor": wall_r0 >= n_wall,
        "tom": roof_r0 >= n_roof,
        "pol": None if pol_r is None else pol_r >= _num(d["norma_pol"], 2.8),
        "deraza": rw >= _num(d["norma_deraza"], 0.53),
    }
    hours = _num(d["isitish_soati"], 2112)
    by = {x["key"]: x for x in losses}
    rec_wall = _recommend(wall_r0, n_wall, wall_a, dt, _num(d["tavsiya_devor_qalinlik"]) / 100,
                          _num(d["tavsiya_devor_lambda"], 0.045), hours, by["devor"]["Q"] / 1000)
    rec_roof = _recommend(roof_r0, n_roof, roof_a, dt, _num(d["tavsiya_tom_qalinlik"]) / 1000,
                          _num(d["tavsiya_tom_lambda"], 0.036), hours, by["tom"]["Q"] / 1000)
    return {
        "dt": dt,
        "devor": {"qatlamlar": wall_layers, "Rk": wall_rk, "R0": wall_r0},
        "tom": {"qatlamlar": roof_layers, "Rk": roof_rk, "R0": roof_r0},
        "deraza_soni": win_n, "deraza_maydon": win_a, "eshik_soni": door_n, "eshik_maydon": door_a,
        "devor_maydon": wall_a, "devor_maydon_auto": wall_auto, "tom_maydon": roof_a,
        "yoqotishlar": losses, "jami_kw": round(total_w / 1000, 1),
        "taqqoslash": compare,
        "tavsiya_devor": rec_wall, "tavsiya_tom": rec_roof,
    }


# ── DOCX yordamchilari ───────────────────────────────────────────────────────

Seg = tuple[str, Optional[str]]   # (matn, None | "subscript" | "superscript")


def _base_rpr(p):
    for r in p.iter(qn("w:r")):
        if any((t.text or "").strip() for t in r.iter(qn("w:t"))):
            rpr = r.find(qn("w:rPr"))
            if rpr is None:
                return None
            rpr = copy.deepcopy(rpr)
            for tag in ("w:highlight", "w:vertAlign", "w:shd"):
                for e in rpr.findall(qn(tag)):
                    rpr.remove(e)
            return rpr
    return None


def set_text(p, content) -> None:
    """Paragraf matnini to'liq almashtiradi (birinchi matnli run formati, sariq fonsiz).
    content — str yoki [(matn, vertAlign), ...]."""
    segs: list[Seg] = [(content, None)] if isinstance(content, str) else list(content)
    rpr = _base_rpr(p)
    for child in list(p):
        if child.tag in (qn("w:r"), qn("w:hyperlink"), qn("w:smartTag"), qn("w:proofErr"),
                         qn("w:bookmarkStart"), qn("w:bookmarkEnd")):
            p.remove(child)
    for text, valign in segs:
        if not text:
            continue
        r = OxmlElement("w:r")
        if rpr is not None or valign:
            rp = copy.deepcopy(rpr) if rpr is not None else OxmlElement("w:rPr")
            if valign:
                va = OxmlElement("w:vertAlign"); va.set(qn("w:val"), valign); rp.append(va)
            r.append(rp)
        t = OxmlElement("w:t"); t.set(qn("xml:space"), "preserve"); t.text = text
        r.append(t)
        p.append(r)


def _cell(tbl, row, col):
    tr = tbl.findall(qn("w:tr"))[row]
    return tr.findall(qn("w:tc"))[col]


def set_cell(tbl, row, col, content) -> None:
    tc = _cell(tbl, row, col)
    ps = tc.findall(qn("w:p"))
    set_text(ps[0], content)
    for extra in ps[1:]:
        tc.remove(extra)


def replace_lines(protos: list, lines: list) -> None:
    """Bir xil turdagi qatorlar guruhini (masalan, devor qatlamlari) yangi ro'yxat bilan almashtiradi."""
    last = protos[-1]
    for i, content in enumerate(lines):
        if i < len(protos):
            set_text(protos[i], content)
            last = protos[i]
        else:
            new = copy.deepcopy(protos[-1])
            last.addnext(new)
            set_text(new, content)
            last = new
    for extra in protos[len(lines):]:
        extra.getparent().remove(extra)


def remove(*elements) -> None:
    for e in elements:
        if e.getparent() is not None:
            e.getparent().remove(e)


def _decode_image(data_url: str) -> Optional[io.BytesIO]:
    try:
        raw = base64.b64decode(data_url.split(",", 1)[1] if data_url.startswith("data:") else data_url)
        return io.BytesIO(raw)
    except Exception:
        return None


def _put_photos(document, els, photos: dict) -> None:
    from docx.table import Table
    groups = {34: ["tom_1", "tom_2", "tom_3"], 37: ["deraza_1", "deraza_2", "deraza_3", "eshik_1", "eshik_2", "eshik_3"]}
    for idx, slots in groups.items():
        if not any(photos.get(s) for s in slots):
            remove(els[idx])          # suratsiz jadval hujjatda bo'sh ramka bo'lib qolmasin
            continue
        table = Table(els[idx], document._body)
        for s in slots:
            _, row, col = PHOTO_SLOTS[s]
            stream = _decode_image(photos.get(s) or "")
            if stream is None:
                continue
            para = table.rows[row].cells[col].paragraphs[0]
            try:
                para.add_run().add_picture(stream, width=Cm(5.2))
            except Exception:
                pass


# ── DOCX yaratish ────────────────────────────────────────────────────────────

def build_docx(data: dict, photos: Optional[dict] = None) -> bytes:
    d = merged(data)
    c = calculate(d)
    document = docx.Document(TEMPLATE_PATH)
    els = list(document.element.body.iterchildren())
    P = lambda i: els[i]
    dt = fmt(c["dt"], 1)

    # Sarlavha (kolontitul)
    head = (d.get("sarlavha") or d.get("bino_nomi") or "").strip()
    for s in document.sections:
        for hdr in (s.header, s.first_page_header):
            for p in hdr.paragraphs:
                if p.text.strip():
                    set_text(p._p, head)

    # 2.1 Umumiy ma'lumot
    set_text(P(11), f"Энергоаудит {d['bino_nomi'].strip()} Қурилиш ва уй-жой коммунал хўжалиги вазирлиги ҳузуридаги "
                    f"Техник меъёрлаш ва стандартлаштириш илмий-тадқиқот институти томонидан ўтказилди. ({d['ilova']}).")
    set_text(P(13), f"Қурилган йил – {fmt(_num(d['qurilgan_yil']), 0)} йил")
    set_text(P(14), f"Умумий майдони – {fmt(_num(d['umumiy_maydon']))} м²")
    set_text(P(15), f"Қаватлар сони – {fmt(_num(d['qavatlar_soni']), 0)}")
    set_text(P(16), f"Фасад қисмида иссиқлик ҳимоя қопламаси – {d['fasad_izolyatsiya']}")
    set_text(P(17), f"Иситиш тизими тури – {d['isitish_turi']}")
    set_text(P(19), f"Иссиқ сув таъминоти тури - {d['issiq_suv']}")
    set_text(P(21), f"Биноларда фаолияти давомида ёқилғи-энергетика ресурсларидан {d['resurslar']} истеъмол қилиниши "
                    f"аниқланди. Бунда иссиқлик энергияси {d['issiqlik_manbai']} орқали таъминланади.")

    # 2.3 Hajm-reja yechimlari
    set_text(P(25), f"Бино {fmt(_num(d['qavatlar_soni']), 0)} қаватдан иборат бўлиб, режада {fmt(_num(d['uzunlik']))} × "
                    f"{fmt(_num(d['kenglik']))} м ўлчамга эга. Бинонинг умумий майдони {fmt(_num(d['umumiy_maydon']))} м², "
                    f"умумий ҳажми {fmt(_num(d['hajm']))} м³.")
    set_text(P(26), f"Ташқи тўсувчи конструкциялар ташқи деворлар, дераза ва эшиклар, {d['pastki_konstruksiya']} ҳамда "
                    f"том конструкцияларидан ташкил топган.")
    wl = c["devor"]["qatlamlar"]
    main = max(wl, key=lambda l: l["qalinlik"]) if wl else None
    others = [l for l in wl if l is not main]
    wall_desc = (f"{fmt(main['qalinlik'], 0)} мм қалинликдаги {main['nomi'].lower()}" if main else "—")
    if others:
        wall_desc += ", " + ", ".join(f"{fmt(l['qalinlik'], 0)} мм {l['nomi'].lower()}" for l in others)
    set_text(P(27), f"Бинонинг ташқи деворлари {wall_desc}дан иборат.")
    set_text(P(28), f"Бино ҳар бир томондаги фасадида умумий майдони {fmt(c['deraza_maydon'])} м² ни ташкил қиладиган "
                    f"{c['deraza_soni']} та деразалар ва умумий майдони {fmt(c['eshik_maydon'])} м² ни ташкил қиладиган "
                    f"{c['eshik_soni']} та эшиклар мавжуд.")
    t31 = P(31)
    set_cell(t31, 1, 1, fmt(_num(d["deraza_soni"]), 0)); set_cell(t31, 2, 1, fmt(_num(d["deraza_maydon"])))
    set_cell(t31, 1, 2, fmt(_num(d["eshik_soni"]), 0)); set_cell(t31, 2, 2, fmt(_num(d["eshik_maydon"])))
    set_cell(t31, 1, 3, fmt(_num(d["yolak_deraza_soni"]), 0)); set_cell(t31, 2, 3, fmt(_num(d["yolak_deraza_maydon"])))
    set_text(P(33), f"Бинонинг том қисми {d['tom_turi']} сифатида ташкил қилинган. {d['tom_tavsif']}".strip())

    # 2.4.1 R₀ — devor
    def layer_lines(layers):
        return [f"{l['nomi']} – {fmt(l['qalinlik'], 0)} мм" for l in layers] or ["—"]

    def r_lines(layers):
        return [[("R", None), (str(i + 1), "subscript"),
                 (f" ({l['nomi'].lower()}) = {fmt(l['qalinlik'] / 1000, 3)}/{fmt(l['lambda'], 3)} = {fmt(l['R'], 3)}", None)]
                for i, l in enumerate(layers)] or [["—"]]

    def rk_line(part):
        terms = " + ".join(fmt(l["R"], 3) for l in part["qatlamlar"]) or "0"
        return [("R", None), ("k", "subscript"), (f" = {terms} = {fmt(part['Rk'], 3)}", None)]

    def r0_line(part, ae):
        return [("R", None), ("o", "subscript"),
                (f" = (1/{fmt(_num(d['alfa_ichki']), 1)}) + {fmt(part['Rk'], 3)} + (1/{fmt(_num(ae), 1)}) = {fmt(part['R0'], 3)}", None)]

    replace_lines([P(53), P(54), P(55)], layer_lines(wl))
    replace_lines([P(58), P(59), P(60)], r_lines(wl))
    set_text(P(62), rk_line(c["devor"]))
    set_text(P(64), r0_line(c["devor"], d["alfa_devor"]))
    rl = c["tom"]["qatlamlar"]
    replace_lines([P(67), P(68), P(69)], layer_lines(rl))
    replace_lines([P(71), P(72), P(73)], r_lines(rl))
    set_text(P(75), rk_line(c["tom"]))
    set_text(P(77), r0_line(c["tom"], d["alfa_tom"]))
    set_text(P(79), f"Дераза ва эшикнинг иссиқлик узатишга қаршилиги мос равишда {fmt(_num(d['deraza_R']), 3)} ва "
                    f"{fmt(_num(d['eshik_R']), 3)} деб қабул қилинади.")

    # 16-jadval — solishtirma
    t83 = P(83)
    for col, val in enumerate([d["norma_toifa"], d["norma_dd"], fmt(_num(d["norma_devor"])), fmt(_num(d["norma_tom"])),
                               fmt(_num(d["norma_pol"])), fmt(_num(d["norma_deraza"])), fmt(_num(d["norma_fonar"]))]):
        set_cell(t83, 2, col, str(val))
    pol = d.get("pol_R")
    for col, val in enumerate([d["bino_toifa"], fmt(_num(d["dd"]), 0), fmt(c["devor"]["R0"], 3), fmt(c["tom"]["R0"], 3),
                               "Мавжуд эмас" if pol in (None, "") else fmt(_num(pol), 3),
                               fmt(_num(d["deraza_R"]), 3), "Мавжуд эмас"]):
        set_cell(t83, 3, col, val)
    mos = lambda ok: "" if ok is None else ("мос" if ok else "мос эмас")
    cmp_ = c["taqqoslash"]
    set_cell(t83, 4, 0, "Таққослаш")
    for col, ok in ((2, cmp_["devor"]), (3, cmp_["tom"]), (4, cmp_["pol"]), (5, cmp_["deraza"])):
        set_cell(t83, 4, col, mos(ok))

    # 2.4.2 Issiqlik yo'qotishlari
    by = {x["key"]: x for x in c["yoqotishlar"]}
    q_line = lambda x: f"Q = {fmt(x['A'])} × {dt} / {fmt(x['R'], 3)} = {fmt(x['Q'], 1)} Вт"
    set_text(P(96), "Деворлардан иссиқлик йўқотилиши"); set_text(P(97), q_line(by["devor"]))
    set_text(P(98), "Том орқали иссиқлик йўқотилиши"); set_text(P(100), q_line(by["tom"]))
    set_text(P(101), "Ойналар орқали иссиқлик йўқотилиши"); set_text(P(102), q_line(by["deraza"]))
    set_text(P(103), "Эшиклар орқали иссиқлик йўқотилиши"); set_text(P(104), q_line(by["eshik"]))
    set_text(P(105), f"Тўсувчи конструкциялардан умумий йўқотишлар {fmt(c['jami_kw'], 1)} кВт")
    set_text(P(106), "Шундан:")
    for i, key in zip((107, 108, 109, 110), ("tom", "devor", "deraza", "eshik")):
        x = by[key]
        set_text(P(i), f"{x['nomi']} – {fmt(x['kw'], 2)} кВт ({fmt(x['ulush'], 1)} %)")

    # V. Tavsiyalar
    set_text(P(113), "Ҳисоботда келтирилган ҳисоб-китоблардан кўриниб турибдики, ташқи деворлар ва томёпманинг иссиқлик "
                     "узатишига қаршилиги белгиланган меъёрга нисбатан "
                     f"{'мос' if cmp_['devor'] and cmp_['tom'] else 'паст'}, шунингдек, бинода энергия асосан томёпма "
                     f"({fmt(by['tom']['ulush'], 1)} %) ва ташқи деворлар ({fmt(by['devor']['ulush'], 1)} %) орқали "
                     "йўқотилади. Шу билан бирга иситиш юкламасининг асосий қисми ушбу иссиқлик йўқотишлари ҳисобига юзага келмоқда.")
    rw, rr = c["tavsiya_devor"], c["tavsiya_tom"]
    if cmp_["devor"]:
        remove(P(120), P(121), P(122), P(123), P(124))
    else:
        set_text(P(120), f"Девор конструкциясининг иссиқлик узатишига қаршилигини меъёр даражасида таъминлаш учун қўшимча "
                         f"иссиқлик изоляция қатлами камида R = {fmt(rw['kerak_R'], 2)} m²·°C/W қаршилик бериши керак.")
        set_text(P(121), f"Ушбу кўрсаткичга деворларни ташқи тарафдан {fmt(_num(d['tavsiya_devor_qalinlik']), 1)} см "
                         f"қалинликдаги {d['tavsiya_devor_material']} билан изоляция қилиш орқали эришиш мумкин. Шунда ташқи "
                         f"девор конструкциясининг умумий иссиқлик узатишига қаршилиги {fmt(rw['yangi_R'], 2)} m²·°C/W ни "
                         "ташкил этади. Натижада деворлар орқали ҳисобий иссиқлик йўқотиши:")
        set_text(P(122), f"Q = {fmt(by['devor']['A'])} × {dt} / {fmt(rw['yangi_R'], 2)} ≈ {fmt(rw['yangi_Q_kw'], 1)} kW")
        set_text(P(123), f"яъни: деворлар орқали иссиқ йўқотилиши {fmt(rw['kamayish_kw'], 1)} kW ({rw['kamayish_foiz']}%) га камаяди.")
        set_text(P(124), f"Натижада {fmt_group(rw['tejash_kwh'])} kWh/йил ёки {rw['tejash_gkal']} Гкал/йил иссиқлик энергияси тежалади.")
    if cmp_["tom"]:
        remove(P(125), P(126), P(127), P(128), P(129))
    else:
        set_text(P(125), f"Том конструкциясининг иссиқлик узатишига қаршилигини меъёр даражасида таъминлаш учун қўшимча "
                         f"иссиқлик изоляция қатлами камида R = {fmt(rr['kerak_R'], 3)} m²·°C/W қаршилик бериши керак.")
        set_text(P(126), f"Бунда {fmt(_num(d['tavsiya_tom_qalinlik']), 0)} mm {d['tavsiya_tom_material']} билан изоляция "
                         f"қилиш қўшимча {fmt(rr['qoshimcha_R'], 2)} m²·°C/W беради. Шунда том конструкциясининг умумий "
                         f"иссиқлик узатишига қаршилиги {fmt(rr['yangi_R'], 2)} m²·°C/W ни ташкил этади. Натижада том орқали "
                         "ҳисобий иссиқлик йўқотиши:")
        set_text(P(127), f"Q = {fmt(by['tom']['A'])} × {dt} / {fmt(rr['yangi_R'], 2)} ≈ {fmt(rr['yangi_Q_kw'], 1)} kW")
        set_text(P(128), f"яъни: том орқали иссиқ йўқотилиши {fmt(rr['kamayish_kw'], 1)} kW ({rr['kamayish_foiz']}%) га камаяди.")
        set_text(P(129), f"Натижада {fmt_group(rr['tejash_kwh'])} kWh/йил ёки {rr['tejash_gkal']} Гкал/йил иссиқлик энергияси тежалади.")

    # Suratlar
    _put_photos(document, els, photos or {})

    # Qolgan sariq belgilarni tozalash (masalan, rasm raqamlari)
    for hl in list(document.element.body.iter(qn("w:highlight"))):
        hl.getparent().remove(hl)

    buf = io.BytesIO()
    document.save(buf)
    return buf.getvalue()
