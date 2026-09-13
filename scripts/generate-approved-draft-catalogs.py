from __future__ import annotations

import hashlib
import json
import re
import unicodedata
from collections import defaultdict
from dataclasses import dataclass
from difflib import SequenceMatcher
from pathlib import Path

import pdfplumber
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
PDF_DIR = ROOT / "tmp" / "pdfs"
MIGRATIONS = ROOT / "supabase" / "migrations"
REPORTS = ROOT / "docs" / "reports"
PSC2_SQL = MIGRATIONS / "20260909121000_psc_2027_stage_2_draft.sql"


@dataclass
class Item:
    code: str
    subject: str
    label: str
    locator: str
    page: int
    section: str
    order: int
    classification: str = "SAFE"
    note: str = "Literal normalizado da fonte oficial"
    reused_from: str | None = None


def clean(value: str) -> str:
    replacements = {
        "ﬁ": "fi", "ﬂ": "fl", "–": "–", "−": "−", "\u00a0": " ",
        "antig o": "antigo", "fortalec imento": "fortalecimento",
        "civil-m ilitar": "civil-militar", "repro dução": "reprodução",
        "home m": "homem", "pr incipais": "principais", "que m": "quem",
        "cli mas": "climas", "climá tica": "climática", "corred ores": "corredores",
        "aplica tivos": "aplicativos", "f undiária": "fundiária",
        "ref ugiados": "refugiados", "desigualdade s": "desigualdades",
        "juven tudes": "juventudes", "aq uecimento": "aquecimento",
        "pro pagação": "propagação", "ent re": "entre", "propagaç ão": "propagação",
        "representaçõ es": "representações", "ev entos": "eventos",
        "elações de Trabalho": "Relações de Trabalho", "n otação": "notação",
    }
    for old, new in replacements.items():
        value = value.replace(old, new)
    value = re.sub(r"\s+", " ", value).strip()
    value = re.sub(r"\s+([,.;:!?])", r"\1", value)
    value = re.sub(r"(?<=\w)\s*-\s*(?=\w)", "-", value)
    return value


def norm(value: str) -> str:
    value = unicodedata.normalize("NFKD", clean(value)).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def slug(value: str, limit: int = 92) -> str:
    result = re.sub(r"[^a-z0-9]+", "-", norm(value)).strip("-")
    return result[:limit].rstrip("-") or "conteudo"


def sql_text(value: str) -> str:
    return "'" + value.replace("'", "''") + "'"


def closest_label(normalized: str, candidates: list[str]) -> tuple[float, str]:
    words = set(normalized.split())
    narrowed = []
    for candidate in candidates:
        candidate_words = set(candidate.split())
        length_ratio = len(candidate) / max(1, len(normalized))
        overlap = len(words & candidate_words) / max(1, min(len(words), len(candidate_words)))
        if 0.55 <= length_ratio <= 1.8 and overlap >= 0.45:
            narrowed.append(candidate)
    return max(
        ((SequenceMatcher(None, normalized, candidate).ratio(), candidate) for candidate in narrowed),
        default=(0.0, ""),
    )


def load_psc2() -> tuple[dict[str, tuple[str, str]], dict[str, str]]:
    sql = PSC2_SQL.read_text(encoding="utf-8")
    sql = sql.split("insert into psc2_catalog_import", 1)[1].split(";", 1)[0]
    pattern = re.compile(
        r"\('([^']+)','([^']+)','((?:''|[^'])*)','([^']+)',(\d+)\)"
    )
    by_label: dict[str, tuple[str, str]] = {}
    by_code: dict[str, str] = {}
    for code, subject, label, _locator, _order in pattern.findall(sql):
        label = label.replace("''", "'")
        by_label[norm(label)] = (code, subject)
        by_code[code] = label
    if len(by_code) != 165:
        raise RuntimeError(f"Expected 165 PSC 2 skills, found {len(by_code)}")
    return by_label, by_code


SUBJECT_PREFIX = {
    "portuguese_literature": "language",
    "foreign_language": "foreign-language",
    "history": "history",
    "geography": "geography",
    "biology": "biology",
    "chemistry": "chemistry",
    "physics": "physics",
    "mathematics": "mathematics",
    "languages_codes": "language",
    "human_sciences": "human-sciences",
}


class CanonicalRegistry:
    def __init__(self, psc2_labels: dict[str, tuple[str, str]], psc2_codes: dict[str, str]):
        self.by_label = dict(psc2_labels)
        self.by_code = dict(psc2_codes)
        self.origin = {code: "PSC 2" for code in psc2_codes}

    def resolve(self, label: str, subject: str, origin: str) -> tuple[str, str, str | None]:
        normalized = norm(label)
        existing = self.by_label.get(normalized)
        if existing:
            code, existing_subject = existing
            return code, existing_subject, self.origin[code]

        base = f"{SUBJECT_PREFIX[subject]}.{slug(label)}"
        code = base
        if code in self.by_code and norm(self.by_code[code]) != normalized:
            code = f"{base}-{hashlib.sha1(label.encode('utf-8')).hexdigest()[:8]}"
        self.by_label[normalized] = (code, subject)
        self.by_code[code] = label
        self.origin[code] = origin
        return code, subject, None


PSC_HEADERS = {
    "LÍNGUA PORTUGUESA E LITERATURA": "portuguese_literature",
    "LÍNGUA ESTRANGEIRA": "foreign_language",
    "HISTÓRIA": "history",
    "GEOGRAFIA": "geography",
    "BIOLOGIA": "biology",
    "QUÍMICA": "chemistry",
    "FÍSICA": "physics",
    "MATEMÁTICA": "mathematics",
}


def page_chunks(pdf: Path, page_numbers: range) -> list[tuple[str, int, str]]:
    reader = PdfReader(str(pdf))
    current_subject: str | None = None
    chunks: list[tuple[str, int, str]] = []
    for page_number in page_numbers:
        lines = (reader.pages[page_number - 1].extract_text() or "").splitlines()
        buffer: list[str] = []

        def flush() -> None:
            nonlocal buffer
            if current_subject and buffer:
                text = clean(" ".join(buffer))
                if text:
                    chunks.append((current_subject, page_number, text))
            buffer = []

        for raw in lines:
            line = clean(raw)
            if not line or line.isdigit() or line.startswith("ANEXO "):
                continue
            if line in PSC_HEADERS:
                flush()
                current_subject = PSC_HEADERS[line]
                continue
            if current_subject:
                buffer.append(line)
        flush()
    return chunks


def sentence_parts(text: str) -> list[str]:
    parts = re.split(r"(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÂÊÔÃÕÇ“\"])", text)
    return [clean(part).rstrip(".") for part in parts if clean(part).rstrip(".")]


def parse_psc(pdf: Path, pages: range, catalog: str, registry: CanonicalRegistry) -> tuple[list[Item], list[str]]:
    chunks = page_chunks(pdf, pages)
    raw: list[tuple[str, int, int, str]] = []
    carry: tuple[str, int, str] | None = None
    for index, (subject, page, text) in enumerate(chunks):
        if carry:
            carry_subject, start_page, carry_text = carry
            if carry_subject == subject:
                text = clean(carry_text + " " + text)
                page_start = start_page
            else:
                raw.append((carry_subject, start_page, start_page, carry_text))
                page_start = page
            carry = None
        else:
            page_start = page

        parts = sentence_parts(text)
        next_same = index + 1 < len(chunks) and chunks[index + 1][0] == subject
        if parts and not re.search(r"[.!?]$", text) and next_same:
            carry = (subject, page_start, parts.pop())
        for part in parts:
            raw.append((subject, page_start, page, part))
    if carry:
        raw.append((carry[0], carry[1], carry[1], carry[2]))

    items: list[Item] = []
    duplicate_sources: list[str] = []
    seen: dict[str, Item] = {}
    order_by_subject: defaultdict[str, int] = defaultdict(int)
    psc2_names = list(registry.by_label.keys())
    for subject, start_page, end_page, label in raw:
        normalized = norm(label)
        if len(normalized) < 3:
            continue
        if subject == "foreign_language" and not normalized.startswith("ela versara sobre compreensao de textos"):
            duplicate_sources.append(f"NÃO IMPORTADO (descrição administrativa, não conteúdo): {label}")
            continue
        if normalized in seen:
            duplicate_sources.append(
                f"{label} — p. {start_page} repete {seen[normalized].locator}"
            )
            continue

        code, canonical_subject, reused = registry.resolve(label, subject, catalog)
        order_by_subject[subject] += 1
        page_label = str(start_page) if start_page == end_page else f"{start_page}–{end_page}"
        section = next(name for name, value in PSC_HEADERS.items() if value == subject)
        classification = "SAFE"
        note = "Literal normalizado da fonte oficial"
        if subject == "foreign_language":
            classification = "SOURCE AMBIGUITY"
            note = "A fonte declara que não há programa específico e fornece apenas escopo geral"
        elif len(label) > 190 or label.count(":") >= 2 or label.count(";") >= 3:
            classification = "REVIEW RECOMMENDED"
            note = "Tópico composto preservado porque a fonte não permite separação segura"
        elif not reused:
            closest = closest_label(normalized, psc2_names)
            if closest[0] >= 0.86:
                classification = "POSSIBLE DUPLICATE"
                note = f"Similaridade textual com item do PSC 2 ({closest[0]:.2f}); sem fusão automática"
        item = Item(
            code=code,
            subject=canonical_subject,
            label=label,
            locator=f"Anexo {'1' if catalog == 'PSC 1' else '2'}, p. {page_label} — {section}",
            page=start_page,
            section=section,
            order=order_by_subject[subject],
            classification=classification,
            note=note,
            reused_from=reused,
        )
        items.append(item)
        seen[normalized] = item
    return items, duplicate_sources


def strip_enem_page(text: str) -> str:
    ignored = {
        "MATRIZES DE REFERÊNCIA", "ENEM", "VOL TAR PARA", "O SUMÁRIO",
        "LINGUAGENS, CÓDIGOS", "E SUAS TECNOLOGIAS", "MATEMÁTICA E SUAS",
        "CIÊNCIAS DA NATUREZA", "CIÊNCIAS HUMANAS E", "COMPETÊNCIAS",
    }
    lines = []
    for raw in text.splitlines():
        line = clean(raw)
        if (
            not line
            or line in ignored
            or line.isdigit()
            or line.startswith("O SUMÁRIO")
            or line in {"TECNOLOGIAS", "CIÊNCIAS HUMANAS", "LINGUAGENS, CÓDIGOS E SUAS TECNOLOGIAS", "MATEMÁTICA E SUAS TECNOLOGIAS", "CIÊNCIAS DA NATUREZA E SUAS TECNOLOGIAS", "CIÊNCIAS HUMANAS E SUAS TECNOLOGIAS"}
        ):
            continue
        lines.append(line)
    return clean(" ".join(lines))


def parse_enem_areas(pdf: Path) -> tuple[list[dict], list[dict]]:
    reader = PdfReader(str(pdf))
    specs = [
        ("languages", "Linguagens, Códigos e suas Tecnologias", range(10, 15)),
        ("mathematics", "Matemática e suas Tecnologias", range(15, 19)),
        ("natural_sciences", "Ciências da Natureza e suas Tecnologias", range(19, 24)),
        ("human_sciences", "Ciências Humanas e suas Tecnologias", range(24, 28)),
    ]
    areas: list[dict] = []
    flat_abilities: list[dict] = []
    for area_code, area_name, pages in specs:
        competencies: list[dict] = []
        current: dict | None = None
        last_ability: dict | None = None
        for page_number in pages:
            text = strip_enem_page(reader.pages[page_number - 1].extract_text() or "")
            tokens = list(re.finditer(r"Competência de área\s+(\d+)|H(\d+)\s*[–-]", text))
            if tokens and tokens[0].start() > 0 and last_ability:
                last_ability["text"] = clean(last_ability["text"] + " " + text[:tokens[0].start()])
            for i, token in enumerate(tokens):
                end = tokens[i + 1].start() if i + 1 < len(tokens) else len(text)
                body = clean(text[token.end():end])
                if token.group(1):
                    current = {
                        "code": f"{area_code}.C{int(token.group(1))}",
                        "number": int(token.group(1)),
                        "text": body,
                        "source_page": page_number,
                        "abilities": [],
                    }
                    competencies.append(current)
                    last_ability = None
                else:
                    if current is None:
                        raise RuntimeError(f"Ability without competency on ENEM page {page_number}")
                    ability = {
                        "code": f"{area_code}.H{int(token.group(2))}",
                        "number": int(token.group(2)),
                        "text": body,
                        "source_page": page_number,
                    }
                    current["abilities"].append(ability)
                    flat_abilities.append(ability)
                    last_ability = ability
        areas.append({"code": area_code, "name": area_name, "competencies": competencies})
    return areas, flat_abilities


def parse_enem_axes_and_essay(pdf: Path) -> tuple[list[dict], list[dict]]:
    reader = PdfReader(str(pdf))
    axes_text = strip_enem_page(reader.pages[8].extract_text() or "")
    axes: list[dict] = []
    tokens = list(re.finditer(r"(?:^|\s)(I{1,3}|IV|V)\.\s+([^:]+):", axes_text))
    for i, token in enumerate(tokens):
        end = tokens[i + 1].start() if i + 1 < len(tokens) else len(axes_text)
        axes.append({
            "code": token.group(1),
            "name": clean(token.group(2)),
            "text": clean(axes_text[token.end():end]).rstrip("."),
            "source_page": 9,
        })

    essay_text = strip_enem_page(reader.pages[28].extract_text() or "")
    essay: list[dict] = []
    tokens = list(re.finditer(r"Competência\s+(I{1,3}|IV|V)\s+", essay_text))
    if len(tokens) < 6:
        raise RuntimeError("Could not locate the five ENEM essay competencies and rubric boundary")
    for i, token in enumerate(tokens[:5]):
        end = tokens[i + 1].start() if i + 1 < len(tokens) else len(essay_text)
        essay.append({
            "code": token.group(1),
            "text": clean(essay_text[token.end():end]).rstrip("."),
            "source_page": 29,
        })
    return axes, essay


def page_layout_lines(page) -> list[tuple[float, str]]:
    words = page.extract_words(extra_attrs=["size"])
    rows: list[dict] = []
    for word in sorted(words, key=lambda value: (value["top"], value["x0"])):
        row = next((item for item in rows if abs(item["top"] - word["top"]) <= 1.0), None)
        if row is None:
            row = {"top": word["top"], "words": []}
            rows.append(row)
        row["words"].append(word)
    result = []
    for row in sorted(rows, key=lambda value: value["top"]):
        if row["top"] >= 780:
            continue
        text = clean(" ".join(word["text"] for word in sorted(row["words"], key=lambda value: value["x0"])))
        size = max(float(word["size"]) for word in row["words"])
        if text:
            result.append((size, text))
    return result


def parse_enem_objects(pdf: Path) -> list[dict]:
    area_specs = [
        ("languages", "Linguagens, Códigos e suas Tecnologias", range(33, 37), "languages_codes"),
        ("mathematics", "Matemática e suas Tecnologias", range(37, 39), "mathematics"),
        ("natural_sciences", "Ciências da Natureza e suas Tecnologias", range(39, 53), "physics"),
        ("human_sciences", "Ciências Humanas e suas Tecnologias", range(53, 57), "human_sciences"),
    ]
    areas: list[dict] = []
    with pdfplumber.open(str(pdf)) as document:
        for area_code, area_name, pages, default_subject in area_specs:
            groups: list[dict] = []
            current_group: dict | None = None
            current_item: dict | None = None
            current_subject = default_subject

            def flush_item() -> None:
                nonlocal current_item
                if current_item and current_group:
                    current_item["text"] = clean(current_item["text"])
                    current_group["items"].append(current_item)
                current_item = None

            for page_number in pages:
                lines = page_layout_lines(document.pages[page_number - 1])
                heading_parts: list[str] = []
                for size, text in lines:
                    if size >= 30:
                        continue
                    if 17.5 <= size < 20 and text in {"FÍSICA", "QUÍMICA", "BIOLOGIA"}:
                        flush_item()
                        current_subject = {"FÍSICA": "physics", "QUÍMICA": "chemistry", "BIOLOGIA": "biology"}[text]
                        current_group = None
                        heading_parts = []
                        continue
                    if text == "•":
                        flush_item()
                        if heading_parts:
                            current_group = {
                                "title": clean(" ".join(heading_parts)),
                                "subject_code": current_subject,
                                "source_page": page_number,
                                "items": [],
                            }
                            groups.append(current_group)
                            heading_parts = []
                        if current_group is None:
                            raise RuntimeError(f"Object without heading on ENEM page {page_number}")
                        current_item = {"text": "", "source_page": page_number}
                        continue
                    if 14.0 <= size < 17.0:
                        flush_item()
                        heading_parts.append(text)
                        continue
                    if size <= 13.6 and current_item is not None:
                        current_item["text"] = clean(current_item["text"] + " " + text)
                # Items deliberately continue across pages until a new bullet/heading.
            flush_item()
            areas.append({"code": area_code, "name": area_name, "object_groups": groups})
    return areas


def classify_enem_item(label: str, reused: str | None, registry: CanonicalRegistry) -> tuple[str, str]:
    if reused:
        return "SAFE", f"Reutiliza skill canônica já presente em {reused}"
    normalized = norm(label)
    candidate_labels = [
        known
        for known, (code, _subject) in registry.by_label.items()
        if known != normalized and registry.origin.get(code) == "PSC 2"
    ]
    closest = closest_label(normalized, candidate_labels)
    if closest[0] >= 0.88:
        return "POSSIBLE DUPLICATE", f"Similaridade textual {closest[0]:.2f}; não houve fusão automática"
    if len(label) > 180 or label.count(";") >= 3:
        return "REVIEW RECOMMENDED", "Objeto composto preservado literalmente"
    return "SAFE", "Objeto de conhecimento explícito da matriz"


def build_enem(pdf: Path, registry: CanonicalRegistry) -> tuple[dict, list[Item]]:
    axes, essay = parse_enem_axes_and_essay(pdf)
    areas, abilities = parse_enem_areas(pdf)
    object_areas = parse_enem_objects(pdf)
    object_by_code = {area["code"]: area["object_groups"] for area in object_areas}
    for area in areas:
        area["object_groups"] = object_by_code[area["code"]]
    framework = {
        "schema_version": 1,
        "framework_type": "enem_reference_matrix",
        "cognitive_axes": axes,
        "areas": areas,
        "essay_competencies": essay,
    }

    if len(axes) != 5 or len(abilities) != 120:
        raise RuntimeError(f"Unexpected ENEM framework counts: axes={len(axes)}, abilities={len(abilities)}")
    competencies = sum(len(area["competencies"]) for area in areas)
    if competencies != 30 or len(essay) != 5:
        raise RuntimeError(f"Unexpected ENEM competency counts: objective={competencies}, essay={len(essay)}")

    items: list[Item] = []
    seen: set[str] = set()
    order = 0
    for area in areas:
        for group in area["object_groups"]:
            for obj in group["items"]:
                label = obj["text"]
                normalized = norm(label)
                if normalized in seen:
                    continue
                seen.add(normalized)
                code, subject, reused = registry.resolve(label, group["subject_code"], "ENEM")
                classification, note = classify_enem_item(label, reused, registry)
                order += 1
                items.append(Item(
                    code=code,
                    subject=subject,
                    label=label,
                    locator=f"Matriz de Referência, p. {obj['source_page']} — {area['name']} — {group['title']}",
                    page=obj["source_page"],
                    section=f"{area['name']} / {group['title']}",
                    order=order,
                    classification=classification,
                    note=note,
                    reused_from=reused,
                ))
    return framework, items


SUBJECT_ROWS = {
    "portuguese_literature": ("Língua Portuguesa e Literatura", "Língua Portuguesa e Literatura", "languages", 10),
    "foreign_language": ("Língua Estrangeira", "Língua Estrangeira", "languages", 15),
    "history": ("História", "História", "other", 20),
    "geography": ("Geografia", "Geografia", "other", 30),
    "biology": ("Biologia", "Biologia", "biology", 40),
    "chemistry": ("Química", "Química", "chemistry", 50),
    "physics": ("Física", "Física", "physics", 60),
    "mathematics": ("Matemática", "Matemática", "mathematics", 70),
    "languages_codes": ("Linguagens, Códigos e suas Tecnologias", "Languages, Codes and Technologies", "languages", 80),
    "human_sciences": ("Ciências Humanas e suas Tecnologias", "Human Sciences and Technologies", "other", 90),
}


def write_catalog_migration(
    path: Path,
    *,
    catalog_id: str,
    program_code: str,
    institution: str,
    program_name: str,
    stage: str,
    cycle: str,
    exam_year: int,
    project_year: int,
    source_url: str,
    source_year: int,
    source_document: str,
    document_version: str,
    catalog_version: str,
    items: list[Item],
    framework: dict | None = None,
) -> None:
    subjects = sorted({item.subject for item in items}, key=lambda code: SUBJECT_ROWS[code][3])
    subject_values = ",\n  ".join(
        f"({sql_text(code)},{sql_text(SUBJECT_ROWS[code][0])},{sql_text(SUBJECT_ROWS[code][1])},{sql_text(SUBJECT_ROWS[code][2])},{SUBJECT_ROWS[code][3]})"
        for code in subjects
    )
    unique_skills: dict[str, Item] = {item.code: item for item in items}
    skill_values = ",\n  ".join(
        f"({sql_text(item.code)},{sql_text(item.subject)},'skill',{sql_text(item.label)},{sql_text(item.label)})"
        for item in unique_skills.values()
    )
    mapping_values = ",\n  ".join(
        f"({sql_text(catalog_id)}::uuid,{sql_text(item.code)},{sql_text(item.locator)},{sql_text(item.label)},{item.order})"
        for item in items
    )
    framework_sql = "null" if framework is None else f"$framework${json.dumps(framework, ensure_ascii=False, separators=(',', ':'))}$framework$::jsonb"
    sql = f"""-- LOCAL/DRAFT catalog imported exclusively from the approved official source.
-- This migration publishes nothing and contains no learner data.

insert into public.academic_subjects(code,name_pt_br,name_en,legacy_subject_id,display_order) values
  {subject_values}
on conflict (code) do nothing;

insert into public.exam_programs(code,institution,name) values
  ({sql_text(program_code)},{sql_text(institution)},{sql_text(program_name)})
on conflict (code) do nothing;

insert into public.exam_catalog_versions(
  id,program_code,stage,cycle,exam_year,project_year,source_url,source_year,
  source_document,document_version,catalog_version,status,imported_at,published_at,assessment_framework
) values (
  {sql_text(catalog_id)}::uuid,{sql_text(program_code)},{sql_text(stage)},{sql_text(cycle)},{exam_year},{project_year},
  {sql_text(source_url)},{source_year},{sql_text(source_document)},{sql_text(document_version)},
  {sql_text(catalog_version)},'draft',now(),null,{framework_sql}
);

insert into public.curriculum_skills(code,subject_code,level,name_pt_br,name_en) values
  {skill_values}
on conflict (code) do nothing;

insert into public.exam_catalog_skills(catalog_version_id,skill_code,source_locator,source_excerpt,display_order) values
  {mapping_values}
on conflict (catalog_version_id,skill_code) do nothing;

do $validation$
begin
  if (select status from public.exam_catalog_versions where id={sql_text(catalog_id)}::uuid) <> 'draft' then
    raise exception 'Catalog must remain draft';
  end if;
  if (select published_at from public.exam_catalog_versions where id={sql_text(catalog_id)}::uuid) is not null then
    raise exception 'Draft catalog cannot have published_at';
  end if;
  if (select count(*) from public.exam_catalog_skills where catalog_version_id={sql_text(catalog_id)}::uuid) <> {len(items)} then
    raise exception 'Unexpected catalog skill count';
  end if;
end
$validation$;
"""
    path.write_text(sql, encoding="utf-8", newline="\n")


def report_catalog(title: str, items: list[Item], duplicates: list[str], detailed_path: Path, professor_path: Path) -> None:
    grouped: defaultdict[str, list[Item]] = defaultdict(list)
    for item in items:
        grouped[item.subject].append(item)
    professor = [title, ""]
    detailed = [f"# {title} — revisão acadêmica", "", "> Catálogo local em DRAFT. Nenhum item foi publicado.", ""]
    for subject in sorted(grouped, key=lambda code: SUBJECT_ROWS[code][3]):
        name = SUBJECT_ROWS[subject][0]
        professor.extend([name.upper(), *[f"{index:02d}. {item.label}" for index, item in enumerate(grouped[subject], 1)], ""])
        detailed.extend([
            f"## {name} ({len(grouped[subject])})", "",
            "| Ordem | Canonical code | Nome/origem | Página/seção | Aliases | Classificação | Observação |",
            "|---:|---|---|---|---|---|---|",
        ])
        for item in grouped[subject]:
            values = [str(item.order), item.code, item.label, item.locator, "—", item.classification, item.note]
            detailed.append("| " + " | ".join(value.replace("|", "\\|") for value in values) + " |")
        detailed.append("")
    detailed.extend(["## Duplicatas literais encontradas na fonte", ""])
    detailed.extend([f"- {entry}" for entry in duplicates] or ["- Nenhuma."])
    detailed.extend(["", "## Resumo", ""])
    counts = defaultdict(int)
    for item in items:
        counts[item.classification] += 1
    detailed.extend([f"- {key}: {value}" for key, value in sorted(counts.items())])
    detailed_path.write_text("\n".join(detailed) + "\n", encoding="utf-8", newline="\n")
    professor_path.write_text("\n".join(professor) + "\n", encoding="utf-8", newline="\n")


def report_enem(framework: dict, items: list[Item], path: Path) -> None:
    lines = [
        "# ENEM 2026 — revisão acadêmica", "",
        "> Fonte: Matriz de Referência oficial do INEP. Catálogo local em DRAFT.", "",
        "## Eixos cognitivos", "",
    ]
    for axis in framework["cognitive_axes"]:
        lines.append(f"- **{axis['code']} — {axis['name']}**: {axis['text']} (p. {axis['source_page']})")
    for area in framework["areas"]:
        lines.extend(["", f"## {area['name']}", "", "### Competências e habilidades", ""])
        for competency in area["competencies"]:
            lines.append(f"#### {competency['code']} — {competency['text']} (p. {competency['source_page']})")
            lines.append("")
            for ability in competency["abilities"]:
                lines.append(f"- **{ability['code']}** — {ability['text']} (p. {ability['source_page']})")
        lines.extend(["", "### Objetos de conhecimento / skills canônicas", ""])
        area_items = [item for item in items if item.section.startswith(area["name"] + " /")]
        by_section: defaultdict[str, list[Item]] = defaultdict(list)
        for item in area_items:
            by_section[item.section.split(" / ", 1)[1]].append(item)
        for section, section_items in by_section.items():
            lines.extend([
                f"#### {section}", "",
                "| Ordem | Canonical code | Objeto explícito | Página/seção | Aliases | Classificação | Observação |",
                "|---:|---|---|---|---|---|---|",
            ])
            for item in section_items:
                values = [str(item.order), item.code, item.label, item.locator, "—", item.classification, item.note]
                lines.append("| " + " | ".join(value.replace("|", "\\|") for value in values) + " |")
            lines.append("")
    lines.extend(["", "## Competências de redação", ""])
    for competency in framework["essay_competencies"]:
        lines.append(f"- **Competência {competency['code']}** — {competency['text']} (p. {competency['source_page']})")
    object_occurrences: defaultdict[str, list[str]] = defaultdict(list)
    for area in framework["areas"]:
        for group in area["object_groups"]:
            for obj in group["items"]:
                object_occurrences[norm(obj["text"])].append(
                    f"{obj['text']} — {area['name']} / {group['title']} / p. {obj['source_page']}"
                )
    repeated = [entries for entries in object_occurrences.values() if len(entries) > 1]
    lines.extend(["", "## Objetos repetidos na própria matriz", ""])
    if repeated:
        for entries in repeated:
            lines.append(f"- Uma única skill canônica representa {len(entries)} ocorrências documentais:")
            lines.extend(f"  - {entry}" for entry in entries)
    else:
        lines.append("- Nenhum.")
    lines.extend(["", "## Aliases", "", "- Nenhum alias novo foi criado automaticamente; a revisão foi conservadora."])
    path.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")


def validate_catalog(name: str, items: list[Item]) -> None:
    codes = [item.code for item in items]
    labels = [norm(item.label) for item in items]
    if len(codes) != len(set(codes)):
        raise RuntimeError(f"{name}: duplicate canonical code inside catalog")
    if len(labels) != len(set(labels)):
        raise RuntimeError(f"{name}: duplicate normalized label inside catalog")
    if any(not item.subject or not item.locator or not item.section or not item.label for item in items):
        raise RuntimeError(f"{name}: item without subject or source traceability")
    if any("�" in item.label or not re.fullmatch(r"[a-z][a-z0-9.-]{2,159}", item.code) for item in items):
        raise RuntimeError(f"{name}: invalid character or canonical code")
    orders: defaultdict[str, list[int]] = defaultdict(list)
    for item in items:
        orders[item.subject].append(item.order)
    if any(len(values) != len(set(values)) for values in orders.values()):
        raise RuntimeError(f"{name}: duplicate display order inside subject")


def main() -> None:
    REPORTS.mkdir(parents=True, exist_ok=True)
    psc2_labels, psc2_codes = load_psc2()
    registry = CanonicalRegistry(psc2_labels, psc2_codes)

    psc1, psc1_duplicates = parse_psc(
        PDF_DIR / "psc-2027-etapa-1-consolidado.pdf", range(16, 22), "PSC 1", registry
    )
    psc3, psc3_duplicates = parse_psc(
        PDF_DIR / "psc-2027-etapa-3-consolidado.pdf", range(24, 30), "PSC 3", registry
    )
    framework, enem = build_enem(PDF_DIR / "enem-matriz-referencia-2026.pdf", registry)
    validate_catalog("PSC 1", psc1)
    validate_catalog("PSC 3", psc3)
    validate_catalog("ENEM", enem)
    framework_text = json.dumps(framework, ensure_ascii=False)
    if any(key in framework_text for key in ('"ability_code"', '"ability_codes"', '"object_to_ability"')):
        raise RuntimeError("ENEM: invented object-to-ability relation")

    write_catalog_migration(
        MIGRATIONS / "20260910121000_psc_2027_stage_1_draft.sql",
        catalog_id="27000000-0000-4000-8000-000000000001", program_code="psc",
        institution="Universidade Federal do Amazonas — UFAM",
        program_name="Processo Seletivo Contínuo — PSC", stage="1ª Etapa", cycle="Projeto 2029",
        exam_year=2027, project_year=2029,
        source_url="https://edoc.ufam.edu.br/handle/123456789/12241", source_year=2026,
        source_document="Edital 13 de 2026 [Consolidado]",
        document_version="Consolidado com a Retificação nº 01 aplicada",
        catalog_version="psc-2027-stage-1-project-2029-v1", items=psc1,
    )
    write_catalog_migration(
        MIGRATIONS / "20260910122000_psc_2027_stage_3_draft.sql",
        catalog_id="27000000-0000-4000-8000-000000000003", program_code="psc",
        institution="Universidade Federal do Amazonas — UFAM",
        program_name="Processo Seletivo Contínuo — PSC", stage="3ª Etapa", cycle="Projeto 2027",
        exam_year=2027, project_year=2027,
        source_url="https://edoc.ufam.edu.br/handle/123456789/12243", source_year=2026,
        source_document="Edital 15 de 2026 [Consolidado]",
        document_version="Consolidado com a Retificação nº 01 aplicada",
        catalog_version="psc-2027-stage-3-project-2027-v1", items=psc3,
    )
    write_catalog_migration(
        MIGRATIONS / "20260910123000_enem_2026_reference_matrix_draft.sql",
        catalog_id="27000000-0000-4000-8000-000000000100", program_code="enem",
        institution="Instituto Nacional de Estudos e Pesquisas Educacionais Anísio Teixeira — INEP",
        program_name="Exame Nacional do Ensino Médio — ENEM", stage="Matriz de Referência", cycle="ENEM 2026",
        exam_year=2026, project_year=2026,
        source_url="https://www.gov.br/inep/pt-br/centrais-de-conteudo/acervo-linha-editorial/publicacoes-institucionais/avaliacoes-e-exames-da-educacao-basica/matrizes-de-referencia-enem",
        source_year=2026, source_document="Matrizes de Referência ENEM",
        document_version="Publicação institucional de 17/07/2026",
        catalog_version="enem-2026-reference-matrix-v1", items=enem, framework=framework,
    )

    report_catalog("PSC 1 — UFAM", psc1, psc1_duplicates, REPORTS / "psc1-academic-validation.md", REPORTS / "psc1-professor-review.txt")
    report_catalog("PSC 3 — UFAM", psc3, psc3_duplicates, REPORTS / "psc3-academic-validation.md", REPORTS / "psc3-professor-review.txt")
    report_enem(framework, enem, REPORTS / "enem-2026-academic-validation.md")

    summary = {
        "psc1_skills": len(psc1),
        "psc3_skills": len(psc3),
        "enem_curriculum_skills": len(enem),
        "enem_framework": {
            "cognitive_axes": len(framework["cognitive_axes"]),
            "areas": len(framework["areas"]),
            "objective_competencies": sum(len(area["competencies"]) for area in framework["areas"]),
            "abilities": sum(len(comp["abilities"]) for area in framework["areas"] for comp in area["competencies"]),
            "object_groups": sum(len(area["object_groups"]) for area in framework["areas"]),
            "knowledge_objects": sum(len(group["items"]) for area in framework["areas"] for group in area["object_groups"]),
            "essay_competencies": len(framework["essay_competencies"]),
        },
        "reused_from_psc2": sum(item.reused_from == "PSC 2" for item in psc1 + psc3 + enem),
        "reused_from_any_prior_catalog": sum(item.reused_from is not None for item in psc1 + psc3 + enem),
        "reuse_details": [
            {"catalog": catalog, "code": item.code, "label": item.label, "reused_from": item.reused_from}
            for catalog, values in (("PSC 1", psc1), ("PSC 3", psc3), ("ENEM", enem))
            for item in values if item.reused_from is not None
        ],
        "new_canonical_skills": sum(item.reused_from is None for item in psc1 + psc3 + enem),
        "classifications": dict(sorted({key: sum(item.classification == key for item in psc1 + psc3 + enem) for key in {item.classification for item in psc1 + psc3 + enem}}.items())),
        "distribution": {
            catalog: dict(sorted({SUBJECT_ROWS[key][0]: sum(item.subject == key for item in values) for key in {item.subject for item in values}}.items()))
            for catalog, values in (("PSC 1", psc1), ("PSC 3", psc3), ("ENEM", enem))
        },
    }
    (REPORTS / "approved-draft-catalog-import-summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n"
    )
    markdown = [
        "# Importação local dos catálogos aprovados", "",
        "> PSC 1, PSC 3 e ENEM permanecem em DRAFT. Este relatório não representa publicação remota.", "",
        f"- PSC 1: {len(psc1)} skills avaliáveis.",
        f"- PSC 3: {len(psc3)} skills avaliáveis.",
        f"- ENEM: {len(enem)} skills canônicas para 379 ocorrências de objetos de conhecimento.",
        f"- Reutilizações diretas do PSC 2: {summary['reused_from_psc2']}.",
        f"- Novas skills canônicas: {summary['new_canonical_skills']}.",
        "- Aliases novos: 0 (nenhuma equivalência incerta foi forçada).", "",
        "## Framework ENEM", "",
        "- 5 eixos cognitivos.", "- 4 áreas.", "- 30 competências objetivas.",
        "- 120 habilidades.", "- 41 grupos de objetos de conhecimento.",
        "- 379 ocorrências de objetos de conhecimento.", "- 5 competências de redação.",
        "- Nenhuma relação individual objeto → habilidade foi criada.", "",
        "## Distribuição", "",
    ]
    for catalog, distribution in summary["distribution"].items():
        markdown.append(f"### {catalog}")
        markdown.append("")
        markdown.extend(f"- {subject}: {count}" for subject, count in distribution.items())
        markdown.append("")
    markdown.extend([
        "## Decisões conservadoras", "",
        "- As três frases administrativas que antecedem o escopo acadêmico de Língua Estrangeira no PSC 3 não foram transformadas em skills.",
        "- O objeto ‘Circunferências’ aparece em dois grupos da matriz do ENEM; as duas ocorrências ficam no framework e usam uma única skill canônica.",
        "- Tópicos compostos extensos foram marcados para revisão de professores, sem separação inferida.",
        "- SIS 2026 e Vestibular UEA/Macro 2026 continuam não importados porque a fonte acadêmica vigente ainda não foi identificada com segurança.",
    ])
    (REPORTS / "approved-draft-catalog-import-summary.md").write_text(
        "\n".join(markdown) + "\n", encoding="utf-8", newline="\n"
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
