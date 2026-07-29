from __future__ import annotations

import re
import sys
from pathlib import Path

from docx import Document
from docx.enum.section import WD_SECTION
from docx.enum.style import WD_STYLE_TYPE
from docx.enum.table import WD_CELL_VERTICAL_ALIGNMENT, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH, WD_BREAK
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Inches, Pt, RGBColor


ROOT = Path(__file__).resolve().parent
SOURCE = ROOT / "DITCH-CMO-Onboarding-Handbook.md"
OUTPUT = ROOT / "DITCH-CMO-Onboarding-Handbook.docx"

# compact_reference_guide preset, resolved and extended with a named DITCH brand override.
PAGE_WIDTH_DXA = 9360
TABLE_INDENT_DXA = 120
CELL_MARGIN_DXA = {"top": 80, "bottom": 80, "start": 120, "end": 120}
FONT = "Aptos"
MONO = "Consolas"
NAVY = RGBColor(13, 13, 26)
MID_NAVY = RGBColor(26, 26, 62)
MAGENTA = RGBColor(255, 29, 180)
MINT = RGBColor(0, 150, 122)
MINT_BRIGHT = RGBColor(0, 212, 170)
INK = RGBColor(31, 35, 48)
MUTED = RGBColor(105, 105, 121)
LIGHT = RGBColor(242, 244, 247)
PALE_PINK = RGBColor(255, 238, 249)
PALE_MINT = RGBColor(232, 249, 245)
WHITE = RGBColor(255, 255, 255)
BORDER = "D9DCE4"


def set_font(run, name=FONT, size=None, color=None, bold=None, italic=None):
    run.font.name = name
    run._element.get_or_add_rPr().rFonts.set(qn("w:ascii"), name)
    run._element.get_or_add_rPr().rFonts.set(qn("w:hAnsi"), name)
    if size is not None:
        run.font.size = Pt(size)
    if color is not None:
        run.font.color.rgb = color
    if bold is not None:
        run.bold = bold
    if italic is not None:
        run.italic = italic


def set_repeat_table_header(row):
    tr_pr = row._tr.get_or_add_trPr()
    tbl_header = OxmlElement("w:tblHeader")
    tbl_header.set(qn("w:val"), "true")
    tr_pr.append(tbl_header)


def set_cell_shading(cell, fill):
    tc_pr = cell._tc.get_or_add_tcPr()
    shd = tc_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        tc_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def set_cell_margins(cell, margins=CELL_MARGIN_DXA):
    tc = cell._tc
    tc_pr = tc.get_or_add_tcPr()
    tc_mar = tc_pr.first_child_found_in("w:tcMar")
    if tc_mar is None:
        tc_mar = OxmlElement("w:tcMar")
        tc_pr.append(tc_mar)
    for edge in ("top", "start", "bottom", "end"):
        node = tc_mar.find(qn(f"w:{edge}"))
        if node is None:
            node = OxmlElement(f"w:{edge}")
            tc_mar.append(node)
        node.set(qn("w:w"), str(margins[edge]))
        node.set(qn("w:type"), "dxa")


def set_cell_width(cell, width_dxa):
    tc_pr = cell._tc.get_or_add_tcPr()
    tc_w = tc_pr.find(qn("w:tcW"))
    if tc_w is None:
        tc_w = OxmlElement("w:tcW")
        tc_pr.append(tc_w)
    tc_w.set(qn("w:w"), str(width_dxa))
    tc_w.set(qn("w:type"), "dxa")


def set_table_geometry(table, widths):
    table.autofit = False
    table.alignment = WD_TABLE_ALIGNMENT.LEFT
    tbl_pr = table._tbl.tblPr
    tbl_w = tbl_pr.find(qn("w:tblW"))
    if tbl_w is None:
        tbl_w = OxmlElement("w:tblW")
        tbl_pr.append(tbl_w)
    tbl_w.set(qn("w:w"), str(sum(widths)))
    tbl_w.set(qn("w:type"), "dxa")
    tbl_ind = tbl_pr.find(qn("w:tblInd"))
    if tbl_ind is None:
        tbl_ind = OxmlElement("w:tblInd")
        tbl_pr.append(tbl_ind)
    tbl_ind.set(qn("w:w"), str(TABLE_INDENT_DXA))
    tbl_ind.set(qn("w:type"), "dxa")

    grid = table._tbl.tblGrid
    for child in list(grid):
        grid.remove(child)
    for width in widths:
        col = OxmlElement("w:gridCol")
        col.set(qn("w:w"), str(width))
        grid.append(col)

    for row in table.rows:
        for idx, cell in enumerate(row.cells):
            set_cell_width(cell, widths[idx])
            set_cell_margins(cell)
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER


def set_table_borders(table, color=BORDER, size="6"):
    tbl_pr = table._tbl.tblPr
    borders = tbl_pr.find(qn("w:tblBorders"))
    if borders is None:
        borders = OxmlElement("w:tblBorders")
        tbl_pr.append(borders)
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        tag = borders.find(qn(f"w:{edge}"))
        if tag is None:
            tag = OxmlElement(f"w:{edge}")
            borders.append(tag)
        tag.set(qn("w:val"), "single")
        tag.set(qn("w:sz"), size)
        tag.set(qn("w:space"), "0")
        tag.set(qn("w:color"), color)


def set_paragraph_border(paragraph, color="FF1DB4", size="18", space="6"):
    p_pr = paragraph._p.get_or_add_pPr()
    p_bdr = p_pr.find(qn("w:pBdr"))
    if p_bdr is None:
        p_bdr = OxmlElement("w:pBdr")
        p_pr.append(p_bdr)
    bottom = OxmlElement("w:bottom")
    bottom.set(qn("w:val"), "single")
    bottom.set(qn("w:sz"), size)
    bottom.set(qn("w:space"), space)
    bottom.set(qn("w:color"), color)
    p_bdr.append(bottom)


def set_paragraph_shading(paragraph, fill):
    p_pr = paragraph._p.get_or_add_pPr()
    shd = p_pr.find(qn("w:shd"))
    if shd is None:
        shd = OxmlElement("w:shd")
        p_pr.append(shd)
    shd.set(qn("w:fill"), fill)


def add_page_number(paragraph):
    paragraph.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    run = paragraph.add_run("Page ")
    set_font(run, size=8.5, color=MUTED)
    fld_char1 = OxmlElement("w:fldChar")
    fld_char1.set(qn("w:fldCharType"), "begin")
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " PAGE "
    fld_char2 = OxmlElement("w:fldChar")
    fld_char2.set(qn("w:fldCharType"), "end")
    run._r.append(fld_char1)
    run._r.append(instr)
    run._r.append(fld_char2)


def set_keep(paragraph, next_paragraph=False):
    p_pr = paragraph._p.get_or_add_pPr()
    keep_lines = OxmlElement("w:keepLines")
    p_pr.append(keep_lines)
    if next_paragraph:
        keep_next = OxmlElement("w:keepNext")
        p_pr.append(keep_next)


def set_widow_control(paragraph):
    p_pr = paragraph._p.get_or_add_pPr()
    widow = OxmlElement("w:widowControl")
    p_pr.append(widow)


def add_inline_runs(paragraph, text, default_color=INK, default_size=10.5):
    # Simple inline Markdown: **bold**, *italic*, and `code`.
    token_re = re.compile(r"(\*\*.*?\*\*|`.*?`|\*[^*]+?\*)")
    pos = 0
    for match in token_re.finditer(text):
        if match.start() > pos:
            run = paragraph.add_run(text[pos:match.start()])
            set_font(run, size=default_size, color=default_color)
        token = match.group(0)
        if token.startswith("**"):
            run = paragraph.add_run(token[2:-2])
            set_font(run, size=default_size, color=default_color, bold=True)
        elif token.startswith("`"):
            run = paragraph.add_run(token[1:-1])
            set_font(run, name=MONO, size=max(8.5, default_size - 1), color=MID_NAVY)
        else:
            run = paragraph.add_run(token[1:-1])
            set_font(run, size=default_size, color=default_color, italic=True)
        pos = match.end()
    if pos < len(text):
        run = paragraph.add_run(text[pos:])
        set_font(run, size=default_size, color=default_color)


def build_numbering(doc):
    numbering = doc.part.numbering_part.element
    existing_abs = [
        int(node.get(qn("w:abstractNumId")))
        for node in numbering.findall(qn("w:abstractNum"))
    ]
    nsid = max(existing_abs, default=0) + 1

    def abstract(abstract_id, num_format, level_text, font_name=None):
        abs_num = OxmlElement("w:abstractNum")
        abs_num.set(qn("w:abstractNumId"), str(abstract_id))
        multi = OxmlElement("w:multiLevelType")
        multi.set(qn("w:val"), "singleLevel")
        abs_num.append(multi)
        lvl = OxmlElement("w:lvl")
        lvl.set(qn("w:ilvl"), "0")
        start = OxmlElement("w:start")
        start.set(qn("w:val"), "1")
        num_fmt = OxmlElement("w:numFmt")
        num_fmt.set(qn("w:val"), num_format)
        lvl_text_node = OxmlElement("w:lvlText")
        lvl_text_node.set(qn("w:val"), level_text)
        suff = OxmlElement("w:suff")
        suff.set(qn("w:val"), "tab")
        p_pr = OxmlElement("w:pPr")
        tabs = OxmlElement("w:tabs")
        tab = OxmlElement("w:tab")
        tab.set(qn("w:val"), "num")
        tab.set(qn("w:pos"), "540")
        tabs.append(tab)
        ind = OxmlElement("w:ind")
        ind.set(qn("w:left"), "540")
        ind.set(qn("w:hanging"), "270")
        spacing = OxmlElement("w:spacing")
        spacing.set(qn("w:after"), "80")
        spacing.set(qn("w:line"), "300")
        spacing.set(qn("w:lineRule"), "auto")
        p_pr.extend([tabs, ind, spacing])
        lvl.extend([start, num_fmt, lvl_text_node, suff, p_pr])
        if font_name:
            r_pr = OxmlElement("w:rPr")
            fonts = OxmlElement("w:rFonts")
            fonts.set(qn("w:ascii"), font_name)
            fonts.set(qn("w:hAnsi"), font_name)
            r_pr.append(fonts)
            lvl.append(r_pr)
        abs_num.append(lvl)
        numbering.append(abs_num)
        return abstract_id

    bullet_abs = abstract(nsid, "bullet", "•", FONT)
    number_abs = abstract(nsid + 1, "decimal", "%1.", FONT)
    bullet_num = add_num_instance(doc, bullet_abs)
    return bullet_num, number_abs


def add_num_instance(doc, abstract_id):
    numbering = doc.part.numbering_part.element
    existing_nums = [
        int(node.get(qn("w:numId")))
        for node in numbering.findall(qn("w:num"))
    ]
    num_id = max(existing_nums, default=0) + 1
    num = OxmlElement("w:num")
    num.set(qn("w:numId"), str(num_id))
    abs_ref = OxmlElement("w:abstractNumId")
    abs_ref.set(qn("w:val"), str(abstract_id))
    num.append(abs_ref)
    level_override = OxmlElement("w:lvlOverride")
    level_override.set(qn("w:ilvl"), "0")
    start_override = OxmlElement("w:startOverride")
    start_override.set(qn("w:val"), "1")
    level_override.append(start_override)
    num.append(level_override)
    numbering.append(num)
    return num_id


def apply_num(paragraph, num_id):
    p_pr = paragraph._p.get_or_add_pPr()
    num_pr = p_pr.find(qn("w:numPr"))
    if num_pr is None:
        num_pr = OxmlElement("w:numPr")
        p_pr.append(num_pr)
    ilvl = OxmlElement("w:ilvl")
    ilvl.set(qn("w:val"), "0")
    num = OxmlElement("w:numId")
    num.set(qn("w:val"), str(num_id))
    num_pr.extend([ilvl, num])


def configure_styles(doc):
    styles = doc.styles
    normal = styles["Normal"]
    normal.font.name = FONT
    normal._element.rPr.rFonts.set(qn("w:ascii"), FONT)
    normal._element.rPr.rFonts.set(qn("w:hAnsi"), FONT)
    normal.font.size = Pt(10.5)
    normal.font.color.rgb = INK
    normal.paragraph_format.space_before = Pt(0)
    normal.paragraph_format.space_after = Pt(6)
    normal.paragraph_format.line_spacing = 1.25

    for style_name, size, color, before, after in (
        ("Title", 31, NAVY, 0, 8),
        ("Subtitle", 14, MUTED, 0, 10),
        ("Heading 1", 18, NAVY, 18, 9),
        ("Heading 2", 13.5, MID_NAVY, 14, 7),
        ("Heading 3", 11.5, MINT, 10, 5),
    ):
        style = styles[style_name]
        style.font.name = FONT
        style._element.rPr.rFonts.set(qn("w:ascii"), FONT)
        style._element.rPr.rFonts.set(qn("w:hAnsi"), FONT)
        style.font.size = Pt(size)
        style.font.color.rgb = color
        style.font.bold = style_name != "Subtitle"
        style.paragraph_format.space_before = Pt(before)
        style.paragraph_format.space_after = Pt(after)
        style.paragraph_format.keep_with_next = True

    code_style = styles.add_style("DITCH Code", WD_STYLE_TYPE.PARAGRAPH)
    code_style.font.name = MONO
    code_style._element.rPr.rFonts.set(qn("w:ascii"), MONO)
    code_style._element.rPr.rFonts.set(qn("w:hAnsi"), MONO)
    code_style.font.size = Pt(8.5)
    code_style.font.color.rgb = WHITE
    code_style.paragraph_format.space_before = Pt(2)
    code_style.paragraph_format.space_after = Pt(2)
    code_style.paragraph_format.left_indent = Inches(0.16)
    code_style.paragraph_format.right_indent = Inches(0.16)
    code_style.paragraph_format.line_spacing = 1.1

    quote_style = styles.add_style("DITCH Quote", WD_STYLE_TYPE.PARAGRAPH)
    quote_style.font.name = FONT
    quote_style.font.size = Pt(12)
    quote_style.font.italic = True
    quote_style.font.color.rgb = MID_NAVY
    quote_style.paragraph_format.left_indent = Inches(0.28)
    quote_style.paragraph_format.right_indent = Inches(0.18)
    quote_style.paragraph_format.space_before = Pt(7)
    quote_style.paragraph_format.space_after = Pt(9)
    quote_style.paragraph_format.line_spacing = 1.2


def add_header_footer(section):
    section.header_distance = Inches(0.492)
    section.footer_distance = Inches(0.492)
    header = section.header
    hp = header.paragraphs[0]
    hp.alignment = WD_ALIGN_PARAGRAPH.LEFT
    hp.paragraph_format.space_after = Pt(3)
    run = hp.add_run("DITCH  /  CMO ONBOARDING & OPERATING HANDBOOK")
    set_font(run, size=8.2, color=MUTED, bold=True)
    set_paragraph_border(hp, color="D9DCE4", size="5", space="4")
    footer = section.footer
    fp = footer.paragraphs[0]
    add_page_number(fp)


def add_cover(doc):
    p = doc.add_paragraph()
    p.paragraph_format.space_before = Pt(20)
    p.paragraph_format.space_after = Pt(88)
    r = p.add_run("DITCH")
    set_font(r, size=15, color=MAGENTA, bold=True)

    kicker = doc.add_paragraph()
    kicker.alignment = WD_ALIGN_PARAGRAPH.CENTER
    kicker.paragraph_format.space_after = Pt(13)
    r = kicker.add_run("EXECUTIVE ONBOARDING")
    set_font(r, size=9.5, color=MINT, bold=True)

    title = doc.add_paragraph(style="Title")
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    title.paragraph_format.space_after = Pt(10)
    r = title.add_run("CMO Onboarding &\nOperating Handbook")
    set_font(r, size=31, color=NAVY, bold=True)

    subtitle = doc.add_paragraph(style="Subtitle")
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
    subtitle.paragraph_format.space_after = Pt(26)
    r = subtitle.add_run(
        "The product, technology, business model, growth system,\n"
        "trust obligations, and first 90 days"
    )
    set_font(r, size=14, color=MUTED)

    rule = doc.add_paragraph()
    rule.alignment = WD_ALIGN_PARAGRAPH.CENTER
    rule.paragraph_format.left_indent = Inches(1.7)
    rule.paragraph_format.right_indent = Inches(1.7)
    set_paragraph_border(rule, color="FF1DB4", size="20", space="6")

    tag = doc.add_paragraph()
    tag.alignment = WD_ALIGN_PARAGRAPH.CENTER
    tag.paragraph_format.space_before = Pt(30)
    tag.paragraph_format.space_after = Pt(84)
    r = tag.add_run("Go live everywhere. Bring your audience into the show.")
    set_font(r, size=13, color=MID_NAVY, bold=True)

    meta = doc.add_paragraph()
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    meta.paragraph_format.space_after = Pt(4)
    r = meta.add_run("VERSION 1.0  |  23 JULY 2026")
    set_font(r, size=9, color=MUTED, bold=True)
    conf = doc.add_paragraph()
    conf.alignment = WD_ALIGN_PARAGRAPH.CENTER
    r = conf.add_run("CONFIDENTIAL - INTERNAL USE ONLY")
    set_font(r, size=9, color=MAGENTA, bold=True)

    doc.add_page_break()


def add_contents(doc, section_titles):
    h = doc.add_paragraph("Contents", style="Heading 1")
    set_paragraph_border(h, color="FF1DB4", size="12", space="5")
    intro = doc.add_paragraph()
    add_inline_runs(
        intro,
        "A complete orientation to DITCH, followed by the decisions and operating "
        "work the CMO must lead.",
    )
    table = doc.add_table(rows=0, cols=2)
    table.style = "Table Grid"
    for index, title in enumerate(section_titles, start=1):
        cells = table.add_row().cells
        cells[0].text = f"{index:02d}"
        cells[1].text = title
        if index % 2 == 0:
            set_cell_shading(cells[0], "F8F8FB")
            set_cell_shading(cells[1], "F8F8FB")
        for run in cells[0].paragraphs[0].runs:
            set_font(run, size=9, color=MAGENTA, bold=True)
        for run in cells[1].paragraphs[0].runs:
            set_font(run, size=9.5, color=INK)
        cells[0].paragraphs[0].alignment = WD_ALIGN_PARAGRAPH.CENTER
    set_table_geometry(table, [720, 8640])
    set_table_borders(table, color="E3E4EA", size="4")
    doc.add_page_break()


def add_callout(doc, label, text, fill, accent):
    table = doc.add_table(rows=1, cols=1)
    table.style = "Table Grid"
    set_table_geometry(table, [PAGE_WIDTH_DXA])
    set_table_borders(table, color=accent, size="8")
    cell = table.cell(0, 0)
    set_cell_shading(cell, fill)
    p = cell.paragraphs[0]
    p.paragraph_format.space_before = Pt(2)
    p.paragraph_format.space_after = Pt(2)
    r = p.add_run(label.upper() + "  ")
    set_font(r, size=9, color=RGBColor.from_string(accent), bold=True)
    add_inline_runs(p, text, default_color=INK, default_size=10)
    spacer = doc.add_paragraph()
    spacer.paragraph_format.space_after = Pt(1)


def parse_table(lines, start):
    rows = []
    i = start
    while i < len(lines) and lines[i].strip().startswith("|"):
        row = [cell.strip() for cell in lines[i].strip().strip("|").split("|")]
        rows.append(row)
        i += 1
    if len(rows) >= 2 and all(re.fullmatch(r":?-{3,}:?", c) for c in rows[1]):
        return [rows[0]] + rows[2:], i
    return rows, i


def choose_widths(rows):
    cols = len(rows[0])
    if cols == 2:
        max_first = max(len(row[0]) for row in rows)
        return [2700, 6660] if max_first > 22 else [2160, 7200]
    if cols == 3:
        return [2160, 3600, 3600]
    if cols == 4:
        return [1800, 2760, 2400, 2400]
    base = PAGE_WIDTH_DXA // cols
    widths = [base] * cols
    widths[-1] += PAGE_WIDTH_DXA - sum(widths)
    return widths


def add_markdown_table(doc, rows):
    if not rows:
        return
    cols = len(rows[0])
    rows = [r + [""] * (cols - len(r)) for r in rows]
    table = doc.add_table(rows=len(rows), cols=cols)
    table.style = "Table Grid"
    for r_idx, row in enumerate(rows):
        for c_idx, text in enumerate(row):
            cell = table.cell(r_idx, c_idx)
            cell.text = ""
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(1)
            p.paragraph_format.space_after = Pt(1)
            add_inline_runs(
                p,
                text,
                default_color=WHITE if r_idx == 0 else INK,
                default_size=8.3 if cols >= 4 else 8.8,
            )
            if r_idx == 0:
                set_cell_shading(cell, "1A1A3E")
                for run in p.runs:
                    run.bold = True
            elif r_idx % 2 == 0:
                set_cell_shading(cell, "F7F8FA")
    set_repeat_table_header(table.rows[0])
    set_table_geometry(table, choose_widths(rows))
    set_table_borders(table)
    after = doc.add_paragraph()
    after.paragraph_format.space_after = Pt(1)


def render_body(doc, lines, bullet_id, number_abs_id):
    i = 0
    code_mode = False
    code_lines = []
    body_started = False
    skip_front = True
    current_number_id = None

    while i < len(lines):
        raw = lines[i]
        line = raw.rstrip()

        if skip_front:
            if line.startswith("# 1. "):
                skip_front = False
            else:
                i += 1
                continue

        if line.startswith("```"):
            if not code_mode:
                code_mode = True
                code_lines = []
            else:
                p = doc.add_paragraph(style="DITCH Code")
                p.paragraph_format.space_before = Pt(6)
                p.paragraph_format.space_after = Pt(8)
                p.add_run("\n".join(code_lines))
                set_paragraph_shading(p, "0D0D1A")
                set_keep(p)
                code_mode = False
            i += 1
            continue

        if code_mode:
            code_lines.append(line)
            i += 1
            continue

        if not line.strip() or line.strip() == "---":
            i += 1
            continue

        if line.startswith("|"):
            rows, i = parse_table(lines, i)
            add_markdown_table(doc, rows)
            continue

        heading = re.match(r"^(#{1,3})\s+(.+)$", line)
        if heading:
            level = len(heading.group(1))
            text = heading.group(2)
            if level == 1:
                if body_started:
                    doc.add_page_break()
                body_started = True
                p = doc.add_paragraph(text, style="Heading 1")
                set_paragraph_border(p, color="FF1DB4", size="12", space="5")
            elif level == 2:
                p = doc.add_paragraph(text, style="Heading 2")
            else:
                p = doc.add_paragraph(text, style="Heading 3")
            set_keep(p, next_paragraph=True)
            i += 1
            continue

        if line.startswith("> "):
            p = doc.add_paragraph(style="DITCH Quote")
            add_inline_runs(p, line[2:], default_color=MID_NAVY, default_size=12)
            set_paragraph_shading(p, "FFF0FA")
            set_keep(p)
            i += 1
            continue

        list_match = re.match(r"^-\s+(.+)$", line)
        num_match = re.match(r"^\d+\.\s+(.+)$", line)
        if list_match or num_match:
            p = doc.add_paragraph()
            p.paragraph_format.space_after = Pt(4)
            p.paragraph_format.line_spacing = 1.25
            p.paragraph_format.keep_together = True
            if list_match:
                apply_num(p, bullet_id)
            else:
                previous_is_number = i > 0 and re.match(r"^\d+\.\s+", lines[i - 1].rstrip())
                if not previous_is_number or current_number_id is None:
                    current_number_id = add_num_instance(doc, number_abs_id)
                apply_num(p, current_number_id)
            add_inline_runs(p, (list_match or num_match).group(1))
            i += 1
            continue

        # Named fact/recommendation paragraphs become restrained callouts.
        for prefix, label, fill, accent in (
            ("**Current fact:**", "Current fact", "E8F9F5", "00967A"),
            ("**Important qualification:**", "Important qualification", "FFF0FA", "FF1DB4"),
            ("**Strategic recommendation:**", "Strategic recommendation", "FFF0FA", "FF1DB4"),
            ("**Strategic hypothesis:**", "Strategic hypothesis", "F2F4F7", "1A1A3E"),
            ("**Recommended starting metric:**", "Recommended metric", "E8F9F5", "00967A"),
        ):
            if line.startswith(prefix):
                add_callout(doc, label, line[len(prefix):].strip(), fill, accent)
                i += 1
                break
        else:
            p = doc.add_paragraph()
            add_inline_runs(p, line)
            set_widow_control(p)
            i += 1


def audit(doc):
    section = doc.sections[0]
    assert round(section.page_width.inches, 2) == 8.5
    assert round(section.page_height.inches, 2) == 11.0
    for margin in (section.top_margin, section.right_margin, section.bottom_margin, section.left_margin):
        assert round(margin.inches, 2) == 1.0
    for style_name in ("Normal", "Title", "Subtitle", "Heading 1", "Heading 2", "Heading 3"):
        assert style_name in doc.styles
    for table in doc.tables:
        grid = table._tbl.tblGrid
        widths = [int(col.get(qn("w:w"))) for col in grid]
        assert sum(widths) == PAGE_WIDTH_DXA, (sum(widths), widths)
        for row in table.rows:
            assert len(row.cells) == len(widths)
            for index, cell in enumerate(row.cells):
                tc_w = cell._tc.get_or_add_tcPr().find(qn("w:tcW"))
                assert int(tc_w.get(qn("w:w"))) == widths[index]


def main():
    source = SOURCE.read_text(encoding="utf-8")
    lines = source.splitlines()
    section_titles = []
    for line in lines:
        match = re.match(r"^#\s+\d+\.\s+(.+)$", line)
        if match:
            section_titles.append(match.group(1))

    doc = Document()
    section = doc.sections[0]
    section.page_width = Inches(8.5)
    section.page_height = Inches(11)
    section.top_margin = Inches(1)
    section.right_margin = Inches(1)
    section.bottom_margin = Inches(1)
    section.left_margin = Inches(1)
    section.header_distance = Inches(0.492)
    section.footer_distance = Inches(0.492)
    section.different_first_page_header_footer = True
    configure_styles(doc)
    bullet_id, number_abs_id = build_numbering(doc)
    add_header_footer(section)
    add_cover(doc)
    add_contents(doc, section_titles)
    render_body(doc, lines, bullet_id, number_abs_id)

    props = doc.core_properties
    props.title = "DITCH CMO Onboarding & Operating Handbook"
    props.subject = "Executive onboarding for DITCH"
    props.author = "DITCH"
    props.keywords = "DITCH, CMO, onboarding, live streaming, multistream, participation"
    props.comments = "Prepared for internal executive onboarding."

    audit(doc)
    doc.save(OUTPUT)
    print(OUTPUT)


if __name__ == "__main__":
    main()
