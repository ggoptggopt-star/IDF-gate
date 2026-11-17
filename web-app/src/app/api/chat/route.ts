import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute } from '@/lib/db';
import { LeaveRequest } from '@/types';
import { GoogleGenAI } from '@google/genai';

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
}

const SYSTEM_INSTRUCTION = `
คุณคือ "น้องเกต (Smart Gate Pass AI)" ผู้ช่วยปัญญาประดิษฐ์ประจำวิทยาลัยการอาชีพองครักษ์ (OICEC)
บุคลิก: สุภาพ นอบน้อม ชัดเจน อบอุ่น ใช้ภาษาไทยที่เป็นทางการปานกลางและเป็นกันเองกับนักศึกษา (ลงท้าย "ครับ")

หน้าที่หลัก:
รับเรื่องขออนุญาตออกนอกสถานศึกษาแบบ Slot-Filling Conversational AI

กฎเหล็กสำคัญที่สุดเรื่องเวลาออกและเวลากลับ:
1. หากนักศึกษาบอกเพียง "เวลาออก" (เช่น 'ตอนเทียง', 'ตอนเที่ยง', 'บ่ายโมง', '13:00 น.') โดยยังไม่ได้ระบุเวลากลับ:
   - ห้ามบอทคิดหรือสุ่มเวลากลับเองเด็ดขาด!
   - ให้บันทึก allowed_start_time ไว้ และตั้ง allowed_end_time = null
   - ให้ใส่ "return_time" ลงใน missing_slots
   - ให้บอทพิมพ์ถามเวลากลับ เช่น: "รับทราบเวลาออก [เวลาออก] ครับ แล้วคาดว่าจะเดินทางกลับเข้าวิทยาลัยประมาณกี่โมงครับ?"
2. หากนักศึกษาบอก "เวลากลับ" เพิ่มเข้ามา (เช่น 'กลับบ่ายสาม', '15:30 น.', 'บ่ายสองโมง') ให้บันทึก allowed_end_time
3. หากนักศึกษาบอกทั้งช่วงเวลามาตั้งแต่แรก (เช่น "12:00 ถึง 15:30 น." หรือ "ตอนเที่ยงถึงบ่ายสาม") จึงจะบันทึกทั้ง allowed_start_time และ allowed_end_time พร้อมกันได้
4. จะถือว่าข้อมูลเวลาครบถ้วน (is_complete) ก็ต่อเมื่อได้ "ทั้งเวลาออก และ เวลากลับ" จากนักศึกษาแล้วเท่านั้น

ความสามารถในการเข้าใจภาษาพูดภาษาไทยและการสะกดคำ (Colloquial & Typos):
- "ตอนเทียง", "ตอนเที่ยง", "เที่ยง", "เทียง", "พักเที่ยง" -> เวลาออก 12:00 น. (ต้องถามเวลากลับด้วย!)
- "เที่ยงครึ่ง", "เทียงครึ่ง" -> เวลาออก 12:30 น. (ต้องถามเวลากลับด้วย!)
- "ตอนบ่าย", "บ่ายนี้", "บ่ายโมง" -> เวลาออก 13:00 น. (ต้องถามเวลากลับด้วย!)
- "บ่ายสอง" -> 14:00 น., "บ่ายสาม" -> 15:00 น.
- "วันนี้", "วันนี" -> กำหนด leave_date เป็นวันที่ปัจจุบัน (YYYY-MM-DD)
- "พรุ่งนี้", "พรุงนี้", "พรุ่งนี" -> กำหนด leave_date เป็นวันพรุ่งนี้

ช่องข้อมูลสำคัญที่ต้องรวบรวม (Slots):
1. leave_date: วันที่ขอออก (เช่น '2026-11-17', 'วันนี้', 'พรุ่งนี้') — ถ้ายังไม่บอก ให้ถามวันที่
2. destination_name: สถานที่ปลายทาง (เช่น 'โรงพยาบาลองครักษ์', 'ที่ว่าการอำเภอองครักษ์')
3. category & reason: เหตุผลและหมวดหมู่ ('medical' | 'personal' | 'department' | 'parent_pickup')
4. allowed_start_time: เวลาออก
5. allowed_end_time: เวลากลับ (ต้องถามจากนักศึกษา ห้ามคิดเอง!)
6. attachment: เอกสารแนบ (ใบนัดแพทย์ หรือ รูปถ่ายแชทผู้ปกครอง) - ให้ถามเสมอหลังจากได้ข้อมูลครบทุกช่อง แต่ไม่บังคับ (นักศึกษาตอบว่า 'ไม่มี' ได้)

กติกาการตอบ JSON:
{
  "intent": "greeting" | "question" | "leave_request",
  "replyMessage": "ข้อความตอบกลับภาษาไทยอย่างสุภาพ หากขาดเวลากลับให้ถามเวลากลับ",
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
  "ask_attachment_now": boolean (true เมื่อได้ข้อมูลวัน สถานที่ เหตุผล เวลาออก และเวลากลับครบแล้ว),
  "is_complete": boolean (true เฉพาะเมื่อครบทุกช่อง และเคลียร์เรื่องเอกสารแล้ว)
}
`;

interface ParsedTimeResult {
  start?: string | null;
  end?: string | null;
  desc?: string;
}

// Helper: Parse Thai Time (Never guess return time if only departure time is given!)
function parseThaiTime(text: string, currentStart?: string | null): ParsedTimeResult | null {
  const t = text.replace(/\s+/g, ' ');

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
    const todayDefault = new Date().toISOString().split('T')[0];

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
      const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.5-flash-lite', 'gemini-3.8-flash'];
      const ai = new GoogleGenAI({ apiKey: activeApiKey });

      const promptPayload = `
วันที่ปัจจุบัน: ${todayDefault}
ข้อความล่าสุดจากนักศึกษา: "${text}"
รูปภาพแนบที่ส่งมา: ${attachment_url ? attachment_url : 'ไม่มี'}
ผู้ใช้กดข้ามเอกสาร (skip): ${skip_attachment ? 'ใช่ (ไม่ต้องการแนบเอกสาร)' : 'ไม่ใช่'}
Slots ที่บันทึกไว้ก่อนหน้า: ${JSON.stringify(slots)}

คำเตือนสำคัญ:
- ถ้านักศึกษาบอกแค่ "เวลาออก" (เช่น ตอนเทียง, บ่ายโมง) แต่ยังไม่ได้บอก "เวลากลับ":
  ห้ามเดาหรือคิดเวลากลับเองเด็ดขาด! ให้บันทึกเฉพาะ allowed_start_time และปล่อย allowed_end_time เป็น null
  แล้วใส่ "return_time" ใน missing_slots และพิมพ์ถามเวลากลับ เช่น: "รับทราบเวลาออก [เวลา] ครับ แล้วคาดว่าจะเดินทางกลับเข้าวิทยาลัยประมาณกี่โมงครับ?"
- ตรวจสอบว่า missing_slots มีอะไรบ้างตามลำดับ: date, destination, reason, start_time, return_time, attachment
`;

      for (const modelName of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: promptPayload,
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
              responseMimeType: 'application/json',
              temperature: 0.1,
            },
          });

          const rawText = response.text || '';
          aiResult = JSON.parse(rawText);
          usedModel = modelName;
          break;
        } catch (geminiError: any) {
          console.warn(`Gemini error with model ${modelName}:`, geminiError.message);
        }
      }
    }

    // 2. Built-in Deterministic Parser (Strict: Never guess return time!)
    if (!aiResult) {
      const isQuestion = /(ขั้นตอน|ระเบียบ|กี่ขั้น|ใครอนุมัติ|ทำยังไง|มีขั้นตอน|สอบถาม|คืออะไร|เงื่อนไข)/i.test(text);
      const isGreeting = /^(สวัสดี|หวัดดี|hi|hello|ดีครับ|ดีค่ะ)/i.test(text) && !/(ไป|ขอออก|หาหมอ|ป่วย|ธุระ|เทียง|เที่ยง|บ่าย)/.test(text);
      const isNoAttachment = /^(ไม่มี|ไม่มีครับ|ไม่มีค่ะ|ไม่มีเอกสาร|ไม่แนบ|ข้าม)/i.test(text) || skip_attachment;

      if (isQuestion && !slots.destination_name) {
        aiResult = {
          intent: 'question',
          replyMessage:
            'ขั้นตอนการขออนุญาตออกนอกสถานศึกษามี 5 ขั้นตอนตามลำดับครับ:\n1. ครูรายวิชา (ตรวจสอบคาบเรียน)\n2. ครูที่ปรึกษา (ประสานผู้ปกครอง)\n3. หัวหน้าแผนกวิชา ทธด. (กลั่นกรอง)\n4. ฝ่ายปกครอง (ตรวจวินัย)\n5. รองผู้อำนวยการ (อนุมัติขั้นสุดท้าย & ซิงค์ข้อมูลเข้ากล้องสแกนหน้าประตู 1)\n\nหากนักศึกษาต้องการยื่นขออนุญาต สามารถพิมพ์แจ้งเหตุผล สถานที่ วันที่ และเวลาในแชทนี้ได้เลยครับ!',
          slots,
          missing_slots: ['date', 'destination', 'reason', 'start_time', 'return_time'],
          ask_attachment_now: false,
          is_complete: false,
        };
      } else if (isGreeting && !slots.destination_name && !text.includes('ขอ')) {
        aiResult = {
          intent: 'greeting',
          replyMessage:
            'สวัสดีครับ! ผมคือ น้องเกต AI ผู้ช่วยประจำวิทยาลัยการอาชีพองครักษ์ ยินดีช่วยเหลือครับ หากต้องการยื่นขออนุญาตออกนอกวิทยาลัย สามารถพิมพ์แจ้งเหตุผล สถานที่ปลายทาง วันที่ และช่วงเวลาที่ต้องการออกและกลับได้เลยครับ (เช่น "ขอไปหาหมอที่ รพ.องครักษ์ ตอนเที่ยง กลับบ่ายสาม วันนี้ครับ")',
          slots,
          missing_slots: ['date', 'destination', 'reason', 'start_time', 'return_time'],
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
        }

        // 3. Destination & Category & Reason
        if (text.includes('แพทย์') || text.includes('หมอ') || text.includes('ป่วย') || text.includes('โรงพยาบาล') || text.includes('รพ.') || text.includes('โรงบาล')) {
          slots.category = 'medical';
          slots.destination_name = 'โรงพยาบาลองครักษ์';
          slots.destination_lat = 14.1350;
          slots.destination_lng = 100.9920;
          if (!slots.reason) slots.reason = 'ไปพบแพทย์ตามนัดที่โรงพยาบาลองครักษ์';
        } else if (text.includes('อำเภอ') || text.includes('บัตรประชาชน') || text.includes('ว่าการ')) {
          slots.category = 'personal';
          slots.destination_name = 'ที่ว่าการอำเภอองครักษ์';
          slots.destination_lat = 14.1205;
          slots.destination_lng = 100.9902;
          if (!slots.reason) slots.reason = 'ทำธุระจำเป็นที่ว่าการอำเภอองครักษ์';
        } else if (text.includes('หอประชุม') || text.includes('แผนก') || text.includes('โครงงาน') || text.includes('อุปกรณ์')) {
          slots.category = 'department';
          slots.destination_name = 'หอประชุมใหญ่วิทยาลัยการอาชีพองครักษ์';
          slots.destination_lat = 14.1288;
          slots.destination_lng = 100.9980;
          if (!slots.reason) slots.reason = 'ไปเตรียมสถานที่และอุปกรณ์นำเสนอโครงงาน';
        } else if (text.includes('ผู้ปกครอง') || text.includes('รับกลับ') || text.includes('แม่มารับ') || text.includes('พ่อมารับ')) {
          slots.category = 'parent_pickup';
          slots.destination_name = 'เดินทางกลับที่พักพร้อมผู้ปกครอง';
          slots.destination_lat = 14.1285;
          slots.destination_lng = 100.9985;
          if (!slots.reason) slots.reason = 'ผู้ปกครองเดินทางมารับกลับบ้านก่อนเวลา';
        } else if (text.length > 3 && !slots.destination_name && !isNoAttachment && !parsedDate && !parsedTime) {
          slots.destination_name = text;
          slots.destination_lat = 14.1285;
          slots.destination_lng = 100.9985;
          if (!slots.reason) slots.reason = text;
          if (!slots.category) slots.category = 'personal';
        }

        // 4. Attachment handling
        if (attachment_url) {
          slots.attachment_path = attachment_url;
        }

        // Check missing slots strictly:
        const missing: string[] = [];
        if (!slots.destination_name) missing.push('destination');
        if (!slots.reason || !slots.category) missing.push('reason');
        if (!slots.leave_date) missing.push('date');
        if (!slots.allowed_start_time) missing.push('start_time');
        // Crucial Rule: If start_time exists but end_time is missing, ask for return_time!
        if (slots.allowed_start_time && !slots.allowed_end_time) missing.push('return_time');

        const hasMainSlots = missing.length === 0;

        if (!hasMainSlots) {
          let reply = '';
          if (missing.includes('destination') && missing.includes('reason')) {
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
              replyMessage: `บันทึกข้อมูลเรียบร้อยครับ:\n📅 วันที่: ${slots.leave_date_text || slots.leave_date}\n📍 สถานที่: ${slots.destination_name}\n⏰ เวลาออก: ${slots.allowed_start_time} น. • เวลากลับ: ${slots.allowed_end_time} น.\n\nมีเอกสารหลักฐาน (เช่น ใบนัดแพทย์) หรือรูปถ่ายแชทผู้ปกครองแนบด้วยไหมครับ? (สามารถกด 📎 แนบรูป หรือกดปุ่มด้านล่างว่า 'ไม่มีเอกสารแนบ' เพื่อส่งคำขอได้เลยครับ)`,
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
          step1_teacher_id, step2_advisor_id, step3_dept_head_id, step4_discipline_id, step5_deputy_id
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, 1, 'pending',
          ?, ?, ?, ?, ?
        )
      `,
        newId, requestCode, student_id, matchedCourse?.id || null,
        finalSlots.category || 'personal', finalSlots.reason || 'ธุระส่วนตัวจำเป็น',
        finalSlots.destination_name, finalSlots.destination_lat || 14.1285, finalSlots.destination_lng || 100.9985,
        finalSlots.attachment_path || null,
        actualLeaveDate, finalSlots.allowed_start_time, finalSlots.allowed_end_time,
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

      aiResult.replyMessage = `รับเรื่องขออนุญาตเรียบร้อยครับ!\n📅 วันที่: ${actualLeaveDate} (เวลา ${finalSlots.allowed_start_time} - ${finalSlots.allowed_end_time} น.)\n📚 ผูกวิชา: '${matchedCourse?.course_name || 'การวิเคราะห์ข้อมูล'}' (ครูประจำวิชา: ${matchedCourse?.teacher_name || 'ครูอรรถเมธ ตะโกนา'})\nเลขที่คำร้อง: ${requestCode} ส่งเข้าคิวพิจารณา 5 ขั้นตอนแล้วครับ${finalSlots.attachment_path ? ' (แนบไฟล์เอกสารหลักฐานเรียบร้อย)' : ''}`;
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
