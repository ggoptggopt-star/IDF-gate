#!/usr/bin/env python3
"""
generate_chapter1.py
สร้างเอกสาร Word (.docx) บทที่ 1 บทนำ
โครงงาน: ระบบขออนุญาตออกนอกสถานศึกษาผ่านแชทและสั่งเปิดไม้กั้นอัตโนมัติด้วยเทคโนโลยีปัญญาประดิษฐ์จดจำใบหน้า
สถานศึกษา: วิทยาลัยการอาชีพองครักษ์ (OICEC)
"""

import re
from pathlib import Path

from docx import Document
from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml import OxmlElement, parse_xml
from docx.oxml.ns import nsdecls, qn
from docx.shared import Cm, Inches, Pt, RGBColor
from pythainlp import word_tokenize

ZWS = "\u200b"
FONT_NAME = "TH SarabunPSK"
_THAI_RE = re.compile(r"([\u0E00-\u0E7F]+)")


def insert_zwsp(text: str) -> str:
    """แทรก Zero-Width Space (U+200B) ระหว่างคำไทยเพื่อให้ Word ตัดบรรทัดเต็มหน้ากระดาษ"""
    if not text:
        return ""
    parts = _THAI_RE.split(text)
    result = []
    for part in parts:
        if _THAI_RE.fullmatch(part):
            tokens = word_tokenize(part, engine="newmm")
            joined = ZWS.join(t for t in tokens if t)
            # ป้องกันไม้ยมก (ๆ) และไปยาลน้อย (ฯ) หลุดไปขึ้นบรรทัดใหม่เพียงลำพัง
            joined = re.sub(rf"{ZWS}([ๆฯ])", r"\1", joined)
            result.append(joined)
        else:
            result.append(part)
    return "".join(result)


def set_run_font(run, size_pt: int, bold: bool = False, font_name: str = FONT_NAME) -> None:
    """ตั้งค่าฟอนต์ Complex Script (TH SarabunPSK) ครบถ้วนสำหรับ Microsoft Word"""
    run.font.name = font_name
    run.font.size = Pt(size_pt)
    run.bold = bold
    run.font.color.rgb = RGBColor(0, 0, 0)

    rPr = run._element.get_or_add_rPr()
    rFonts = rPr.find(qn("w:rFonts"))
    if rFonts is None:
        rFonts = parse_xml(
            f'<w:rFonts {nsdecls("w")} '
            f'w:ascii="{font_name}" w:hAnsi="{font_name}" '
            f'w:eastAsia="{font_name}" w:cs="{font_name}"/>'
        )
        rPr.insert(0, rFonts)
    else:
        rFonts.set(qn("w:ascii"), font_name)
        rFonts.set(qn("w:hAnsi"), font_name)
        rFonts.set(qn("w:eastAsia"), font_name)
        rFonts.set(qn("w:cs"), font_name)

    for tag in ("w:sz", "w:szCs"):
        el = rPr.find(qn(tag))
        if el is None:
            el = parse_xml(f'<{tag} {nsdecls("w")} w:val="{size_pt * 2}"/>')
            rPr.append(el)
        else:
            el.set(qn("w:val"), str(size_pt * 2))

    if bold:
        for tag in ("w:b", "w:bCs"):
            if rPr.find(qn(tag)) is None:
                rPr.append(parse_xml(f'<{tag} {nsdecls("w")} w:val="1"/>'))


def add_page_number_header(section) -> None:
    """ตั้งค่าเลขหน้ามุมบนขวา (ซ่อนเลขหน้าในหน้าแรกของบทตามมาตรฐานรูปเล่มโครงงาน)"""
    section.different_first_page_header_footer = True
    section.header_distance = Cm(1.9)
    header = section.header
    p = header.paragraphs[0]
    p.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(0)

    run_begin = p.add_run()
    set_run_font(run_begin, 16, bold=False)
    fld_begin = OxmlElement("w:fldChar")
    fld_begin.set(qn("w:fldCharType"), "begin")
    run_begin._element.append(fld_begin)

    run_instr = p.add_run()
    set_run_font(run_instr, 16, bold=False)
    instr = OxmlElement("w:instrText")
    instr.set(qn("xml:space"), "preserve")
    instr.text = " PAGE "
    run_instr._element.append(instr)

    run_sep = p.add_run()
    set_run_font(run_sep, 16, bold=False)
    fld_sep = OxmlElement("w:fldChar")
    fld_sep.set(qn("w:fldCharType"), "separate")
    run_sep._element.append(fld_sep)

    run_num = p.add_run("1")
    set_run_font(run_num, 16, bold=False)

    run_end = p.add_run()
    set_run_font(run_end, 16, bold=False)
    fld_end = OxmlElement("w:fldChar")
    fld_end.set(qn("w:fldCharType"), "end")
    run_end._element.append(fld_end)


def add_styled_paragraph(
    doc: Document,
    text: str,
    size_pt: int = 16,
    bold: bool = False,
    alignment=WD_ALIGN_PARAGRAPH.LEFT,
    first_line_indent_cm: float = 0.0,
    left_indent_cm: float = 0.0,
    hanging_indent_cm: float = 0.0,
    space_before_pt: float = 0.0,
    space_after_pt: float = 4.0,
    line_spacing: float = 1.0,
    keep_with_next: bool = False,
):
    """เพิ่มย่อหน้าพร้อมตัดคำภาษาไทยและตั้งค่าระยะย่อหน้า"""
    p = doc.add_paragraph()
    p.alignment = alignment
    pf = p.paragraph_format
    pf.line_spacing = line_spacing
    pf.space_before = Pt(space_before_pt)
    pf.space_after = Pt(space_after_pt)
    pf.keep_with_next = keep_with_next
    if left_indent_cm:
        pf.left_indent = Cm(left_indent_cm)
    if hanging_indent_cm:
        pf.first_line_indent = Cm(-hanging_indent_cm)
    elif first_line_indent_cm:
        pf.first_line_indent = Cm(first_line_indent_cm)

    run = p.add_run(insert_zwsp(text))
    set_run_font(run, size_pt=size_pt, bold=bold)
    return p


def add_mixed_definition_paragraph(
    doc: Document,
    term_prefix: str,
    body_text: str,
    left_indent_cm: float = 1.27,
    space_after_pt: float = 4.0,
):
    """เพิ่มย่อหน้านิยามศัพท์เฉพาะ (ชื่อหัวข้อเป็นตัวหนา 16pt ตามด้วยคำอธิบายตัวปกติ 16pt)"""
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
    pf = p.paragraph_format
    pf.line_spacing = 1.0
    pf.space_before = Pt(0)
    pf.space_after = Pt(space_after_pt)
    pf.first_line_indent = Cm(left_indent_cm)

    r_term = p.add_run(insert_zwsp(term_prefix))
    set_run_font(r_term, size_pt=16, bold=True)

    r_body = p.add_run(insert_zwsp(" " + body_text))
    set_run_font(r_body, size_pt=16, bold=False)
    return p


def set_cell_margins(cell, top=60, bottom=60, left=80, right=80) -> None:
    """ตั้งค่าระยะขอบภายในเซลล์ (หน่วย dxa)"""
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(
        f'<w:tcMar {nsdecls("w")}>'
        f'  <w:top w:w="{top}" w:type="dxa"/>'
        f'  <w:left w:w="{left}" w:type="dxa"/>'
        f'  <w:bottom w:w="{bottom}" w:type="dxa"/>'
        f'  <w:right w:w="{right}" w:type="dxa"/>'
        f'</w:tcMar>'
    )
    existing = tcPr.find(qn("w:tcMar"))
    if existing is not None:
        tcPr.remove(existing)
    tcPr.append(tcMar)


def set_cell_borders(cell, top=True, bottom=True, left=True, right=True, sz="4") -> None:
    """กำหนดเส้นขอบเฉพาะเซลล์"""
    tcPr = cell._tc.get_or_add_tcPr()
    def _edge(name, enabled):
        if enabled:
            return f'<{name} w:val="single" w:sz="{sz}" w:space="0" w:color="000000"/>'
        return f'<{name} w:val="none" w:sz="0" w:space="0" w:color="auto"/>'

    borders = parse_xml(
        f'<w:tcBorders {nsdecls("w")}>'
        f'  {_edge("w:top", top)}'
        f'  {_edge("w:left", left)}'
        f'  {_edge("w:bottom", bottom)}'
        f'  {_edge("w:right", right)}'
        f'</w:tcBorders>'
    )
    existing = tcPr.find(qn("w:tcBorders"))
    if existing is not None:
        tcPr.remove(existing)
    tcPr.append(borders)


def set_cell_shading(cell, fill_hex: str) -> None:
    """กำหนดสีพื้นหลังเซลล์"""
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {nsdecls("w")} w:val="clear" w:color="auto" w:fill="{fill_hex}"/>')
    existing = tcPr.find(qn("w:shd"))
    if existing is not None:
        tcPr.remove(existing)
    tcPr.append(shd)


def prevent_row_split(row) -> None:
    """ป้องกันไม่ให้แถวในตารางถูกตัดแบ่งข้ามหน้า"""
    trPr = row._tr.get_or_add_trPr()
    if trPr.find(qn("w:cantSplit")) is None:
        trPr.append(parse_xml(f'<w:cantSplit {nsdecls("w")}/>'))


def set_repeat_table_header(row) -> None:
    """ให้แถวหัวตารางซ้ำอัตโนมัติหากตารางข้ามหน้า"""
    trPr = row._tr.get_or_add_trPr()
    if trPr.find(qn("w:tblHeader")) is None:
        trPr.append(parse_xml(f'<w:tblHeader {nsdecls("w")}/>'))


def set_fixed_table_widths(table, col_widths_cm: list[float]) -> None:
    """กำหนดความกว้างตารางและทุกคอลัมน์แบบคงที่ (tblW + tblLayout=fixed + tblGrid)"""
    twips = [round(w * 1440 / 2.54) for w in col_widths_cm]
    total_twips = sum(twips)

    tbl = table._tbl
    tblPr = tbl.tblPr
    for tag, xml in [
        ("w:tblW", f'<w:tblW {nsdecls("w")} w:w="{total_twips}" w:type="dxa"/>'),
        ("w:tblLayout", f'<w:tblLayout {nsdecls("w")} w:type="fixed"/>'),
    ]:
        existing = tblPr.find(qn(tag))
        if existing is not None:
            tblPr.remove(existing)
        tblPr.append(parse_xml(xml))

    tblGrid = tbl.tblGrid
    for gc in list(tblGrid.findall(qn("w:gridCol"))):
        tblGrid.remove(gc)
    for w_twip in twips:
        tblGrid.append(parse_xml(f'<w:gridCol {nsdecls("w")} w:w="{w_twip}"/>'))

    for row in table.rows:
        for idx, w_cm in enumerate(col_widths_cm):
            row.cells[idx].width = Cm(w_cm)


def set_cell_text(
    cell,
    text: str,
    size_pt: int = 16,
    bold: bool = False,
    alignment=WD_ALIGN_PARAGRAPH.LEFT,
    space_after_pt: float = 0.0,
):
    """ใส่ข้อความลงในเซลล์ตารางพร้อมตัดคำภาษาไทย"""
    cell.text = ""
    cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
    p = cell.paragraphs[0]
    p.alignment = alignment
    p.paragraph_format.space_before = Pt(0)
    p.paragraph_format.space_after = Pt(space_after_pt)
    p.paragraph_format.line_spacing = 1.0
    run = p.add_run(insert_zwsp(text))
    set_run_font(run, size_pt=size_pt, bold=bold)
    return p


def add_conceptual_framework_table(doc: Document) -> None:
    """สร้างตารางแผนภาพกรอบแนวคิดในการทำโครงงาน (ตัวแปรต้น -> ตัวแปรตาม)"""
    add_styled_paragraph(
        doc,
        "ตารางที่ 1.1 กรอบแนวคิดในการทำโครงงาน",
        size_pt=16,
        bold=True,
        alignment=WD_ALIGN_PARAGRAPH.LEFT,
        space_before_pt=6.0,
        space_after_pt=4.0,
        keep_with_next=True,
    )

    table = doc.add_table(rows=1, cols=3)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False

    col_widths_cm = [6.5, 1.65, 6.5]
    set_fixed_table_widths(table, col_widths_cm)
    row = table.rows[0]
    prevent_row_split(row)

    # กล่องซ้าย: ตัวแปรต้น
    c_left = row.cells[0]
    set_cell_borders(c_left, top=True, bottom=True, left=True, right=True, sz="6")
    set_cell_shading(c_left, "F2F6FC")
    set_cell_margins(c_left, top=120, bottom=120, left=140, right=140)
    c_left.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
    p_l1 = set_cell_text(
        c_left,
        "ตัวแปรต้น (Independent Variable)",
        size_pt=16,
        bold=True,
        alignment=WD_ALIGN_PARAGRAPH.CENTER,
        space_after_pt=4.0,
    )
    p_l1.paragraph_format.space_after = Pt(4)
    p_l2 = c_left.add_paragraph()
    p_l2.alignment = WD_ALIGN_PARAGRAPH.CENTER
    p_l2.paragraph_format.line_spacing = 1.0
    p_l2.paragraph_format.space_after = Pt(0)
    r_l2 = p_l2.add_run(
        insert_zwsp("ระบบขออนุญาตออกนอกสถานศึกษาผ่านแชทและสั่งเปิดไม้กั้นด้วยเทคโนโลยี AI จดจำใบหน้า")
    )
    set_run_font(r_l2, size_pt=16, bold=False)

    # กล่องกลาง: ลูกศรเชื่อมโยง
    c_mid = row.cells[1]
    set_cell_borders(c_mid, top=False, bottom=False, left=False, right=False)
    set_cell_margins(c_mid, top=60, bottom=60, left=20, right=20)
    set_cell_text(c_mid, "→", size_pt=22, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER)

    # กล่องขวา: ตัวแปรตาม
    c_right = row.cells[2]
    set_cell_borders(c_right, top=True, bottom=True, left=True, right=True, sz="6")
    set_cell_shading(c_right, "F2F6FC")
    set_cell_margins(c_right, top=120, bottom=120, left=140, right=140)
    c_right.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
    set_cell_text(
        c_right,
        "ตัวแปรตาม (Dependent Variable)",
        size_pt=16,
        bold=True,
        alignment=WD_ALIGN_PARAGRAPH.CENTER,
        space_after_pt=4.0,
    )
    for item_text in [
        "1. ประสิทธิภาพการทำงานของระบบ (ความถูกต้องแม่นยำในการจดจำใบหน้าสั่งเปิดไม้กั้น และเวลาที่ใช้ในการอนุมัติคำร้อง)",
        "2. ระดับความพึงพอใจของผู้ใช้งาน",
    ]:
        p_r = c_right.add_paragraph()
        p_r.alignment = WD_ALIGN_PARAGRAPH.LEFT
        p_r.paragraph_format.line_spacing = 1.0
        p_r.paragraph_format.space_before = Pt(0)
        p_r.paragraph_format.space_after = Pt(2)
        r_r = p_r.add_run(insert_zwsp(item_text))
        set_run_font(r_r, size_pt=16, bold=False)

    add_styled_paragraph(doc, "", size_pt=16, space_after_pt=4.0)


def add_gantt_chart_table(doc: Document) -> None:
    """สร้างตารางแผนการดำเนินงาน 7 ขั้นตอน (ตุลาคม 2569 – มกราคม 2570)"""
    add_styled_paragraph(
        doc,
        "ตารางที่ 1.2 แผนการดำเนินงานโครงการ (ตุลาคม 2569 – มกราคม 2570)",
        size_pt=16,
        bold=True,
        alignment=WD_ALIGN_PARAGRAPH.LEFT,
        space_before_pt=6.0,
        space_after_pt=4.0,
        keep_with_next=True,
    )

    months = [
        "ตุลาคม 2569",
        "พฤศจิกายน 2569",
        "ธันวาคม 2569",
        "มกราคม 2570",
    ]
    tasks = [
        ("1. ศึกษา", {0, 1, 2}),
        ("2. ออกแบบ", {2, 3, 4, 5}),
        ("3. สร้างนวัตกรรม", {5, 6, 7, 8, 9, 10}),
        ("4. ทดลองใช้", {11, 12}),
        ("5. เก็บข้อมูล", {12, 13}),
        ("6. สรุปผล", {13, 14}),
        ("7. ทำวิจัย 5 บท", {14, 15}),
    ]

    total_cols = 17
    table = doc.add_table(rows=2 + len(tasks), cols=total_cols)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False

    task_col_cm = 3.77
    week_col_cm = 0.68  # 3.77 + 16 * 0.68 = 14.65 cm (พอดีพื้นที่พิมพ์ A4 ขอบซ้าย 1.5" ขวา 1.0")
    set_fixed_table_widths(table, [task_col_cm] + [week_col_cm] * 16)

    # ตั้งขอบของทุกเซลล์
    for r_idx, row in enumerate(table.rows):
        prevent_row_split(row)
        if r_idx < 2:
            set_repeat_table_header(row)
        for c_idx, cell in enumerate(row.cells):
            set_cell_borders(cell, top=True, bottom=True, left=True, right=True, sz="4")
            if c_idx == 0:
                set_cell_margins(cell, top=50, bottom=50, left=80, right=60)
            else:
                set_cell_margins(cell, top=40, bottom=40, left=15, right=15)

    # ผสานเซลล์ส่วนหัวตาราง
    table.cell(0, 0).merge(table.cell(1, 0))
    table.cell(0, 0).width = Cm(task_col_cm)
    set_cell_text(table.cell(0, 0), "ขั้นตอนการดำเนินงาน", size_pt=14, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER)
    set_cell_shading(table.cell(0, 0), "E8EEF7")

    for m_idx, m_name in enumerate(months):
        start_c = 1 + m_idx * 4
        end_c = start_c + 3
        table.cell(0, start_c).merge(table.cell(0, end_c))
        table.cell(0, start_c).width = Cm(week_col_cm * 4)
        set_cell_text(table.cell(0, start_c), m_name, size_pt=13, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER)
        set_cell_shading(table.cell(0, start_c), "E8EEF7")

        for w in range(4):
            w_cell = table.cell(1, start_c + w)
            set_cell_text(w_cell, str(w + 1), size_pt=13, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER)
            set_cell_shading(w_cell, "F2F6FC")

    # เติมข้อมูลแต่ละขั้นตอน
    for t_idx, (t_name, active_weeks) in enumerate(tasks):
        r_idx = 2 + t_idx
        set_cell_text(table.cell(r_idx, 0), t_name, size_pt=14, bold=False, alignment=WD_ALIGN_PARAGRAPH.LEFT)
        for w_idx in range(16):
            cell = table.cell(r_idx, 1 + w_idx)
            if w_idx in active_weeks:
                set_cell_text(cell, "✓", size_pt=13, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER)
                set_cell_shading(cell, "F5F9FF")
            else:
                set_cell_text(cell, "", size_pt=13, bold=False, alignment=WD_ALIGN_PARAGRAPH.CENTER)

    add_styled_paragraph(doc, "", size_pt=16, space_after_pt=4.0)


def build_chapter1(output_path: Path) -> Path:
    """สร้างเอกสาร Word บทที่ 1 บทนำ ฉบับสมบูรณ์"""
    doc = Document()

    # ตั้งค่าหน้ากระดาษ A4 และระยะขอบตามมาตรฐาน สอศ. / วก.องครักษ์
    section = doc.sections[0]
    section.page_width = Cm(21.0)
    section.page_height = Cm(29.7)
    section.top_margin = Inches(1.5)     # 3.81 cm
    section.left_margin = Inches(1.5)    # 3.81 cm (เผื่อเข้าเล่ม)
    section.bottom_margin = Inches(1.0)  # 2.54 cm
    section.right_margin = Inches(1.0)   # 2.54 cm
    add_page_number_header(section)

    # ตั้งค่าสไตล์ Normal เป็น TH SarabunPSK 16pt
    normal = doc.styles["Normal"]
    normal.font.name = FONT_NAME
    normal.font.size = Pt(16)
    rPr = normal.element.get_or_add_rPr()
    rFonts = rPr.find(qn("w:rFonts"))
    if rFonts is None:
        rFonts = parse_xml(
            f'<w:rFonts {nsdecls("w")} '
            f'w:ascii="{FONT_NAME}" w:hAnsi="{FONT_NAME}" '
            f'w:eastAsia="{FONT_NAME}" w:cs="{FONT_NAME}"/>'
        )
        rPr.insert(0, rFonts)
    else:
        rFonts.set(qn("w:ascii"), FONT_NAME)
        rFonts.set(qn("w:hAnsi"), FONT_NAME)
        rFonts.set(qn("w:eastAsia"), FONT_NAME)
        rFonts.set(qn("w:cs"), FONT_NAME)
    normal.paragraph_format.alignment = WD_ALIGN_PARAGRAPH.LEFT
    normal.paragraph_format.line_spacing = 1.0

    # =========================================================================
    # ส่วนหัวบท: บทที่ 1 บทนำ
    # =========================================================================
    add_styled_paragraph(
        doc,
        "บทที่ 1",
        size_pt=20,
        bold=True,
        alignment=WD_ALIGN_PARAGRAPH.CENTER,
        space_before_pt=0.0,
        space_after_pt=0.0,
        keep_with_next=True,
    )
    add_styled_paragraph(
        doc,
        "บทนำ",
        size_pt=20,
        bold=True,
        alignment=WD_ALIGN_PARAGRAPH.CENTER,
        space_before_pt=0.0,
        space_after_pt=12.0,
        keep_with_next=True,
    )

    # =========================================================================
    # 1.1 ความเป็นมาและความสำคัญของปัญหา
    # =========================================================================
    add_styled_paragraph(
        doc,
        "1.1 ความเป็นมาและความสำคัญของปัญหา",
        size_pt=18,
        bold=True,
        alignment=WD_ALIGN_PARAGRAPH.LEFT,
        space_before_pt=6.0,
        space_after_pt=4.0,
        keep_with_next=True,
    )

    background_paragraphs = [
        "สถานศึกษาสังกัดสำนักงานคณะกรรมการการอาชีวศึกษาให้ความสำคัญกับความปลอดภัยและการดูแลความประพฤติของนักเรียนนักศึกษาในระหว่างเวลาเรียน วิทยาลัยการอาชีพองครักษ์จึงกำหนดระเบียบปฏิบัติสำหรับนักเรียนนักศึกษาที่จำเป็นต้องออกนอกสถานศึกษาก่อนเวลาเลิกเรียน ให้ต้องดำเนินการขออนุญาตอย่างเป็นลายลักษณ์อักษรตามสายการบังคับบัญชา 5 ขั้นตอน ได้แก่ ครูรายวิชาที่สอนในคาบนั้น ครูที่ปรึกษา หัวหน้าแผนกวิชา งานปกครอง และรองผู้อำนวยการฝ่ายกิจการนักเรียนนักศึกษา เพื่อยืนยันเหตุผลความจำเป็นและรับรองความปลอดภัยก่อนนำเอกสารไปแสดงต่อเจ้าหน้าที่รักษาความปลอดภัยบริเวณประตูทางออก",
        "อย่างไรก็ตาม กระบวนการยื่นคำร้องด้วยแบบฟอร์มกระดาษในปัจจุบันยังคงมีข้อจำกัดหลายประการ นักเรียนนักศึกษาต้องเดินเรื่องติดตามขอลงนามจากผู้อนุมัติทั้ง 5 ขั้นตอนด้วยตนเอง ซึ่งมักเกิดความล่าช้าเมื่อครูผู้สอนหรือผู้บริหารติดภารกิจสอน ประชุม หรือปฏิบัติราชการนอกสถานที่ อีกทั้งเอกสารกระดาษยังเสี่ยงต่อการชำรุด สูญหาย และไม่สามารถตรวจสอบสถานะความคืบหน้าของคำร้องได้ทันท่วงที นอกจากนี้ การตรวจสอบสิทธิ์หน้าประตูด้วยเอกสารและสายตาอาจเปิดช่องให้เกิดการแอบออกนอกพื้นที่ การปลอมแปลงลายมือชื่อ หรือการนำเอกสารของผู้อื่นมาสวมสิทธิ์ ตลอดจนขาดระบบฐานข้อมูลกลางสำหรับบันทึกเวลาออกจริงเพื่อใช้ตรวจสอบย้อนหลังและประสานแจ้งผู้ปกครอง",
        "เพื่อแก้ไขปัญหาดังกล่าว คณะผู้จัดทำจึงมีแนวคิดพัฒนา \"ระบบขออนุญาตออกนอกสถานศึกษาผ่านแชทและสั่งเปิดไม้กั้นอัตโนมัติด้วยเทคโนโลยีปัญญาประดิษฐ์จดจำใบหน้า\" (Smart Gate Pass AI) โดยย้ายกระบวนการยื่นคำร้องจากกระดาษมาไว้ในแอปพลิเคชันแชทที่พัฒนาขึ้นเอง เพื่อให้นักเรียนนักศึกษากรอกเหตุผล ระบุช่วงเวลาอนุญาต และส่งต่อคำร้องผ่านระบบอนุมัติ 5 ขั้นตอนได้แบบเรียลไทม์ พร้อมระบบแจ้งเตือนและติดตามสถานะทุกขั้นตอน เมื่อคำร้องได้รับการอนุมัติครบถ้วนแล้ว กล้องเว็บแคมความละเอียดสูงบนเครื่องคอมพิวเตอร์ (PC) ณ จุดคัดกรองจะประมวลผลด้วยเทคโนโลยี AI จดจำใบหน้า (Face Recognition) เพื่อยืนยันตัวตนกับฐานข้อมูลใบหน้าและสิทธิ์ช่วงเวลาที่ได้รับอนุญาต ก่อนส่งสัญญาณไปยังบอร์ดไมโครคอนโทรลเลอร์ Arduino/ESP32 และเซอร์โวมอเตอร์ผ่านโมดูลรีเลย์เพื่อเปิด–ปิดแขนไม้กั้นแบบจำลองอัตโนมัติ พร้อมบันทึกเวลาออกจากสถานศึกษาลงในฐานข้อมูลทันที",
        "ระบบและชุดสิ่งประดิษฐ์ที่พัฒนาขึ้นเลือกใช้อุปกรณ์ฮาร์ดแวร์และซอฟต์แวร์ที่มีราคาประหยัด หาซื้อได้ง่าย และดูแลรักษาง่าย แต่สามารถทำงานเชื่อมโยงกันตั้งแต่ต้นจนจบได้อย่างมีประสิทธิภาพ จึงช่วยลดระยะเวลาและปริมาณการใช้กระดาษ ยกระดับความถูกต้องและความโปร่งใสในการคัดกรองบุคคลเข้า–ออกสถานศึกษา ป้องกันการสวมสิทธิ์แทนกัน และเป็นต้นแบบนวัตกรรมดิจิทัลและปัญญาประดิษฐ์ที่สามารถนำไปพัฒนาต่อยอดเพื่อใช้งานจริงในวิทยาลัยการอาชีพองครักษ์และสถานศึกษาอื่นต่อไป",
    ]
    for para in background_paragraphs:
        add_styled_paragraph(
            doc,
            para,
            size_pt=16,
            bold=False,
            alignment=WD_ALIGN_PARAGRAPH.LEFT,
            first_line_indent_cm=1.27,
            space_after_pt=4.0,
        )

    # =========================================================================
    # 1.2 วัตถุประสงค์ของโครงงาน
    # =========================================================================
    add_styled_paragraph(
        doc,
        "1.2 วัตถุประสงค์ของโครงงาน",
        size_pt=18,
        bold=True,
        alignment=WD_ALIGN_PARAGRAPH.LEFT,
        space_before_pt=10.0,
        space_after_pt=4.0,
        keep_with_next=True,
    )
    objectives = [
        "1.2.1 เพื่อออกแบบและสร้างระบบขออนุญาตออกนอกสถานศึกษาผ่านแชทที่ทำงานร่วมกับเทคโนโลยี AI จดจำใบหน้าและชุดไม้กั้นแบบจำลองควบคุมด้วยบอร์ด Arduino/ESP32",
        "1.2.2 เพื่อหาประสิทธิภาพของระบบในด้านความถูกต้องแม่นยำของการจดจำใบหน้าสั่งเปิดไม้กั้น และเวลาที่ใช้ในการอนุมัติคำร้อง",
        "1.2.3 เพื่อศึกษาความพึงพอใจของผู้ใช้งานที่มีต่อระบบขออนุญาตออกนอกสถานศึกษาผ่านแชทและสั่งเปิดไม้กั้นด้วยเทคโนโลยี AI จดจำใบหน้า",
    ]
    for obj in objectives:
        add_styled_paragraph(
            doc,
            obj,
            size_pt=16,
            bold=False,
            alignment=WD_ALIGN_PARAGRAPH.LEFT,
            left_indent_cm=2.27,
            hanging_indent_cm=1.0,
            space_after_pt=3.0,
        )

    # =========================================================================
    # 1.3 สมมติฐานของโครงงาน
    # =========================================================================
    add_styled_paragraph(
        doc,
        "1.3 สมมติฐานของโครงงาน",
        size_pt=18,
        bold=True,
        alignment=WD_ALIGN_PARAGRAPH.LEFT,
        space_before_pt=10.0,
        space_after_pt=4.0,
        keep_with_next=True,
    )
    hypotheses = [
        "1.3.1 ระบบขออนุญาตออกนอกสถานศึกษาผ่านแชทและสั่งเปิดไม้กั้นด้วยเทคโนโลยี AI จดจำใบหน้า มีประสิทธิภาพการทำงานและความแม่นยำในการยืนยันตัวตนผ่านเกณฑ์ที่กำหนด",
        "1.3.2 กลุ่มตัวอย่างมีความพึงพอใจต่อการใช้งานระบบอยู่ในระดับมาก โดยมีค่าเฉลี่ยตั้งแต่ 3.51 ขึ้นไป จากคะแนนเต็ม 5.00",
    ]
    for hyp in hypotheses:
        add_styled_paragraph(
            doc,
            hyp,
            size_pt=16,
            bold=False,
            alignment=WD_ALIGN_PARAGRAPH.LEFT,
            left_indent_cm=2.27,
            hanging_indent_cm=1.0,
            space_after_pt=3.0,
        )

    # =========================================================================
    # 1.4 ขอบเขตของโครงงาน
    # =========================================================================
    add_styled_paragraph(
        doc,
        "1.4 ขอบเขตของโครงงาน",
        size_pt=18,
        bold=True,
        alignment=WD_ALIGN_PARAGRAPH.LEFT,
        space_before_pt=10.0,
        space_after_pt=4.0,
        keep_with_next=True,
    )

    # 1.4.1
    add_styled_paragraph(
        doc,
        "1.4.1 ด้านเนื้อหา",
        size_pt=16,
        bold=True,
        alignment=WD_ALIGN_PARAGRAPH.LEFT,
        left_indent_cm=0.63,
        space_before_pt=4.0,
        space_after_pt=2.0,
        keep_with_next=True,
    )
    add_styled_paragraph(
        doc,
        "พัฒนาระบบยื่นคำร้องขออนุญาตออกนอกสถานศึกษา การส่งต่ออนุมัติตามลำดับขั้น 5 ขั้นตอน ได้แก่ ครูรายวิชา ครูที่ปรึกษา หัวหน้าแผนก งานปกครอง และรองผู้อำนวยการฝ่ายกิจการนักเรียนนักศึกษา การแจ้งเตือน ติดตามสถานะ และบันทึกเวลาออกผ่านแอปพลิเคชันแชทที่พัฒนาขึ้นเอง เชื่อมต่อกับระบบ AI จดจำใบหน้าเพื่อสั่งเปิด–ปิดชุดไม้กั้นแบบจำลอง",
        size_pt=16,
        bold=False,
        alignment=WD_ALIGN_PARAGRAPH.LEFT,
        first_line_indent_cm=1.27,
        space_after_pt=4.0,
    )

    # 1.4.2
    add_styled_paragraph(
        doc,
        "1.4.2 ด้านโครงสร้าง คุณลักษณะเด่น และขนาดรูปร่าง",
        size_pt=16,
        bold=True,
        alignment=WD_ALIGN_PARAGRAPH.LEFT,
        left_indent_cm=0.63,
        space_before_pt=4.0,
        space_after_pt=2.0,
        keep_with_next=True,
    )
    add_styled_paragraph(
        doc,
        "ชุดสิ่งประดิษฐ์ประกอบด้วยกล้องเว็บแคมความละเอียดสูง (Full HD) เชื่อมต่อเครื่องคอมพิวเตอร์ (PC) สำหรับประมวลผล AI จดจำใบหน้า ส่งสัญญาณควบคุมไปยังบอร์ด Arduino/ESP32 และเซอร์โวมอเตอร์พร้อมโมดูลรีเลย์ขับเคลื่อนแขนไม้กั้น บนฐานแบบจำลองขนาดกว้าง 60 เซนติเมตร ยาว 60 เซนติเมตร สูง 10 เซนติเมตร",
        size_pt=16,
        bold=False,
        alignment=WD_ALIGN_PARAGRAPH.LEFT,
        first_line_indent_cm=1.27,
        space_after_pt=4.0,
    )

    # 1.4.3
    add_styled_paragraph(
        doc,
        "1.4.3 ด้านประชากรและกลุ่มตัวอย่าง",
        size_pt=16,
        bold=True,
        alignment=WD_ALIGN_PARAGRAPH.LEFT,
        left_indent_cm=0.63,
        space_before_pt=4.0,
        space_after_pt=2.0,
        keep_with_next=True,
    )
    add_styled_paragraph(
        doc,
        "ประชากรและกลุ่มตัวอย่างที่ใช้ในการประเมินระบบคัดเลือกแบบเจาะจง (Purposive Sampling) ได้แก่ นักศึกษาสาขางานเทคโนโลยีธุรกิจดิจิทัล จำนวน 20 คน และครูผู้สอน จำนวน 2 คน รวมทั้งสิ้น 22 คน วิทยาลัยการอาชีพองครักษ์",
        size_pt=16,
        bold=False,
        alignment=WD_ALIGN_PARAGRAPH.LEFT,
        first_line_indent_cm=1.27,
        space_after_pt=4.0,
    )

    # 1.4.4
    add_styled_paragraph(
        doc,
        "1.4.4 ด้านทฤษฎีและตัวแปรที่ศึกษา",
        size_pt=16,
        bold=True,
        alignment=WD_ALIGN_PARAGRAPH.LEFT,
        left_indent_cm=0.63,
        space_before_pt=4.0,
        space_after_pt=2.0,
        keep_with_next=True,
    )
    add_styled_paragraph(
        doc,
        "ตัวแปรต้น (Independent Variable) ได้แก่ ระบบขออนุญาตออกนอกสถานศึกษาผ่านแชทและสั่งเปิดไม้กั้นด้วยเทคโนโลยี AI จดจำใบหน้า",
        size_pt=16,
        bold=False,
        alignment=WD_ALIGN_PARAGRAPH.LEFT,
        first_line_indent_cm=1.27,
        space_after_pt=2.0,
    )
    add_styled_paragraph(
        doc,
        "ตัวแปรตาม (Dependent Variable) ได้แก่ (1) ประสิทธิภาพการทำงานของระบบ (ความถูกต้องแม่นยำในการจดจำใบหน้าสั่งเปิดไม้กั้น และเวลาที่ใช้ในการอนุมัติคำร้อง) และ (2) ระดับความพึงพอใจของผู้ใช้งาน ดังแสดงกรอบแนวคิดในตารางที่ 1.1",
        size_pt=16,
        bold=False,
        alignment=WD_ALIGN_PARAGRAPH.LEFT,
        first_line_indent_cm=1.27,
        space_after_pt=4.0,
    )
    add_conceptual_framework_table(doc)

    # 1.4.5
    add_styled_paragraph(
        doc,
        "1.4.5 ด้านระยะเวลาและสถานที่ดำเนินงาน",
        size_pt=16,
        bold=True,
        alignment=WD_ALIGN_PARAGRAPH.LEFT,
        left_indent_cm=0.63,
        space_before_pt=4.0,
        space_after_pt=2.0,
        keep_with_next=True,
    )
    add_styled_paragraph(
        doc,
        "ดำเนินการในภาคเรียนที่ 2 ปีการศึกษา 2569 ระหว่างเดือนตุลาคม พ.ศ. 2569 ถึงเดือนมกราคม พ.ศ. 2570 ณ สาขางานเทคโนโลยีธุรกิจดิจิทัล สาขาวิชาพาณิชยกรรม วิทยาลัยการอาชีพองครักษ์ โดยมีกำหนดการดำเนินงาน 7 ขั้นตอน ดังแสดงในตารางที่ 1.2",
        size_pt=16,
        bold=False,
        alignment=WD_ALIGN_PARAGRAPH.LEFT,
        first_line_indent_cm=1.27,
        space_after_pt=4.0,
    )
    add_gantt_chart_table(doc)

    # =========================================================================
    # 1.5 นิยามศัพท์เฉพาะ
    # =========================================================================
    add_styled_paragraph(
        doc,
        "1.5 นิยามศัพท์เฉพาะ",
        size_pt=18,
        bold=True,
        alignment=WD_ALIGN_PARAGRAPH.LEFT,
        space_before_pt=10.0,
        space_after_pt=4.0,
        keep_with_next=True,
    )
    definitions = [
        (
            "1.5.1 ระบบขออนุญาตออกนอกสถานศึกษาผ่านแชท",
            "หมายถึง แอปพลิเคชันแชทที่พัฒนาขึ้นเองสำหรับให้นักเรียนนักศึกษายื่นคำร้องขออนุญาตออกนอกสถานศึกษา ส่งต่อไปยังผู้อนุมัติตามลำดับขั้น (ครูรายวิชา ครูที่ปรึกษา หัวหน้าแผนก งานปกครอง และรองผู้อำนวยการฝ่ายกิจการนักเรียนนักศึกษา) แจ้งเตือน ติดตามสถานะ และบันทึกผลลงฐานข้อมูล",
        ),
        (
            "1.5.2 เทคโนโลยี AI จดจำใบหน้า (Face Recognition)",
            "หมายถึง กระบวนการตรวจจับและเปรียบเทียบลักษณะเฉพาะของใบหน้าจากกล้องเว็บแคมบนเครื่องคอมพิวเตอร์กับฐานข้อมูลใบหน้าที่ลงทะเบียนไว้เพื่อยืนยันตัวตน",
        ),
        (
            "1.5.3 ชุดไม้กั้นแบบจำลองอัตโนมัติ",
            "หมายถึง ชุดจำลองแขนกั้นขนาด 60 × 60 × 10 เซนติเมตร ที่ขับเคลื่อนเปิด–ปิดด้วยเซอร์โวมอเตอร์และโมดูลรีเลย์ภายใต้การควบคุมของบอร์ด Arduino/ESP32",
        ),
        (
            "1.5.4 ความพึงพอใจของผู้ใช้งาน",
            "หมายถึง ระดับความรู้สึกและทัศนคติของนักศึกษาและครูผู้สอนที่เป็นกลุ่มตัวอย่างที่มีต่อการใช้งานระบบขออนุญาตออกนอกสถานศึกษาผ่านแชทและสั่งเปิดไม้กั้นด้วยเทคโนโลยี AI จดจำใบหน้า ซึ่งวัดด้วยแบบสอบถามมาตราส่วนประมาณค่า 5 ระดับ",
        ),
    ]
    for term, desc in definitions:
        add_mixed_definition_paragraph(doc, term, desc, left_indent_cm=1.27, space_after_pt=4.0)

    # =========================================================================
    # 1.6 ประโยชน์ที่คาดว่าจะได้รับ
    # =========================================================================
    add_styled_paragraph(
        doc,
        "1.6 ประโยชน์ที่คาดว่าจะได้รับ",
        size_pt=18,
        bold=True,
        alignment=WD_ALIGN_PARAGRAPH.LEFT,
        space_before_pt=10.0,
        space_after_pt=4.0,
        keep_with_next=True,
    )
    benefits = [
        "1.6.1 ลดขั้นตอน ระยะเวลา และการใช้เอกสารกระดาษในการขออนุญาตออกนอกสถานศึกษา",
        "1.6.2 เพิ่มความปลอดภัยและความถูกต้องในการตรวจสอบตัวตนก่อนออกนอกสถานศึกษา ป้องกันการแอบอ้างสิทธิ์ด้วย AI จดจำใบหน้า",
        "1.6.3 ครูผู้สอนและผู้ดูแลระบบสามารถอนุมัติคำขอและตรวจสอบประวัติการออกนอกสถานศึกษาได้สะดวก รวดเร็ว แบบเรียลไทม์",
        "1.6.4 เป็นต้นแบบนวัตกรรมดิจิทัลและปัญญาประดิษฐ์ที่สามารถนำไปพัฒนาต่อยอดใช้งานจริงในสถานศึกษาได้",
    ]
    for b in benefits:
        add_styled_paragraph(
            doc,
            b,
            size_pt=16,
            bold=False,
            alignment=WD_ALIGN_PARAGRAPH.LEFT,
            left_indent_cm=2.27,
            hanging_indent_cm=1.0,
            space_after_pt=3.0,
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(output_path))
    return output_path


if __name__ == "__main__":
    out_file = Path(r"c:\Users\com\Desktop\GSF\docs\บทที่_1_บทนำ.docx")
    saved = build_chapter1(out_file)
    print(f"Generated successfully: {saved} ({saved.stat().st_size} bytes)")
