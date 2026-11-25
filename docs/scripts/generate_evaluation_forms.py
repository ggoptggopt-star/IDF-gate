#!/usr/bin/env python3
"""
generate_evaluation_forms.py
สร้างเอกสาร Word (.docx) แบบบันทึกผลการทดสอบประสิทธิภาพและแบบสอบถามความพึงพอใจ 5 ระดับ
สำหรับแจกกลุ่มตัวอย่าง 22 คน (นักศึกษา 20 คน, ครูผู้สอน 2 คน) เพื่อรวบรวมข้อมูลบทที่ 4
โครงงาน: ระบบขออนุญาตออกนอกสถานศึกษาผ่านแชทและสั่งเปิดไม้กั้นอัตโนมัติด้วยเทคโนโลยีปัญญาประดิษฐ์จดจำใบหน้า
สถานศึกษา: วิทยาลัยการอาชีพองครักษ์ (OICEC)
"""

import sys
from pathlib import Path

from docx.enum.table import WD_ALIGN_VERTICAL, WD_TABLE_ALIGNMENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.shared import Pt

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))
from generate_chapter1 import (  # noqa: E402
    add_styled_paragraph,
    prevent_row_split,
    set_cell_borders,
    set_cell_margins,
    set_cell_shading,
    set_cell_text,
    set_fixed_table_widths,
    set_repeat_table_header,
)
from generate_chapter2 import add_body_paragraph, add_section_heading, add_styled_table  # noqa: E402
from generate_chapter3 import configure_document  # noqa: E402


def add_likert_questionnaire_table(doc) -> None:
    """สร้างตารางแบบสอบถามความพึงพอใจ 5 ระดับ ครบ 3 ด้าน 12 ข้อพร้อมแถวหัวข้อแต่ละด้าน"""
    col_widths_cm = [1.35, 8.80, 0.90, 0.90, 0.90, 0.90, 0.90]  # รวม 14.65 ซม.
    headers = ["ข้อที่", "รายการประเมินความพึงพอใจ", "5", "4", "3", "2", "1"]

    sections = [
        (
            "ด้านที่ 1 ด้านการออกแบบและง่ายต่อการใช้งาน",
            [
                ("1", "ความสวยงามและความเป็นระเบียบของหน้าจอเว็บแอปพลิเคชัน (PWA)"),
                ("2", "ความสะดวกในการพิมพ์แชทขออนุญาตกับ AI (ระบบซักถามอัตโนมัติ)"),
                ("3", "ความเข้าใจง่ายของขั้นตอนการติดตามสถานะการอนุมัติ 5 ขั้นตอน"),
                ("4", "ความชัดเจนในการขอความยินยอม PDPA และการกดเช็คอินพิกัด GPS"),
            ],
        ),
        (
            "ด้านที่ 2 ด้านประสิทธิภาพและความถูกต้องแม่นยำ",
            [
                ("5", "ความถูกต้องของการเชื่อมโยงตารางเรียนและสายผู้อนุมัติ 5 ขั้นอัตโนมัติ"),
                ("6", "ความรวดเร็วในการยื่นคำร้องและพิจารณาอนุมัติเมื่อเทียบกับแบบกระดาษเดิม"),
                ("7", "ความแม่นยำและความรวดเร็วในการสแกนใบหน้าผ่านเว็บแคมเพื่อเปิดไม้กั้น"),
                ("8", "ความถูกต้องของการสั่งเปิด–ปิดแขนไม้กั้นและการแสดงผลบนจอ LCD และไฟ LED"),
            ],
        ),
        (
            "ด้านที่ 3 ด้านความปลอดภัยและการนำไปใช้งานจริง",
            [
                ("9", "ความปลอดภัยของเซนเซอร์อัลตราโซนิก HC-SR04 ในการป้องกันไม้กั้นปิดตี"),
                ("10", "ความสามารถในการป้องกันการแอบอ้างสิทธิ์หรือการออกนอกสถานที่โดยไม่ได้รับอนุญาต"),
                ("11", "ความคุ้มค่าในการบันทึกหลักฐานภาพถ่าย พิกัด และประวัติการเข้า–ออกย้อนหลัง"),
                ("12", "ความเหมาะสมในการนำไปประยุกต์ใช้งานจริงในวิทยาลัยการอาชีพองครักษ์"),
            ],
        ),
    ]

    total_rows = 1 + sum(1 + len(items) for _, items in sections)
    table = doc.add_table(rows=total_rows, cols=7)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    set_fixed_table_widths(table, col_widths_cm)

    # แถวหัวตาราง
    header_row = table.rows[0]
    prevent_row_split(header_row)
    set_repeat_table_header(header_row)
    for c_idx, title in enumerate(headers):
        cell = header_row.cells[c_idx]
        set_cell_borders(cell, top=True, bottom=True, left=True, right=True, sz="4")
        set_cell_shading(cell, "E8EEF7")
        set_cell_margins(cell, top=60, bottom=60, left=60, right=60)
        set_cell_text(cell, title, size_pt=16, bold=True, alignment=WD_ALIGN_PARAGRAPH.CENTER)

    row_cursor = 1
    for sec_title, items in sections:
        # แถวหัวข้อด้านที่ประเมิน (ผสาน 7 คอลัมน์)
        sec_row = table.rows[row_cursor]
        prevent_row_split(sec_row)
        merged = sec_row.cells[0].merge(sec_row.cells[6])
        set_cell_borders(merged, top=True, bottom=True, left=True, right=True, sz="4")
        set_cell_shading(merged, "F3F6FB")
        set_cell_margins(merged, top=55, bottom=55, left=90, right=90)
        set_cell_text(merged, sec_title, size_pt=16, bold=True, alignment=WD_ALIGN_PARAGRAPH.LEFT)
        row_cursor += 1

        # แถวข้อคำถาม
        for item_no, item_text in items:
            q_row = table.rows[row_cursor]
            prevent_row_split(q_row)
            vals = [item_no, item_text, "☐", "☐", "☐", "☐", "☐"]
            aligns = [
                WD_ALIGN_PARAGRAPH.CENTER,
                WD_ALIGN_PARAGRAPH.LEFT,
                WD_ALIGN_PARAGRAPH.CENTER,
                WD_ALIGN_PARAGRAPH.CENTER,
                WD_ALIGN_PARAGRAPH.CENTER,
                WD_ALIGN_PARAGRAPH.CENTER,
                WD_ALIGN_PARAGRAPH.CENTER,
            ]
            for c_idx, val in enumerate(vals):
                cell = q_row.cells[c_idx]
                cell.vertical_alignment = WD_ALIGN_VERTICAL.CENTER
                set_cell_borders(cell, top=True, bottom=True, left=True, right=True, sz="4")
                set_cell_margins(cell, top=50, bottom=50, left=60, right=60)
                set_cell_text(cell, val, size_pt=16, bold=False, alignment=aligns[c_idx])
            row_cursor += 1

    add_styled_paragraph(doc, "", size_pt=16, space_after_pt=4.0)


def build_evaluation_forms(output_path: Path) -> Path:
    """สร้างไฟล์ Word รวมแบบบันทึกทดสอบประสิทธิภาพและแบบสอบถามความพึงพอใจ"""
    doc = configure_document()

    # =========================================================================
    # ส่วนที่ 1: แบบบันทึกผลการทดสอบประสิทธิภาพการทำงานของระบบ (สำหรับผู้จัดทำ)
    # =========================================================================
    add_styled_paragraph(
        doc,
        "แบบบันทึกผลการทดสอบประสิทธิภาพของระบบ",
        size_pt=20,
        bold=True,
        alignment=WD_ALIGN_PARAGRAPH.CENTER,
        space_before_pt=0.0,
        space_after_pt=2.0,
        keep_with_next=True,
    )
    add_styled_paragraph(
        doc,
        "โครงงานเรื่อง ระบบขออนุญาตออกนอกสถานศึกษาผ่านแชทและสั่งเปิดไม้กั้นอัตโนมัติด้วยเทคโนโลยีปัญญาประดิษฐ์จดจำใบหน้า",
        size_pt=16,
        bold=True,
        alignment=WD_ALIGN_PARAGRAPH.CENTER,
        space_before_pt=0.0,
        space_after_pt=2.0,
        keep_with_next=True,
    )
    add_styled_paragraph(
        doc,
        "วิทยาลัยการอาชีพองครักษ์ • แผนกวิชาเทคโนโลยีธุรกิจดิจิทัล",
        size_pt=16,
        bold=False,
        alignment=WD_ALIGN_PARAGRAPH.CENTER,
        space_before_pt=0.0,
        space_after_pt=10.0,
    )

    add_styled_paragraph(
        doc,
        "คำชี้แจง: ใช้บันทึกผลการทดสอบการทำงานจริงของระบบเว็บแอปพลิเคชัน Smart Gate Pass AI และชุดจำลองไม้กั้น ESP32 เพื่อนำตัวเลขไปสรุปผลในบทที่ 4",
        size_pt=16,
        bold=False,
        alignment=WD_ALIGN_PARAGRAPH.LEFT,
        space_after_pt=6.0,
    )

    add_section_heading(doc, "ตอนที่ 1 แบบบันทึกการทดสอบฟังก์ชันการทำงานของระบบ (Test Cases)", first=True)
    add_styled_table(
        doc,
        caption="ตารางบันทึกผลการทดสอบการทำงานตามกรณีทดสอบหลัก (TC-01 ถึง TC-10)",
        headers=["รหัส", "รายการทดสอบ", "ผลลัพธ์ที่คาดหวัง", "ผ่าน", "ไม่ผ่าน", "หมายเหตุ"],
        rows_data=[
            ["TC-01", "ลงทะเบียนใบหน้าและกดยินยอม PDPA", "บันทึกใบหน้าและเวลายินยอมสำเร็จ", "☐", "☐", ""],
            ["TC-02", "AI แชทบอทถามข้อมูลแบบ Slot-Filling", "ถามสถานที่ เหตุผล เวลา จนครบก่อนส่ง", "☐", "☐", ""],
            ["TC-03", "แนบเอกสาร/รูปแชท หรือตอบไม่มีเอกสาร", "แนบไฟล์ได้ และตอบ 'ไม่มี' เพื่อข้ามได้", "☐", "☐", ""],
            ["TC-04", "ผูกตารางเรียนจริงและอนุมัติครบ 5 ขั้น", "ดึงครูรายวิชาตรงตารางและส่งต่อครบ 5 ขั้น", "☐", "☐", ""],
            ["TC-05", "สแกนใบหน้าผู้มีสิทธิ์ผ่านกล้องเว็บแคม", "ไม้กั้นยก 90° ไฟเขียวติด LCD แสดงชื่อ", "☐", "☐", ""],
            ["TC-06", "สแกนใบหน้าผู้ไม่มีสิทธิ์ / หมดเวลา", "ปฏิเสธการผ่าน ไม้กั้นไม่เปิด บัซเซอร์เตือน", "☐", "☐", ""],
            ["TC-07", "กดเช็คอินพิกัด GPS ถึงจุดหมายปลายทาง", "คำนวณระยะห่างและแสดงบน Google Maps ได้", "☐", "☐", ""],
            ["TC-08", "กดรายงานตัวกลับและสแกนใบหน้าขาเข้า", "เช็ครัศมีวิทยาลัยและปิดสถานะคำร้องสำเร็จ", "☐", "☐", ""],
            ["TC-09", "เซนเซอร์ HC-SR04 ป้องกันไม้กั้นปิดตี", "พบวัตถุใต้ไม้กั้น แขนกั้นค้างไม่พับลง", "☐", "☐", ""],
            ["TC-10", "หน้าตรวจดูฐานข้อมูล 9 ตารางและส่งออก CSV", "แสดงข้อมูลครบและส่งออกไฟล์ CSV สำเร็จ", "☐", "☐", ""],
        ],
        col_widths_cm=[1.55, 4.10, 4.20, 1.25, 1.35, 2.20],
        col_alignments=[
            WD_ALIGN_PARAGRAPH.CENTER,
            WD_ALIGN_PARAGRAPH.LEFT,
            WD_ALIGN_PARAGRAPH.LEFT,
            WD_ALIGN_PARAGRAPH.CENTER,
            WD_ALIGN_PARAGRAPH.CENTER,
            WD_ALIGN_PARAGRAPH.LEFT,
        ],
    )

    add_section_heading(doc, "ตอนที่ 2 แบบบันทึกผลการทดสอบความแม่นยำและความเร็วในการสแกนเปิดไม้กั้น")
    trial_rows = [
        [str(i), "", "☐ มีสิทธิ์   ☐ ไม่มีสิทธิ์", "", "☐ เปิด   ☐ ไม่เปิด", "☐ ถูกต้อง   ☐ พลาด"]
        for i in range(1, 11)
    ]
    add_styled_table(
        doc,
        caption="ตารางบันทึกผลการทดลองสแกนใบหน้าผ่านกล้องเว็บแคม (บันทึกเวลาประมวลผลและความถูกต้อง)",
        headers=["ครั้งที่", "ชื่อ–สกุลผู้ทดสอบ", "เงื่อนไขคำร้อง", "เวลา (วินาที)", "สถานะไม้กั้น", "ความถูกต้อง"],
        rows_data=trial_rows,
        col_widths_cm=[1.30, 3.60, 3.25, 2.20, 2.30, 2.00],
        col_alignments=[
            WD_ALIGN_PARAGRAPH.CENTER,
            WD_ALIGN_PARAGRAPH.LEFT,
            WD_ALIGN_PARAGRAPH.CENTER,
            WD_ALIGN_PARAGRAPH.CENTER,
            WD_ALIGN_PARAGRAPH.CENTER,
            WD_ALIGN_PARAGRAPH.CENTER,
        ],
    )

    # =========================================================================
    # ส่วนที่ 2: แบบสอบถามความพึงพอใจของผู้ใช้งาน (ขึ้นหน้าใหม่เพื่อแยกพิมพ์แจกได้)
    # =========================================================================
    doc.add_page_break()

    add_styled_paragraph(
        doc,
        "แบบสอบถามความพึงพอใจของผู้ใช้งานระบบ",
        size_pt=20,
        bold=True,
        alignment=WD_ALIGN_PARAGRAPH.CENTER,
        space_before_pt=0.0,
        space_after_pt=2.0,
        keep_with_next=True,
    )
    add_styled_paragraph(
        doc,
        "เรื่อง ระบบขออนุญาตออกนอกสถานศึกษาผ่านแชทและสั่งเปิดไม้กั้นอัตโนมัติด้วยเทคโนโลยีปัญญาประดิษฐ์จดจำใบหน้า",
        size_pt=16,
        bold=True,
        alignment=WD_ALIGN_PARAGRAPH.CENTER,
        space_before_pt=0.0,
        space_after_pt=2.0,
        keep_with_next=True,
    )
    add_styled_paragraph(
        doc,
        "วิทยาลัยการอาชีพองครักษ์ • กลุ่มตัวอย่างจำนวน 22 คน (นักศึกษา 20 คน, ครูผู้สอน 2 คน)",
        size_pt=16,
        bold=False,
        alignment=WD_ALIGN_PARAGRAPH.CENTER,
        space_before_pt=0.0,
        space_after_pt=8.0,
    )

    add_section_heading(doc, "ตอนที่ 1 ข้อมูลทั่วไปของผู้ตอบแบบสอบถาม", first=True)
    add_styled_paragraph(
        doc,
        "คำชี้แจง: กรุณาทำเครื่องหมาย ✓ ลงในช่อง ☐ ที่ตรงกับความเป็นจริงเกี่ยวกับตัวท่าน",
        size_pt=16,
        bold=False,
        alignment=WD_ALIGN_PARAGRAPH.LEFT,
        space_after_pt=4.0,
    )
    add_styled_paragraph(
        doc,
        "1. สถานภาพของผู้ตอบแบบสอบถาม:    ☐ นักศึกษา (แผนกวิชาเทคโนโลยีธุรกิจดิจิทัล)    ☐ ครูผู้สอน / ผู้บริหาร",
        size_pt=16,
        bold=False,
        left_indent_cm=0.63,
        space_after_pt=4.0,
    )
    add_styled_paragraph(
        doc,
        "2. ระดับชั้น (เฉพาะนักศึกษา):    ☐ ปวช.1    ☐ ปวช.2    ☐ ปวช.3    ☐ ปวส.1    ☐ ปวส.2",
        size_pt=16,
        bold=False,
        left_indent_cm=0.63,
        space_after_pt=8.0,
    )

    add_section_heading(doc, "ตอนที่ 2 แบบประเมินความพึงพอใจที่มีต่อการใช้งานระบบ")
    add_body_paragraph(
        doc,
        "คำชี้แจง: โปรดทำเครื่องหมาย ✓ ลงในช่องระดับคะแนนที่ตรงกับความพึงพอใจของท่านมากที่สุด โดยกำหนดเกณฑ์คะแนน 5 ระดับ ดังนี้  5 = มากที่สุด   4 = มาก   3 = ปานกลาง   2 = น้อย   1 = น้อยที่สุด",
        space_after_pt=6.0,
    )
    add_likert_questionnaire_table(doc)

    add_section_heading(doc, "ตอนที่ 3 ข้อเสนอแนะเพิ่มเติม")
    for _ in range(3):
        add_styled_paragraph(
            doc,
            "..................................................................................................................................................................................",
            size_pt=16,
            bold=False,
            alignment=WD_ALIGN_PARAGRAPH.LEFT,
            space_after_pt=4.0,
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    doc.save(str(output_path))
    return output_path


if __name__ == "__main__":
    out_file = Path(r"c:\Users\com\Desktop\GSF\docs\แบบบันทึกทดสอบประสิทธิภาพและแบบสอบถามความพึงพอใจ.docx")
    saved = build_evaluation_forms(out_file)
    print(f"Generated successfully: {saved} ({saved.stat().st_size} bytes)")
