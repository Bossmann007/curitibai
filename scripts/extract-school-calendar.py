#!/usr/bin/env python3
"""Dev-only: read the SME 2026 school calendar PDFs and print their dates as JSON (not shipped in the package).

The calendars carry their meaning in cell fill colours and drawn shapes, not in text. This script reads them from the
PDF itself: each body fill colour is matched to a legend swatch of the same PDF, and each body shape to a legend shape
of the same geometry (triangle, diamond, circle, hexagon). A colour or shape with no legend entry stops the script.

Checks (exit 1 on any failure):
- each month block reads days 1..N in the 2026 weekday column of that date;
- every body fill and shape is in the legend;
- every red (Feriados) cell is in the month's printed holiday list;
- school days per month equal the month's "Letivos: N", and their sum equals "Total dias letivos = N".

School-day rule (inferred from the per-month counts; the PDF does not state it): a day with the triangle (início /
encerramento com crianças e estudantes) is a school day; otherwise a Monday-to-Friday day is a school day unless its
fill is férias, recesso, recessos (feriados), feriados, início/encerramento com professores or Dia do Professor; a
Saturday is a school day only with the Sábado de Integração or Avaliação dos Parâmetros fill. src/tools/cityCalendar.ts
applies the same rule and test/cityCalendar.test.ts checks it against the counts committed from here.

Usage (no network; the PDFs are downloaded by hand, see docs/sources.md):
  python3 -I scripts/extract-school-calendar.py escolas=<pdf> cmeis=<pdf> cmaees=<pdf>    (JSON)
  python3 -I scripts/extract-school-calendar.py --ts <read date> escolas=<pdf> cmeis=<pdf> cmaees=<pdf> \\
    > src/tools/schoolCalendarData.ts
Needs pdfplumber (tested with 0.11.10): python3 -m pip install pdfplumber==0.11.10
"""

import datetime
import hashlib
import json
import re
import sys

import pdfplumber

YEAR = 2026
MONTHS = ["JANEIRO", "FEVEREIRO", "MARÇO", "ABRIL", "MAIO", "JUNHO",
          "JULHO", "AGOSTO", "SETEMBRO", "OUTUBRO", "NOVEMBRO", "DEZEMBRO"]
MONTHS_PT = {m.lower(): i + 1 for i, m in enumerate(MONTHS)}

SOURCES = {
    "escolas": "https://mid-educacao.curitiba.pr.gov.br/2025/12/pdf/00522557.pdf",
    "cmeis": "https://mid-educacao.curitiba.pr.gov.br/2025/12/pdf/00522558.pdf",
    "cmaees": "https://mid-educacao.curitiba.pr.gov.br/2025/12/pdf/00522559.pdf",
}

# Legend label (start of the text printed next to the swatch or shape) -> kind id. An unknown label stops the script.
FILL_KINDS = [
    ("Férias", "vacation"),
    ("Recessos (feriados)", "recess_holiday"),
    ("Recesso", "recess"),
    ("Sábado de Integração com as Famílias", "family_saturday"),
    ("Feriados", "holiday"),
    ("Início/Encerramento com professores", "teachers_start_end"),
    ("Avaliação dos Parâmetros e Ind. de Qualidade da Educação", "quality_evaluation"),
    ("Dia do Professor", "teachers_day"),
    ("Conselho de Classe Anos Iniciais e Anos Finais", "class_council"),
    ("Org. do trab. Ped. - Ed. Integral", "integral_work_organization"),
]
SHAPE_KINDS = [
    ("Início / Encerramento com crianças e estudantes", "students_start_end"),
    ("Semana de Estudos Pedagógicos", "pedagogical_studies"),
    ("Organização Administrativo-pedagógica", "administrative_organization"),
    ("Organização da Documentação Pedagógica", "documentation_organization"),
]
NO_CLASS_FILLS = {"vacation", "recess", "recess_holiday", "holiday", "teachers_start_end", "teachers_day"}
SATURDAY_CLASS_FILLS = {"family_saturday", "quality_evaluation"}


class CheckError(Exception):
    pass


def fail(msg):
    raise CheckError(msg)


def colour_key(c):
    if not isinstance(c, (list, tuple)):
        return None
    return tuple(round(float(x), 3) for x in c)


def kind_for(label, table):
    for prefix, kind in table:
        if label.startswith(prefix):
            return kind
    fail(f"legend label with no kind: {label!r}")


def geometry(curve):
    """triangle / diamond / hexagon by distinct vertices of a straight-line path; circle when it has Bezier segments."""
    ops = [seg[0] for seg in curve["path"]]
    if "c" in ops:
        return "circle"
    verts = {(round(x, 1), round(y, 1)) for x, y in curve["pts"]}
    return {3: "triangle", 4: "diamond", 6: "hexagon"}.get(len(verts)) or fail(f"unknown shape with {len(verts)} vertices")


def centre(o):
    return ((o["x0"] + o["x1"]) / 2, (o["top"] + o["bottom"]) / 2)


def line_text(words, top, bottom, x_min, x_max=10_000):
    picked = [w for w in words if top <= centre(w)[1] <= bottom and x_min <= w["x0"] <= x_max]
    return " ".join(w["text"] for w in sorted(picked, key=lambda w: (round(w["top"]), w["x0"])))


def read_legend(page, words, legend_top):
    fills = {}
    for r in page.rects:
        c = colour_key(r.get("non_stroking_color"))
        if r["top"] < legend_top or c in (None, (1.0, 1.0, 1.0), (0.0, 0.0, 0.0)) or r["x1"] - r["x0"] > 30:
            continue
        label = line_text(words, r["top"], r["bottom"], r["x1"], 270)
        if c in fills:
            fail(f"two legend swatches share the colour {c}")
        fills[c] = (kind_for(label, FILL_KINDS), label)
    shapes = {}
    for cv in page.curves:
        if cv["top"] < legend_top:
            continue
        label = line_text(words, cv["top"] - 1, cv["bottom"] + 1, cv["x1"], cv["x1"] + 300)
        g = geometry(cv)
        if g in shapes:
            fail(f"two legend shapes share the geometry {g}")
        shapes[g] = (kind_for(label, SHAPE_KINDS), label)
    return fills, shapes


def read_page(path):
    with pdfplumber.open(path) as pdf:
        if len(pdf.pages) != 1:
            fail(f"{path}: {len(pdf.pages)} pages, expected 1")
        page = pdf.pages[0]
        words = page.extract_words()
        text = page.extract_text()
        legend_top = (next((w for w in words if w["text"] == "Legenda:"), None) or fail(f"{path}: no legend"))["top"]
        fills, shapes = read_legend(page, words, legend_top)

        # Month blocks: name, weekday header row, day numbers, "Letivos: N", holiday lines.
        names = [w for w in words if w["text"] in MONTHS and w["top"] < legend_top]
        if [w["text"] for w in sorted(names, key=lambda w: (round(w["top"] / 50), w["x0"]))] != MONTHS:
            fail(f"{path}: month names not in a 3x4 grid in order")
        blocks = []
        for name in names:
            month = MONTHS.index(name["text"]) + 1
            cx = centre(name)[0]
            heads = sorted((w for w in words if w["text"] in "DSTQ" and len(w["text"]) == 1
                            and 0 < w["top"] - name["bottom"] < 15 and abs(centre(w)[0] - cx) < 75), key=lambda w: w["x0"])
            if [w["text"] for w in heads] != list("DSTQQSS"):
                fail(f"{path}: {name['text']} weekday header {[w['text'] for w in heads]}")
            xs = [centre(w)[0] for w in heads]
            half = (xs[-1] - xs[0]) / 12
            left, right = xs[0] - half, xs[-1] + half
            letivos = min((w for w in words if w["text"] == "Letivos:" and w["top"] > name["bottom"]
                           and left <= w["x0"] <= right + 20), key=lambda w: w["top"], default=None)
            if letivos is None:
                fail(f"{path}: {name['text']} has no Letivos line")
            n_word = [w for w in words if abs(w["top"] - letivos["top"]) < 2 and w["x0"] > letivos["x1"]
                      and w["x0"] < right + 25 and w["text"].isdigit()]
            if len(n_word) != 1:
                fail(f"{path}: {name['text']} Letivos number not found")
            days = [w for w in words if w["text"].isdigit() and heads[0]["bottom"] < w["top"] < letivos["top"]
                    and left <= centre(w)[0] <= right]
            blocks.append({"month": month, "name": name, "xs": xs, "left": left, "right": right, "days": days,
                           "letivos": int(n_word[0]["text"]), "letivos_word": letivos})

        total_m = re.search(r"Total dias letivos\s*=\s*(\d+)", text) or fail(f"{path}: no total")
        signed_m = re.search(r"Curitiba, (\d+) de (\w+) de (\d{4})", text) or fail(f"{path}: no signature date")
        signed = datetime.date(int(signed_m[3]), MONTHS_PT[signed_m[2].lower()], int(signed_m[1])).isoformat()
        total_top = (next((w for w in words if w["text"] == "Total"), None) or fail(f"{path}: no Total line"))["top"]

        # Day cells: the day number's centre and its 2026 date (asserted against its weekday column).
        cells = []
        for b in blocks:
            m = b["month"]
            last = (datetime.date(YEAR + (m == 12), m % 12 + 1, 1) - datetime.timedelta(days=1)).day
            ordered = sorted(b["days"], key=lambda w: (round(w["top"]), w["x0"]))
            if [int(w["text"]) for w in ordered] != list(range(1, last + 1)):
                fail(f"{path}: month {m} reads {[w['text'] for w in ordered]}")
            for w in ordered:
                d = datetime.date(YEAR, m, int(w["text"]))
                x, y = centre(w)
                col = min(range(7), key=lambda i: abs(b["xs"][i] - x))
                if col != (d.weekday() + 1) % 7:
                    fail(f"{path}: {d} in column {col}")
                cells.append({"date": d, "x": x, "y": y, "block": b, "fill": None, "shapes": []})

        # Fills: a body rect covers each day whose number centre lies inside it.
        tints = set()
        for r in page.rects:
            if r["top"] >= legend_top:
                continue
            c = colour_key(r.get("non_stroking_color"))
            if c not in fills:
                # Escolas paints its class council cells in a 50% tint of the legend swatch. Accept a body colour only
                # when it is that tint of exactly one swatch, and report it.
                tinted = [s for s in fills if len(s) == len(c or ()) and all(abs((1 + x) / 2 - y) <= 0.005 for x, y in zip(s, c))]
                if len(tinted) != 1:
                    fail(f"{path}: body fill {c} at ({r['x0']:.1f},{r['top']:.1f}) is not in the legend")
                tints.add((c, tinted[0], fills[tinted[0]][0]))
                print(f"extract-school-calendar: NOTE: {path}: body fill {c} read as a 50% tint of the "
                      f"{fills[tinted[0]][0]} swatch {tinted[0]}", file=sys.stderr)
                fills[c] = fills[tinted[0]]
            covered = [cl for cl in cells if r["x0"] <= cl["x"] <= r["x1"] and r["top"] <= cl["y"] <= r["bottom"]]
            if not covered:
                fail(f"{path}: body fill {c} at ({r['x0']:.1f},{r['top']:.1f}) covers no day")
            for cl in covered:
                if cl["fill"] is not None:
                    fail(f"{path}: {cl['date']} has two fills")
                cl["fill"] = fills[c][0]

        # Shapes: the day whose number centre is nearest the shape's bounding-box centre (within 12 pt).
        for cv in page.curves:
            if cv["top"] >= legend_top:
                continue
            g = geometry(cv)
            if g not in shapes:
                fail(f"{path}: body shape {g} is not in the legend")
            sx, sy = centre(cv)
            near = min(cells, key=lambda cl: (cl["x"] - sx) ** 2 + (cl["y"] - sy) ** 2)
            if ((near["x"] - sx) ** 2 + (near["y"] - sy) ** 2) ** 0.5 > 12:
                fail(f"{path}: shape {g} at ({sx:.1f},{sy:.1f}) is not on a day")
            near["shapes"].append(shapes[g][0])

        # Printed holiday list under each month ("DD - name", a line without a number continues the name above).
        holidays = []
        for b in blocks:
            col_names = [o for o in names if abs(centre(o)[0] - centre(b["name"])[0]) < 40 and o["top"] > b["name"]["top"]]
            bottom = min([o["top"] for o in col_names] + [total_top])
            lw = [w for w in words if b["letivos_word"]["bottom"] + 1 < w["top"] < bottom and b["left"] - 5 <= w["x0"] < b["right"] + 5]
            lines = {}
            for w in lw:
                lines.setdefault(round(w["top"]), []).append(w)
            entries = []
            for top in sorted(lines):
                t = " ".join(w["text"] for w in sorted(lines[top], key=lambda w: w["x0"]))
                hm = re.match(r"^(\d{2}) - (.+)$", t)
                if hm:
                    entries.append([datetime.date(YEAR, b["month"], int(hm[1])), hm[2]])
                elif entries:
                    entries[-1][1] += " " + t
                else:
                    fail(f"{path}: month {b['month']} holiday line {t!r}")
            holidays += entries
        listed = {d for d, _ in holidays}
        for cl in cells:
            if cl["fill"] == "holiday" and cl["date"] not in listed:
                fail(f"{path}: {cl['date']} is red but not in the printed holiday list")

        # School days and the cross-check.
        per_month = [0] * 12
        for cl in cells:
            wd = cl["date"].weekday()  # Monday 0
            school = ("students_start_end" in cl["shapes"] or cl["fill"] in SATURDAY_CLASS_FILLS
                      or (wd < 5 and cl["fill"] not in NO_CLASS_FILLS))
            cl["school"] = school
            per_month[cl["date"].month - 1] += school
        printed = [b["letivos"] for b in sorted(blocks, key=lambda b: b["month"])]
        if per_month != printed:
            fail(f"{path}: school days per month {per_month} != printed Letivos {printed}")
        if sum(per_month) != int(total_m[1]):
            fail(f"{path}: {sum(per_month)} school days != printed total {total_m[1]}")
        legend = {v for k, v in fills.items() if k not in {t[0] for t in tints}} | set(shapes.values())
        return cells, per_month, int(total_m[1]), signed, holidays, legend, sorted(tints)


def ranges(dates):
    out = []
    for d in sorted(dates):
        if out and (d - datetime.date.fromisoformat(out[-1][1])).days == 1:
            out[-1][1] = d.isoformat()
        else:
            out.append([d.isoformat(), d.isoformat()])
    return out


def extract(unit, path):
    with open(path, "rb") as f:
        sha = hashlib.sha256(f.read()).hexdigest()
    cells, per_month, total, signed, holidays, legend, tints = read_page(path)
    by_kind = {}
    for cl in cells:
        for kind in ([cl["fill"]] if cl["fill"] else []) + cl["shapes"]:
            by_kind.setdefault(kind, []).append(cl["date"])
    students = sorted(by_kind.get("students_start_end", []))
    names = {d.isoformat(): n for d, n in holidays}
    # A holiday stays one day with its printed name; other kinds merge consecutive days.
    periods = [["holiday", d.isoformat(), d.isoformat(), names[d.isoformat()]] for d in by_kind.pop("holiday", [])]
    periods += [[k, a, b] for k, ds in by_kind.items() for a, b in ranges(ds)]
    periods.sort(key=lambda p: (p[1], p[0]))
    return {
        "unit": unit,
        "source_url": SOURCES[unit],
        "sha256": sha,
        "signed": signed,
        "legend": dict(sorted(legend)),
        "tint_matches": [{"body": list(c), "swatch": list(s), "kind": k} for c, s, k in tints],
        "first_day_with_students": students[0].isoformat(),
        "last_day_with_students": students[-1].isoformat(),
        "periods": periods,
        "holidays_printed": [[d.isoformat(), n] for d, n in holidays],
        "school_days_per_month": per_month,
        "total_school_days": total,
        "school_days": ranges(cl["date"] for cl in cells if cl["school"]),
    }


def to_ts(units, read_at):
    """The TypeScript module src/tools/schoolCalendarData.ts (facts only: dates, counts, source and hash)."""
    q = lambda v: json.dumps(v, ensure_ascii=False)
    lines = [
        "// Generated by scripts/extract-school-calendar.py from the three SME PDFs (docs/sources.md); do not edit by hand.",
        "// Facts read from the PDFs: dates per legend kind, the printed holiday names, school days per month and total.",
        "",
        f"export const SCHOOL_CALENDAR_READ_AT = {q(read_at)};",
        "",
        "export const SCHOOL_CALENDARS = {",
    ]
    for u in units:
        lines += [
            f"  {u['unit']}: {{",
            f"    source_url: {q(u['source_url'])},",
            f"    sha256: {q(u['sha256'])},",
            f"    signed: {q(u['signed'])},",
            f"    first_day_with_students: {q(u['first_day_with_students'])},",
            f"    last_day_with_students: {q(u['last_day_with_students'])},",
            f"    school_days_per_month: {q(u['school_days_per_month']).replace(',', ', ').replace(',  ', ', ')},",
            f"    total_school_days: {u['total_school_days']},",
            "    periods: [",
        ]
        lines += [f"      [{', '.join(q(x) for x in p)}]," for p in u["periods"]]
        lines += ["    ],", "  },"]
    lines += ["} as const;", ""]
    return "\n".join(lines)


def main(argv):
    out = []
    ts_read_at = None
    if argv[:1] == ["--ts"] and len(argv) > 1:
        ts_read_at, argv = argv[1], argv[2:]
    for arg in argv:
        unit, _, path = arg.partition("=")
        if unit not in SOURCES or not path:
            print(f"usage: {sys.argv[0]} escolas=<pdf> cmeis=<pdf> cmaees=<pdf>", file=sys.stderr)
            return 2
        try:
            out.append(extract(unit, path))
        except CheckError as e:
            print(f"extract-school-calendar: FAIL: {e}", file=sys.stderr)
            return 1
    print(to_ts(out, ts_read_at) if ts_read_at else json.dumps(out, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
