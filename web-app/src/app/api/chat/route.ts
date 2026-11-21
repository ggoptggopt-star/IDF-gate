import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute } from '@/lib/db';
import { LeaveRequest } from '@/types';
import { GoogleGenAI } from '@google/genai';
import { sendPushToUsers } from '@/lib/webPushServer';

export interface ChatSlots {
  leave_date?: string | null;
  leave_date_text?: string | null;
  destination_name?: string | null;
  destination_lat?: number | null;
  destination_lng?: number | null;
  category?: 'medical' | 'personal' | 'department' | 'parent_pickup' | null;
  reason?: string | null;
  allowed_start_time?: string | null;
  allowed_end_time?: string | null;
  attachment_path?: string | null;
  attachment_prompted?: boolean;
  is_return_required?: number;
}

const SYSTEM_INSTRUCTION = `
คุณคือ "น้องเกต (Smart Gate Pass AI)" ผู้ช่วยปัญญาประดิษฐ์อัจฉริยะประจำวิทยาลัยการอาชีพองครักษ์ (OICEC)
บุคลิก: ฉลาด สุภาพ นอบน้อม ชัดเจน อบอุ่น เป็นมิตร และให้เกียรตินักศึกษาและบุคลากร (ลงท้าย "ครับ")

ขอบเขตความรู้และหน้าที่สำคัญของน้องเกต AI:
1. การตอบคำถามทั่วไป วันที่ เวลา ข้อมูลวิทยาลัย และระบบเว็บ (intent: "question"):
   - เมื่อนักศึกษาถามเรื่องเวลา เช่น "กี่โมงแล้ว", "เวลากี่โมงละตอนนี้", "เวลาปัจจุบัน" ให้ตอบเวลาปัจจุบันจริงตามข้อมูลที่ระบุใน Prompt ให้ถูกต้องแม่นยำ
   - เมื่อถามเรื่องวัน เช่น "วันนี้วันอะไร", "วันที่เท่าไหร่", "วันนี้วันที่" ให้ตอบวันและวันที่ปัจจุบันจริงอย่างชัดเจน
   - เมื่อถามเกี่ยวกับวิทยาลัยการอาชีพองครักษ์ (OICEC), แผนกวิชาพาณิชยกรรม, สาขางานเทคโนโลยีธุรกิจดิจิทัล ให้ตอบข้อมูลวิทยาลัยได้อย่างถูกต้อง
   - เมื่อถามเกี่ยวกับระบบเว็บ Smart Gate Pass AI เช่น:
     * สายพานพิจารณา 5 ขั้นตอน (1.ครูผู้สอนประจำวิชา -> 2.ครูที่ปรึกษา -> 3.หัวหน้าแผนก ทธด. -> 4.งานปกครอง -> 5.รองผู้อำนวยการ)
     * ไม้กั้นสแกนใบหน้า AI Gate (กล้องตรวจจับ 468 จุด ทั้งขาออกและขากลับ)
     * การเช็คอินพิกัด GPS ถึงจุดหมาย (Destination Check-in)
     * โหมดติดตามการเดินทางเรียลไทม์ (Live Trip Mode)
     * การแจ้งเตือน Web Push แม้ปิดหน้าจอ
     * ให้อธิบายฟังก์ชันการทำงานอย่างถูกต้องเข้าใจง่าย
   - *** กฎเหล็กสำคัญที่สุด ***: เมื่อนักศึกษาถามคำถามทั่วไปในกลุ่มนี้ ให้ตอบคำถามนั้นตรงๆ ให้เสร็จสิ้นอย่างสุภาพและเป็นธรรมชาติ ห้ามตื๊อหรือถามดึงวกเข้าเรื่อง "ต้องการขออนุญาตออกนอกสถานศึกษาใช่ไหมครับ" โดยเด็ดขาด! (ตอบคำถามที่ผู้ใช้ถาม ไม่ยัดเยียดชวนขออนุญาต)

2. การตอบคำถามเรื่องตารางเวลาเรียน และเวลาที่สามารถขอออก-กลับได้ (intent: "question"):
   - เมื่อนักศึกษาถามเกี่ยวกับเวลาออก-กลับ เช่น "ขอออกและกลับได้เวลาไหนบ้าง", "ออกได้ตอนไหน", "มีเวลาไหนบ้าง", "ตารางเรียนมีเวลาอะไรบ้าง", "8:00 ถึงกี่โมง", "ตารางเวลา":
   - ให้ตอบแจกแจงตามช่วงเวลาของวิทยาลัย และตารางเรียนของกลุ่ม ปวส.2/1 อย่างชัดเจน:
     * คาบเช้า: 08:00 - 12:00 น.
     * พักกลางวัน: 12:00 - 13:00 น. (ช่วงเวลามาตรฐานที่นักศึกษานิยมยื่นขอออกไปทานอาหาร/ทำธุระ และกลับก่อน 13:00 น.)
     * คาบบ่าย: 13:00 - 17:00 น.
     * เลิกเรียน: 17:00 น. (หลัง 17:00 น. เดินทางกลับบ้านได้ตามปกติโดยไม่ต้องขอใบอนุญาต)
   - ตารางเรียนกลุ่ม ปวส.2/1 (เทคโนโลยีธุรกิจดิจิทัล):
     * วันอังคาร 08:00 - 12:00 น.: วิชา เทคโนโลยีความจริงเสริม (ครูธนพิสิษฐ์ ทาพา)
     * วันพุธ 08:00 - 12:00 น.: วิชา การวิเคราะห์ข้อมูล (ครูอรรถเมธ ตะโกนา)
     * วันพฤหัสบดี 13:00 - 17:00 น.: วิชา การบำรุงรักษาคอมพิวเตอร์และอุปกรณ์พกพา (ครูพัฒนา กลมพันธ์)
     * วันศุกร์ 13:00 - 17:00 น.: วิชา การผลิตสื่อมัลติมีเดียสำหรับธุรกิจดิจิทัล (ครูอรุณี สุนทรมณี)
   - สรุปช่วงเวลาที่ขอออกได้:
     1) ช่วงพักกลางวัน 12:00 - 13:00 น. (กลับก่อนคาบบ่าย)
     2) ช่วงเวลาว่างที่ไม่มีเรียน หรือมีธุระจำเป็น/พบแพทย์ (เช่น ออก 12:00 น. กลับ 14:00 หรือ 15:00 น. หรือขอออกแล้วไม่กลับบ้านเลย)
     3) หลัง 17:00 น. เป็นเวลาเลิกเรียน
   - ห้ามตื๊อหรือถามดึงวกเข้าเรื่อง "ต้องการขออนุญาตออกนอกสถานศึกษาใช่ไหมครับ"

3. การรับเรื่องขออนุญาตออกนอกสถานศึกษา (intent: "leave_request"):
   - จะทำงานเมื่อผู้ใช้มีเจตนาต้องการขอออกนอกสถานศึกษา (เช่น "ขอไป...", "จะออกไป...", "ขอออกตอนเที่ยง", "ไปหาหมอ", "ขอกลับบ้าน", "ขออนุญาต...")
   - รวบรวมข้อมูลแบบ Slot-Filling:
     1. วันที่ (leave_date)
     2. สถานที่ปลายทาง (destination_name)
     3. หมวดหมู่ & เหตุผล (category & reason: medical, personal, department, parent_pickup)
     4. เวลาออก (allowed_start_time)
     5. เวลากลับ (allowed_end_time): กฎเหล็ก: ห้ามเดาเวลากลับเองเด็ดขาด ถ้าผู้ใช้บอกเฉพาะเวลาออก ให้ถามเวลากลับเสมอ เว้นแต่ระบุว่า "ไม่กลับ" / "กลับบ้านเลย" / "ออกยาว" ให้บันทึก allowed_end_time = 'ไม่กลับ' และ is_return_required = 0
     6. เอกสารแนบ (attachment_path): ถามเมื่อได้ข้อมูลครบทุกช่องแล้ว

4. การทักทาย (intent: "greeting"):
   - เช่น "สวัสดี", "ดีครับ", "หวัดดี" ให้ทักทายอย่างเป็นมิตร แนะนำตัวว่าน้องเกต AI พร้อมช่วยเหลือ ทั้งตอบคำถามและรับเรื่องขออนุญาต

ความสามารถในการเข้าใจภาษาพูดภาษาไทยและการสะกดคำ (Colloquial & Typos):
- "ตอนเทียง", "ตอนเที่ยง", "เที่ยง", "เทียง", "พักเที่ยง" -> เวลาออก 12:00 น. (ต้องถามเวลากลับด้วย!)
- "เที่ยงครึ่ง", "เทียงครึ่ง" -> เวลาออก 12:30 น. (ต้องถามเวลากลับด้วย!)
- "ตอนบ่าย", "บ่ายนี้", "บ่ายโมง" -> เวลาออก 13:00 น. (ต้องถามเวลากลับด้วย!)
- "บ่ายสอง" -> 14:00 น., "บ่ายสาม" -> 15:00 น.
- "วันนี้", "วันนี" -> กำหนด leave_date เป็นวันที่ปัจจุบัน (YYYY-MM-DD)
- "พรุ่งนี้", "พรุงนี้", "พรุ่งนี" -> กำหนด leave_date เป็นวันพรุ่งนี้

กติกาการตอบ JSON:
{
  "intent": "greeting" | "question" | "leave_request",
  "replyMessage": "ข้อความตอบกลับภาษาไทยอย่างสุภาพ เป็นธรรมชาติ ตรงประเด็น (ถ้าเป็นคำถามทั่วไปให้ตอบคำถามนั้นตรงๆ ห้ามยัดเยียดชวนขอออกนอกวิทยาลัย)",
  "slots": {
    "leave_date": string or null,
    "leave_date_text": string or null,
    "destination_name": string or null,
    "destination_lat": number or null,
    "destination_lng": number or null,
    "category": "medical" | "personal" | "department" | "parent_pickup" | null,
    "reason": string or null,
    "allowed_start_time": string or null,
    "allowed_end_time": string or null,
    "attachment_path": string or null
  },
  "missing_slots": ["date" | "destination" | "reason" | "start_time" | "return_time" | "attachment"],
  "ask_attachment_now": boolean,
  "is_complete": boolean
}
`;

interface ParsedTimeResult {
  start?: string | null;
  end?: string | null;
  desc?: string;
  noReturn?: boolean;
}

// Helper: Parse Thai Time (Never guess return time if only departure time is given!)
function parseThaiTime(text: string, currentStart?: string | null): ParsedTimeResult | null {
  const t = text.replace(/\s+/g, ' ');

  // 0. Explicit No-Return Detection
  if (/(ไม่กลับ|ไม่ต้องกลับ|ไม่เข้าแล้ว|ไม่เข้ามาแล้ว|กลับบ้านเลย|ออกยาว|ไม่กลับโว้ย|ไม่กลับครับ|ไม่กลับค่ะ|ไม่กลับจ้า|ไม่ย้อนกลับ|ไม่เข้าวิทยาลัย)/i.test(t)) {
    return {
      end: 'ไม่กลับ',
      desc: 'ไม่เดินทางกลับเข้าวิทยาลัย (ออกยาว)',
      noReturn: true,
    };
  }

  // 1. Full Range: "12:30 - 15:30" or "12.30 - 15.30" or "12:30 ถึง 15:30"
  const rangeMatch = t.match(/(\d{1,2}[:.]\d{2})\s*(?:-|ถึง)\s*(\d{1,2}[:.]\d{2})/);
  if (rangeMatch) {
    return {
      start: rangeMatch[1].replace('.', ':').padStart(5, '0'),
      end: rangeMatch[2].replace('.', ':').padStart(5, '0'),
      desc: `${rangeMatch[1]} - ${rangeMatch[2]} น.`,
    };
  }

  // 2. Full Range with words: "เที่ยง...ถึง...บ่ายสอง/บ่ายสาม"
  const wordRangeMatch = t.match(/(เที่ยง|เทียง|บ่ายโมง|บ่าย\s*1|\d{1,2}[:.]\d{2})\s*(?:ถึง|-|จนถึง)\s*(บ่ายโมง|บ่ายสอง|บ่ายสาม|บ่ายสี่|สี่โมงเย็น|\d{1,2}[:.]\d{2})/);
  if (wordRangeMatch) {
    const sStr = wordRangeMatch[1];
    const eStr = wordRangeMatch[2];
    let s = '12:00';
    if (/บ่ายโมง|บ่าย\s*1/.test(sStr)) s = '13:00';
    else if (/\d{1,2}[:.]\d{2}/.test(sStr)) s = sStr.replace('.', ':').padStart(5, '0');

    let e = '15:30';
    if (/บ่ายสอง/.test(eStr)) e = '14:00';
    else if (/บ่ายสาม/.test(eStr)) e = '15:00';
    else if (/บ่ายสี่|สี่โมง/.test(eStr)) e = '16:00';
    else if (/\d{1,2}[:.]\d{2}/.test(eStr)) e = eStr.replace('.', ':').padStart(5, '0');

    return { start: s, end: e, desc: `${s} - ${e} น.` };
  }

  // 3. Return Time specified explicitly: e.g. "กลับ 15:30", "กลับบ่ายสาม", "กลับตอนบ่ายสอง", "ถึง 15:00"
  const returnMatch = t.match(/(?:กลับ|ถึงวิทยาลัย|เข้าวิลัย|เข้าวิทยาลัย|กลับมา)(?:\s*(?:ประมาณ|ตอน|เวลา))?\s*(\d{1,2}[:.]\d{2}|บ่ายโมง|บ่ายสอง|บ่ายสาม|บ่ายสี่|สี่โมงเย็น|เที่ยงครึ่ง|เทียงครึ่ง|เที่ยง|เทียง)/);
  if (returnMatch) {
    const r = returnMatch[1];
    let end = '15:30';
    if (/บ่ายสอง/.test(r)) end = '14:00';
    else if (/บ่ายสาม/.test(r)) end = '15:00';
    else if (/บ่ายสี่|สี่โมง/.test(r)) end = '16:00';
    else if (/บ่ายโมง/.test(r)) end = '13:00';
    else if (/ครึ่ง/.test(r)) end = '12:30';
    else if (/เที่ยง|เทียง/.test(r)) end = '12:00';
    else if (/\d{1,2}[:.]\d{2}/.test(r)) end = r.replace('.', ':').padStart(5, '0');

    return { end, desc: `กลับเวลา ${end} น.` };
  }

  // 4. If currentStart already exists, and user answers with a time: "บ่ายสาม", "15:00", "บ่ายสอง"
  if (currentStart) {
    if (/\d{1,2}[:.]\d{2}/.test(t)) {
      const m = t.match(/(\d{1,2}[:.]\d{2})/);
      if (m) {
        const end = m[1].replace('.', ':').padStart(5, '0');
        return { end, desc: `กลับเวลา ${end} น.` };
      }
    }
    if (/บ่ายสาม/.test(t)) return { end: '15:00', desc: 'กลับบ่ายสาม (15:00 น.)' };
    if (/บ่ายสอง/.test(t)) return { end: '14:00', desc: 'กลับบ่ายสอง (14:00 น.)' };
    if (/บ่ายสี่|สี่โมง/.test(t)) return { end: '16:00', desc: 'กลับสี่โมงเย็น (16:00 น.)' };
    if (/บ่ายโมง/.test(t)) return { end: '13:00', desc: 'กลับบ่ายโมง (13:00 น.)' };
    if (/เที่ยงครึ่ง|เทียงครึ่ง/.test(t)) return { end: '12:30', desc: 'กลับเที่ยงครึ่ง (12:30 น.)' };
  }

  // 5. Departure Time ONLY (DO NOT INVENT RETURN TIME!)
  if (/(ตอนเทียง|ตอนเที่ยง|เที่ยงนี้|เทียงนี้|พักเที่ยง|พักเทียง|เวลาเที่ยง|เวลาเทียง|เทียง|เที่ยง)/.test(t)) {
    if (/ครึ่ง/.test(t)) return { start: '12:30', end: null, desc: 'ออกเวลาเที่ยงครึ่ง (12:30 น.)' };
    return { start: '12:00', end: null, desc: 'ออกเวลาตอนเที่ยง (12:00 น.)' };
  }

  if (/(ตอนบ่าย|บ่ายนี้|ช่วงบ่าย|บ่ายโมง)/.test(t)) {
    return { start: '13:00', end: null, desc: 'ออกเวลาช่วงบ่าย (13:00 น.)' };
  }

  if (/บ่ายสอง/.test(t)) {
    return { start: '14:00', end: null, desc: 'ออกเวลาบ่ายสอง (14:00 น.)' };
  }

  if (/(ตอนเช้า|เช้านี้|ช่วงเช้า)/.test(t)) {
    return { start: '08:30', end: null, desc: 'ออกเวลาช่วงเช้า (08:30 น.)' };
  }

  const singleNumMatch = t.match(/(?:ออก|เวลา|ตอน)?\s*(\d{1,2}[:.]\d{2})/);
  if (singleNumMatch) {
    const start = singleNumMatch[1].replace('.', ':').padStart(5, '0');
    return { start, end: null, desc: `ออกเวลา ${start} น.` };
  }

  return null;
}

// Helper: Parse Thai Dates (วันนี้ / พรุ่งนี้ / มะรืนนี้)
function parseThaiDate(text: string, baseDate = new Date()): { dateStr: string; text: string } | null {
  const t = text.toLowerCase();
  const y = baseDate.getFullYear();
  const m = String(baseDate.getMonth() + 1).padStart(2, '0');
  const d = String(baseDate.getDate()).padStart(2, '0');
  const todayStr = `${y}-${m}-${d}`;

  if (/(วันนี|วันนี้|วันนี่|วันนั้)/.test(t)) {
    return { dateStr: todayStr, text: 'วันนี้' };
  }
  if (/(พรุ่งนี|พรุงนี้|พรุ่งนี้|วันพรุ่ง)/.test(t)) {
    const tm = new Date(baseDate.getTime() + 86400000);
    const tmStr = `${tm.getFullYear()}-${String(tm.getMonth() + 1).padStart(2, '0')}-${String(tm.getDate()).padStart(2, '0')}`;
    return { dateStr: tmStr, text: 'พรุ่งนี้' };
  }
  if (/มะรืน/.test(t)) {
    const day2 = new Date(baseDate.getTime() + 86400000 * 2);
    const day2Str = `${day2.getFullYear()}-${String(day2.getMonth() + 1).padStart(2, '0')}-${String(day2.getDate()).padStart(2, '0')}`;
    return { dateStr: day2Str, text: 'มะรืนนี้' };
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      message = '',
      currentSlots = {} as ChatSlots,
      attachment_url = null,
      skip_attachment = false,
      student_id = 'user-stu-akkaracha',
      apiKey,
    } = body;

    const text = message.trim();
    if (!text && !attachment_url && !skip_attachment) {
      return NextResponse.json({ success: false, error: 'กรุณากรอกข้อความหรือแนบไฟล์' }, { status: 400 });
    }

    const activeApiKey = apiKey?.trim() || process.env.GEMINI_API_KEY;

    // Accurate current Thai time & date
    const now = new Date();
    const thaiFormatter = new Intl.DateTimeFormat('th-TH', {
      timeZone: 'Asia/Bangkok',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const currentThaiDateTimeFull = thaiFormatter.format(now);
    const currentTimeOnly = now.toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false });

    // Bangkok ISO date string YYYY-MM-DD
    const bangkokDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);
    const todayDefault = bangkokDateStr;

    // Working slots merged with current slots
    const slots: ChatSlots = {
      leave_date: currentSlots.leave_date || null,
      leave_date_text: currentSlots.leave_date_text || null,
      destination_name: currentSlots.destination_name || null,
      destination_lat: currentSlots.destination_lat || null,
      destination_lng: currentSlots.destination_lng || null,
      category: currentSlots.category || null,
      reason: currentSlots.reason || null,
      allowed_start_time: currentSlots.allowed_start_time || null,
      allowed_end_time: currentSlots.allowed_end_time || null,
      attachment_path: attachment_url || currentSlots.attachment_path || null,
      attachment_prompted: currentSlots.attachment_prompted || false,
    };

    let aiResult: {
      intent: 'greeting' | 'question' | 'leave_request';
      replyMessage: string;
      slots: ChatSlots;
      missing_slots: string[];
      ask_attachment_now: boolean;
      is_complete: boolean;
    } | null = null;

    let usedModel: string | null = null;

    // 1. Try Google Gemini API if key is available
    if (activeApiKey) {
      const candidateModels = ['gemini-3.1-flash-lite'];
      const ai = new GoogleGenAI({ apiKey: activeApiKey });

      const promptPayload = `
ข้อมูลวันและเวลาจริงในประเทศไทย ณ ขณะนี้ (ใช้ข้อมูลจริงนี้ตอบผู้ใช้เสมอ):
- วันและเวลาปัจจุบันจริง: ${currentThaiDateTimeFull} น. (เวลา ${currentTimeOnly} น.)
- วันที่ปัจจุบัน (ISO YYYY-MM-DD): ${todayDefault}

ข้อมูลระบบ Smart Gate Pass AI & วิทยาลัย:
- วิทยาลัย: วิทยาลัยการอาชีพองครักษ์ (OICEC) สังกัด สอศ.
- สาขางาน: เทคโนโลยีธุรกิจดิจิทัล ระดับ ปวส.2
- สายพานการพิจารณา 5 ขั้นตอน: 1.ครูผู้สอนประจำวิชา -> 2.ครูที่ปรึกษา -> 3.หัวหน้าแผนก ทธด. -> 4.งานปกครอง -> 5.รองผู้อำนวยการ
- ฟังก์ชันหลัก: แชท AI ขออนุญาต (/chat), ซุ้มประตูไม้กั้นสแกนใบหน้า AI Gate (/gate), เช็คอินพิกัด GPS ถึงจุดหมาย (/chat และ /trip), โหมดติดตามการเดินทางสด (Live Trip Mode), การแจ้งเตือน Web Push แม้ปิดหน้าจอ

ตารางเวลาวิทยาลัย และตารางเรียน ปวส.2/1 (เทคโนโลยีธุรกิจดิจิทัล):
- คาบเช้า: 08:00 - 12:00 น.
- พักกลางวัน: 12:00 - 13:00 น. (ช่วงเวลายื่นขอออกยอดนิยม เช่น ทานข้าว/ธุระส่วนตัว และกลับก่อน 13:00 น.)
- คาบบ่าย: 13:00 - 17:00 น.
- เลิกเรียน: 17:00 น. (หลัง 17:00 น. กลับบ้านได้ตามปกติ ไม่ต้องขอใบอนุญาต)
- ตารางเรียน ปวส.2/1:
  * วันอังคาร 08:00 - 12:00 น.: เทคโนโลยีความจริงเสริม (อ.ธนพิสิษฐ์ ทาพา)
  * วันพุธ 08:00 - 12:00 น.: การวิเคราะห์ข้อมูล (อ.อรรถเมธ ตะโกนา)
  * วันพฤหัสบดี 13:00 - 17:00 น.: การบำรุงรักษาคอมพิวเตอร์และอุปกรณ์พกพา (อ.พัฒนา กลมพันธ์)
  * วันศุกร์ 13:00 - 17:00 น.: การผลิตสื่อมัลติมีเดียสำหรับธุรกิจดิจิทัล (อ.อรุณี สุนทรมณี)
- เวลาที่ขอออกได้: ช่วงพักเที่ยง 12:00 - 13:00 น., ช่วงเวลาว่างที่ไม่มีคาบเรียน หรือมีธุระจำเป็น/พบแพทย์ (เช่น ออก 12:00 กลับ 14:00 หรือไม่กลับบ้านเลย), และหลัง 17:00 น.

ข้อความล่าสุดจากนักศึกษา: "${text}"
รูปภาพแนบที่ส่งมา: ${attachment_url ? attachment_url : 'ไม่มี'}
ผู้ใช้กดข้ามเอกสาร (skip): ${skip_attachment ? 'ใช่ (ไม่ต้องการแนบเอกสาร)' : 'ไม่ใช่'}
Slots ที่บันทึกไว้ก่อนหน้า: ${JSON.stringify(slots)}

แนวทางการตอบ:
1. หากนักศึกษาถามคำถามทั่วไป (เช่น วันนี้วันอะไร, กี่โมงแล้ว, เวลาเท่าไหร่, ระบบคืออะไร, อนุมัติกี่ขั้นตอน, ไม้กั้นทำงานยังไง, ข้อมูลวิทยาลัย):
   - ให้ตอบคำถามนั้นตรงๆ ให้ชัดเจน สุภาพ และจบในตัวเองอย่างเป็นธรรมชาติ
   - *** กฎสำคัญมาก: ห้ามชวนทำเรื่องขอออกวิทยาลัยเด็ดขาด! ห้ามพิมพ์ประโยคห้อยท้าย เช่น "ต้องการขออนุญาตออกนอกสถานศึกษาใช่ไหมครับ" หรือ "หากต้องการทำเรื่องขออนุญาต..." ***
   - กำหนด intent = "question", missing_slots = [], is_complete = false
2. หากนักศึกษาต้องการขออนุญาตออกนอกวิทยาลัย (เช่น มีคำว่า ขอไป, ขอออก, จะออก, ไปหาหมอ, ขอกลับบ้าน, ออกตอนเที่ยง):
   - กำหนด intent = "leave_request" และรวบรวมข้อมูลตามกฎ Slot-Filling
   - ถ้านักศึกษาบอกแค่เวลาออก แต่ยังไม่บอกเวลากลับ: ห้ามคิดเวลากลับเองเด็ดขาด ให้ถามเวลากลับ
   - ถ้าระบุว่า "ไม่กลับ", "ไม่กลับแล้ว", "กลับบ้านเลย", "ออกยาว": ให้ allowed_end_time = "ไม่กลับ" และ is_return_required = 0 ทันที ตัด return_time ออกจาก missing_slots
`;

      for (const modelName of candidateModels) {
        try {
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('AI_TIMEOUT_4S')), 4500)
          );

          const apiPromise = ai.models.generateContent({
            model: modelName,
            contents: promptPayload,
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
              responseMimeType: 'application/json',
              temperature: 0.1,
            },
          });

          const response: any = await Promise.race([apiPromise, timeoutPromise]);

          let rawText = (response.text || '').trim();
          if (rawText.startsWith('```')) {
            rawText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
          }

          aiResult = JSON.parse(rawText);
          usedModel = modelName;

          // Safety guard: if student explicitly states not returning, enforce it immediately
          const isUserNoReturn = /(ไม่กลับ|ไม่ต้องกลับ|ไม่เข้าแล้ว|ไม่เข้ามาแล้ว|กลับบ้านเลย|ออกยาว|ไม่กลับโว้ย|ไม่กลับครับ|ไม่กลับค่ะ|ไม่กลับจ้า|ไม่ย้อนกลับ|ไม่เข้าวิทยาลัย)/i.test(text);
          if (isUserNoReturn && aiResult) {
            aiResult.slots = aiResult.slots || {};
            aiResult.slots.is_return_required = 0;
            aiResult.slots.allowed_end_time = 'ไม่กลับ';
            if (aiResult.missing_slots) {
              aiResult.missing_slots = aiResult.missing_slots.filter((s: string) => s !== 'return_time');
            }
            if (aiResult.replyMessage && (aiResult.replyMessage.includes('คาดว่าจะเดินทางกลับ') || aiResult.replyMessage.includes('กี่โมง'))) {
              aiResult.replyMessage = `รับทราบครับว่าไม่เดินทางกลับเข้าวิทยาลัยในวันดังกล่าวครับ${aiResult.slots.attachment_path ? '' : '\n\nมีเอกสารหลักฐาน (เช่น ใบนัดแพทย์) แนบด้วยไหมครับ? (ถ้าไม่มีสามารถกดปุ่ม "ไม่มีเอกสารแนบ" ด้านล่างได้เลยครับ)'}`;
            }
          }
          break;
        } catch (geminiError: any) {
          console.warn(`Gemini error with model ${modelName}:`, geminiError.message);
        }
      }
    }

    // 2. Built-in Deterministic Parser (Strict: Never guess return time!)
    if (!aiResult) {
      const isScheduleQuery = /(ขอออกและกลับได้เวลาไหน|ขอออกได้เวลาไหน|ออกได้เวลาไหน|ออกได้ตอนไหน|ขอออกได้ตอนไหน|เวลาไหนบ้าง|เวลาอะไรบ้าง|มีเวลาอะไรบ้าง|มีเวลาไหน|ออกกี่โมงได้|ตาราง|ตารางเรียน|ตารางเวลา|คาบเรียน|8:00|08:00|แปดโมง|กี่โมงถึงกี่โมง|ออกได้ช่วงไหน|กลับได้ช่วงไหน)/i.test(text);
      const isTimeQuery = /(กี่โมง|เวลาอะไร|เวลาเท่าไหร่|เวลากี่โมง|ตอนนี้กี่โมง|เวลานี้|กี่โมงละ|กี่โมงแล้ว|time)/i.test(text);
      const isDateQuery = /(วันอะไร|วันที่เท่าไหร่|วันนี้วันอะไร|วันที่ไร|วันนี้วันที่|date)/i.test(text);
      const isSystemQuestion = /(ขั้นตอน|ระเบียบ|กี่ขั้น|ใครอนุมัติ|ทำยังไง|มีขั้นตอน|สอบถาม|คืออะไร|เงื่อนไข|ระบบคือ|ระบบทำอะไร|ไม้กั้น|สแกนหน้า|gps|เช็คอิน)/i.test(text);
      const isGreeting = /^(สวัสดี|หวัดดี|hi|hello|ดีครับ|ดีค่ะ)/i.test(text) && !/(ไป|ขอออก|หาหมอ|ป่วย|ธุระ|เทียง|เที่ยง|บ่าย)/.test(text);
      const isNoAttachment = /^(ไม่มี|ไม่มีครับ|ไม่มีค่ะ|ไม่มีเอกสาร|ไม่แนบ|ข้าม)/i.test(text) || skip_attachment;

      if (isScheduleQuery) {
        aiResult = {
          intent: 'question',
          replyMessage: 'ตารางเวลาเรียนและช่วงเวลาที่สามารถขออนุญาตออก-กลับ มีดังนี้ครับ:\n\n⏰ ช่วงเวลาของวิทยาลัย:\n• คาบเช้า: 08:00 - 12:00 น.\n• พักกลางวัน: 12:00 - 13:00 น. (ช่วงเวลายื่นขอออกยอดนิยม เช่น ทานอาหาร หรือทำธุระส่วนตัว และกลับเข้ามาก่อน 13:00 น.)\n• คาบบ่าย: 13:00 - 17:00 น.\n• เลิกเรียน: 17:00 น. (หลัง 17:00 น. เดินทางกลับบ้านได้ตามปกติโดยไม่ต้องขอใบอนุญาต)\n\n📚 ตารางเรียน ปวส.2/1 (สาขางานเทคโนโลยีธุรกิจดิจิทัล):\n• วันอังคาร 08:00 - 12:00 น. : วิชา เทคโนโลยีความจริงเสริม (ครูธนพิสิษฐ์ ทาพา)\n• วันพุธ 08:00 - 12:00 น. : วิชา การวิเคราะห์ข้อมูล (ครูอรรถเมธ ตะโกนา)\n• วันพฤหัสบดี 13:00 - 17:00 น. : วิชา การบำรุงรักษาคอมพิวเตอร์และอุปกรณ์พกพา (ครูพัฒนา กลมพันธ์)\n• วันศุกร์ 13:00 - 17:00 น. : วิชา การผลิตสื่อมัลติมีเดียสำหรับธุรกิจดิจิทัล (ครูอรุณี สุนทรมณี)\n\nช่วงเวลาที่นักศึกษาสามารถขอออกได้:\n1. ช่วงพักเที่ยง: 12:00 - 13:00 น. (ออกและกลับก่อนเริ่มคาบบ่าย)\n2. ช่วงเวลาว่างที่ไม่มีเรียนตามตาราง หรือมีธุระจำเป็น/พบแพทย์ (เช่น ออก 12:00 น. กลับ 14:00/15:00 น. หรือขอออกแล้วไม่กลับบ้านเลย)\n3. เลิกเรียนหลัง 17:00 น. ครับ',
          slots,
          missing_slots: [],
          ask_attachment_now: false,
          is_complete: false,
        };
      } else if (isTimeQuery) {
        aiResult = {
          intent: 'question',
          replyMessage: `ขณะนี้เวลา ${currentTimeOnly} น. ครับ`,
          slots,
          missing_slots: [],
          ask_attachment_now: false,
          is_complete: false,
        };
      } else if (isDateQuery) {
        aiResult = {
          intent: 'question',
          replyMessage: `วันนี้คือ${currentThaiDateTimeFull.split(' เวลา')[0]} ครับ`,
          slots,
          missing_slots: [],
          ask_attachment_now: false,
          is_complete: false,
        };
      } else if (isSystemQuestion && !slots.destination_name) {
        aiResult = {
          intent: 'question',
          replyMessage:
            'ระบบ Smart Gate Pass AI มีสายพานการพิจารณา 5 ขั้นตอนครับ:\n1. ครูประจำวิชา (ตรวจสอบคาบเรียน)\n2. ครูที่ปรึกษา (ประสานผู้ปกครอง)\n3. หัวหน้าแผนกวิชา ทธด. (กลั่นกรองคำร้อง)\n4. เจ้าหน้าที่งานปกครอง (ตรวจวินัย)\n5. รองผู้อำนวยการ (อนุมัติขั้นสุดท้าย & ปลดล็อกไม้กั้นประตู 1)\n\nเมื่อได้รับอนุมัติครบแล้ว นักศึกษาสามารถสแกนใบหน้าที่ซุ้มประตูเพื่อเปิดไม้กั้นได้อัตโนมัติครับ',
          slots,
          missing_slots: [],
          ask_attachment_now: false,
          is_complete: false,
        };
      } else if (isGreeting && !slots.destination_name && !text.includes('ขอ')) {
        aiResult = {
          intent: 'greeting',
          replyMessage:
            'สวัสดีครับ! ผมคือ น้องเกต AI ผู้ช่วยประจำวิทยาลัยการอาชีพองครักษ์ ยินดีช่วยเหลือครับ สามารถสอบถามข้อมูลเกี่ยวกับระบบหรือแจ้งขออนุญาตออกนอกวิทยาลัยได้เลยครับ',
          slots,
          missing_slots: [],
          ask_attachment_now: false,
          is_complete: false,
        };
      } else {
        // 1. Date Detection
        const parsedDate = parseThaiDate(text);
        if (parsedDate) {
          slots.leave_date = parsedDate.dateStr;
          slots.leave_date_text = parsedDate.text;
        }

        // 2. Strict Time Detection
        const parsedTime = parseThaiTime(text, slots.allowed_start_time);
        if (parsedTime) {
          if (parsedTime.start) {
            slots.allowed_start_time = parsedTime.start;
          }
          if (parsedTime.end) {
            slots.allowed_end_time = parsedTime.end;
          }
          if (parsedTime.noReturn) {
            slots.is_return_required = 0;
            slots.allowed_end_time = 'ไม่กลับ';
          }
        }

        const isUserNoReturn = /(ไม่กลับ|ไม่ต้องกลับ|ไม่เข้าแล้ว|ไม่เข้ามาแล้ว|กลับบ้านเลย|ออกยาว|ไม่กลับโว้ย|ไม่กลับครับ|ไม่กลับค่ะ|ไม่กลับจ้า|ไม่ย้อนกลับ|ไม่เข้าวิทยาลัย)/i.test(text);
        if (isUserNoReturn) {
          slots.is_return_required = 0;
          slots.allowed_end_time = 'ไม่กลับ';
        }

        // 3. Destination & Category & Reason
        if (text.includes('บ้าน') || text.includes('กลับบ้าน') || text.includes('ที่พัก') || text.includes('หอพัก')) {
          slots.category = 'personal';
          slots.destination_name = 'บ้านพักอาศัย';
          slots.is_return_required = 0; // กลับบ้าน ไม่ต้องกลับวิทยาลัย
          if (!slots.reason) slots.reason = 'ขอกลับบ้านพักอาศัย';
        } else if (text.includes('แพทย์') || text.includes('หมอ') || text.includes('ป่วย') || text.includes('โรงพยาบาล') || text.includes('รพ.') || text.includes('โรงบาล')) {
          slots.category = 'medical';
          slots.destination_name = 'โรงพยาบาลองครักษ์';
          slots.destination_lat = 14.1350;
          slots.destination_lng = 100.9920;
          slots.is_return_required = 1;
          if (!slots.reason) slots.reason = 'ไปพบแพทย์ตามนัดที่โรงพยาบาลองครักษ์';
        } else if (text.includes('อำเภอ') || text.includes('บัตรประชาชน') || text.includes('ว่าการ')) {
          slots.category = 'personal';
          slots.destination_name = 'ที่ว่าการอำเภอองครักษ์';
          slots.destination_lat = 14.1205;
          slots.destination_lng = 100.9902;
          slots.is_return_required = 1;
          if (!slots.reason) slots.reason = 'ทำธุระจำเป็นที่ว่าการอำเภอองครักษ์';
        } else if (text.includes('หอประชุม') || text.includes('แผนก') || text.includes('โครงงาน') || text.includes('อุปกรณ์')) {
          slots.category = 'department';
          slots.destination_name = 'หอประชุมใหญ่วิทยาลัยการอาชีพองครักษ์';
          slots.destination_lat = 14.1288;
          slots.destination_lng = 100.9980;
          slots.is_return_required = 1;
          if (!slots.reason) slots.reason = 'ไปเตรียมสถานที่และอุปกรณ์นำเสนอโครงงาน';
        } else if (text.includes('ผู้ปกครอง') || text.includes('รับกลับ') || text.includes('แม่มารับ') || text.includes('พ่อมารับ')) {
          slots.category = 'parent_pickup';
          slots.destination_name = 'เดินทางกลับที่พักพร้อมผู้ปกครอง';
          slots.destination_lat = 14.1285;
          slots.destination_lng = 100.9985;
          slots.is_return_required = 0;
          if (!slots.reason) slots.reason = 'ผู้ปกครองเดินทางมารับกลับบ้านก่อนเวลา';
        } else if (/(ขอ|จะไป|ออก|ข้างนอก|ธุระ|ไป|กลับ|นัด|อนุญาต|พาไป|รับกลับ|พบแพทย์)/i.test(text) && text.length > 3 && !slots.destination_name && !isNoAttachment && !parsedDate && !parsedTime) {
          slots.destination_name = text;
          slots.destination_lat = 14.1285;
          slots.destination_lng = 100.9985;
          slots.is_return_required = 1;
          if (!slots.reason) slots.reason = text;
          if (!slots.category) slots.category = 'personal';
        } else if (!/(ขอ|จะไป|ออก|ข้างนอก|ธุระ|ไป|กลับ|นัด|อนุญาต|พาไป|รับกลับ|พบแพทย์)/i.test(text) && !slots.destination_name) {
          aiResult = {
            intent: 'question',
            replyMessage: 'สวัสดีครับ ผมคือน้องเกต AI ผู้ช่วยประจำวิทยาลัยการอาชีพองครักษ์ครับ สามารถสอบถามเวลา วันที่ ข้อมูลระบบ 5 ขั้นตอน หรือแจ้งขออนุญาตออกนอกวิทยาลัยได้เลยครับ',
            slots,
            missing_slots: [],
            ask_attachment_now: false,
            is_complete: false,
          };
        }

        // 4. Attachment handling
        if (attachment_url) {
          slots.attachment_path = attachment_url;
        }

        // Check missing slots strictly:
        const missing: string[] = [];
        if (slots.destination_name === 'บ้านพักอาศัย' && !slots.destination_lat) {
          missing.push('home_pin');
        }
        if (!slots.destination_name) missing.push('destination');
        if (!slots.reason || !slots.category) missing.push('reason');
        if (!slots.leave_date) missing.push('date');
        if (!slots.allowed_start_time) missing.push('start_time');
        
        // Crucial Rule: If start_time exists but end_time is missing, ask for return_time (only if return is required!)
        if (slots.allowed_start_time && !slots.allowed_end_time) {
          if (slots.is_return_required === 0 || isUserNoReturn) {
            slots.allowed_end_time = 'ไม่กลับ';
          } else {
            missing.push('return_time');
          }
        }

        const hasMainSlots = missing.length === 0;

        if (!hasMainSlots) {
          let reply = '';
          if (missing.includes('home_pin')) {
            reply = `รับทราบครับว่าขอกลับบ้านพักอาศัย 🏠\nกรุณาเลือกหรือแตะปักหมุดตำแหน่งบ้านของคุณบนแผนที่ด้านล่าง เพื่อบันทึกพิกัดความปลอดภัยของวิทยาลัยครับ`;
          } else if (missing.includes('destination') && missing.includes('reason')) {
            reply = 'รับเรื่องขออนุญาตครับ ไม่ทราบว่าต้องการออกไปที่ไหน และไปทำธุระอะไรครับ?';
          } else if (missing.includes('start_time')) {
            reply = `รับทราบครับ (${slots.destination_name || 'นอกวิทยาลัย'}) ต้องการขอออกช่วงเวลาใดครับ? (เช่น ตอนเที่ยง, ช่วงบ่าย, หรือระบุเวลาออก)`;
          } else if (missing.includes('return_time')) {
            // Asked for return time explicitly without guessing!
            reply = `รับทราบเวลาออก ${slots.allowed_start_time} น. ครับ\nแล้วคาดว่าจะเดินทางกลับเข้าวิทยาลัยประมาณกี่โมงครับ? (กรุณาระบุเวลากลับ เช่น บ่ายสอง, บ่ายสาม, 15:30 น.)`;
          } else if (missing.includes('date')) {
            reply = `รับทราบข้อมูลสถานที่: ${slots.destination_name} ครับ\nต้องการขออนุญาตสำหรับ "วันนี้" หรือ "พรุ่งนี้" ครับ?`;
          } else {
            reply = 'กรุณาระบุข้อมูลเพิ่มเติมที่ยังขาดด้วยครับ';
          }

          aiResult = {
            intent: 'leave_request',
            replyMessage: reply,
            slots,
            missing_slots: missing,
            ask_attachment_now: false,
            is_complete: false,
          };
        } else {
          // Both start_time AND end_time are provided!
          if (!slots.attachment_prompted && !slots.attachment_path && !isNoAttachment) {
            slots.attachment_prompted = true;
            aiResult = {
              intent: 'leave_request',
              replyMessage: `บันทึกข้อมูลเรียบร้อยครับ:\n📅 วันที่: ${slots.leave_date_text || slots.leave_date}\n📍 สถานที่: ${slots.destination_name}\n⏰ เวลาออก: ${slots.allowed_start_time} น. • เวลากลับ: ${slots.allowed_end_time === 'ไม่กลับ' ? 'ไม่กลับเข้าวิทยาลัย' : `${slots.allowed_end_time} น.`}\n\nมีเอกสารหลักฐาน (เช่น ใบนัดแพทย์) หรือรูปถ่ายแชทผู้ปกครองแนบด้วยไหมครับ? (สามารถกด 📎 แนบรูป หรือกดปุ่มด้านล่างว่า 'ไม่มีเอกสารแนบ' เพื่อส่งคำขอได้เลยครับ)`,
              slots,
              missing_slots: ['attachment'],
              ask_attachment_now: true,
              is_complete: false,
            };
          } else {
            aiResult = {
              intent: 'leave_request',
              replyMessage: 'รับเรื่องเรียบร้อยครับ! กำลังสร้างใบคำร้องและส่งต่อให้คณะครูพิจารณาครับ',
              slots,
              missing_slots: [],
              ask_attachment_now: false,
              is_complete: true,
            };
          }
        }
      }
    }

    // Merge slots back
    const finalSlots = { ...slots, ...(aiResult.slots || {}) };
    if (!finalSlots.leave_date && aiResult.is_complete) {
      finalSlots.leave_date = todayDefault;
    }

    // 3. If is_complete is true, query real timetable and create leave_requests record
    let createdRequest: LeaveRequest | null = null;
    if (aiResult.is_complete && finalSlots.destination_name && finalSlots.allowed_start_time && finalSlots.allowed_end_time) {
      // Lookup student info
      const student = queryOne(`
        SELECT u.*, cg.advisor_teacher_id, d.head_teacher_id
        FROM users u
        LEFT JOIN class_groups cg ON u.class_group_id = cg.id
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.id = ?
      `, student_id);

      let targetDate = new Date();
      if (finalSlots.leave_date) {
        targetDate = new Date(finalSlots.leave_date);
      }
      const dayOfWeek = targetDate.getDay() || 3;

      let matchedCourse = queryOne(`
        SELECT cs.*, u.full_name as teacher_name
        FROM courses_schedule cs
        JOIN users u ON cs.teacher_id = u.id
        WHERE cs.class_group_id = ? AND cs.day_of_week = ?
        LIMIT 1
      `, student?.class_group_id || 'grp-hvc2', dayOfWeek);

      if (!matchedCourse) {
        matchedCourse = queryOne(`
          SELECT cs.*, u.full_name as teacher_name
          FROM courses_schedule cs
          JOIN users u ON cs.teacher_id = u.id
          WHERE cs.class_group_id = ?
          ORDER BY cs.day_of_week ASC
          LIMIT 1
        `, student?.class_group_id || 'grp-hvc2');
      }

      const countRow = queryOne(`SELECT COUNT(*) as count FROM leave_requests`);
      const nextSeq = (countRow ? countRow.count : 0) + 102;
      const requestCode = `#GP-2569-${String(nextSeq).padStart(3, '0')}`;
      const newId = `req-${Date.now()}`;
      const actualLeaveDate = finalSlots.leave_date || todayDefault;

      execute(`
        INSERT INTO leave_requests (
          id, request_code, student_id, course_id, category, reason, destination_name, destination_lat, destination_lng, attachment_path,
          leave_date, allowed_start_time, allowed_end_time, current_step, overall_status,
          is_return_required, trip_stage,
          step1_teacher_id, step2_advisor_id, step3_dept_head_id, step4_discipline_id, step5_deputy_id
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, 1, 'pending',
          ?, 'not_started',
          ?, ?, ?, ?, ?
        )
      `,
        newId, requestCode, student_id, matchedCourse?.id || null,
        finalSlots.category || 'personal', finalSlots.reason || 'ธุระส่วนตัวจำเป็น',
        finalSlots.destination_name, finalSlots.destination_lat || 14.1285, finalSlots.destination_lng || 100.9985,
        finalSlots.attachment_path || null,
        actualLeaveDate, finalSlots.allowed_start_time, finalSlots.allowed_end_time,
        finalSlots.is_return_required !== undefined ? finalSlots.is_return_required : 1,
        matchedCourse?.teacher_id || 'user-t-atthamed',
        student?.advisor_teacher_id || 'user-t-atthamed',
        student?.head_teacher_id || 'user-head-pattana',
        'user-discipline-01',
        'user-deputy-chaiyot'
      );

      createdRequest = (queryOne<LeaveRequest>(`
        SELECT lr.*, u.full_name as student_name, u.username as student_code, cg.group_code, cs.course_name
        FROM leave_requests lr
        JOIN users u ON lr.student_id = u.id
        LEFT JOIN class_groups cg ON u.class_group_id = cg.id
        LEFT JOIN courses_schedule cs ON lr.course_id = cs.id
        WHERE lr.id = ?
      `, newId)) || null;

      const displayEndTime = finalSlots.allowed_end_time === 'ไม่กลับ' ? 'ไม่กลับ' : `${finalSlots.allowed_end_time} น.`;
      aiResult.replyMessage = `รับเรื่องขออนุญาตเรียบร้อยครับ!\n📅 วันที่: ${actualLeaveDate} (เวลา ${finalSlots.allowed_start_time} - ${displayEndTime})\n📚 ผูกวิชา: '${matchedCourse?.course_name || 'การวิเคราะห์ข้อมูล'}' (ครูประจำวิชา: ${matchedCourse?.teacher_name || 'ครูอรรถเมธ ตะโกนา'})\nเลขที่คำร้อง: ${requestCode} ส่งเข้าคิวพิจารณา 5 ขั้นตอนแล้วครับ${finalSlots.attachment_path ? ' (แนบไฟล์เอกสารหลักฐานเรียบร้อย)' : ''}`;

      // Background push notification to Teacher Step 1 (works when browser is closed)
      const targetTeacherId = matchedCourse?.teacher_id || 'user-t-atthamed';
      sendPushToUsers([targetTeacherId], {
        title: `🔔 มีคำร้องขอออกใหม่: ${student?.full_name || 'นักศึกษา'}`,
        body: `${finalSlots.reason || 'ธุระจำเป็น'} • ${finalSlots.destination_name} (รออนุมัติขั้นที่ 1)`,
        url: '/chat',
        tag: `req-${newId}-step-1`,
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      reply: aiResult.replyMessage,
      slots: finalSlots,
      missing_slots: aiResult.missing_slots,
      ask_attachment_now: aiResult.ask_attachment_now,
      is_complete: aiResult.is_complete,
      request: createdRequest,
      poweredBy: usedModel
        ? `Google Gemini AI (${usedModel})`
        : activeApiKey
        ? 'Google Gemini AI'
        : 'Smart Slot-Filling Engine',
    });
  } catch (error: any) {
    console.error('API /api/chat error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
