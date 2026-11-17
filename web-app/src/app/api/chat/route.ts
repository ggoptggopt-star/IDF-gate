import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute } from '@/lib/db';
import { LeaveRequest } from '@/types';
import { GoogleGenAI } from '@google/genai';

const SYSTEM_INSTRUCTION = `
คุณคือ "น้องเกต (Smart Gate Pass AI)" ผู้ช่วยปัญญาประดิษฐ์ประจำวิทยาลัยการอาชีพองครักษ์ (OICEC)
บุคลิก: สุภาพ นอบน้อม ชัดเจน อบอุ่น ใช้ภาษาไทยที่เป็นทางการปานกลางและเป็นกันเองกับนักศึกษา (ลงท้าย "ครับ")

หน้าที่หลักของคุณ:
1. ช่วยเหลือนักศึกษาในการยื่นคำร้องขออนุญาตออกนอกสถานศึกษา
2. ตอบคำถามเกี่ยวกับขั้นตอนการขออนุญาต 5 ขั้นตอน (1.ครูรายวิชา -> 2.ครูที่ปรึกษา -> 3.หัวหน้าแผนก ทธด. -> 4.งานปกครอง -> 5.รอง ผอ.)
3. เมื่อนักศึกษาพิมพ์แจ้งความประสงค์จะออกนอกวิทยาลัย ให้วิเคราะห์และสกัดข้อมูล:
   - reason (เหตุผล)
   - category (เลือก 1 จาก: 'medical', 'personal', 'department', 'parent_pickup')
   - destination_name (สถานที่ปลายทาง เช่น 'โรงพยาบาลองครักษ์', 'ที่ว่าการอำเภอองครักษ์', 'ร้านเครื่องเขียนองครักษ์')
   - destination_lat, destination_lng (ถ้าเป็น รพ.องครักษ์ คือ 14.1350, 100.9920 / ที่ว่าการอำเภอ 14.1205, 100.9902 / ทั่วไป 14.1285, 100.9985)
   - allowed_start_time, allowed_end_time (เวลาเริ่มและสิ้นสุด เช่น 12:30, 15:30)

สำคัญ: ให้ตอบกลับเป็น JSON รูปแบบนี้เสมอ:
{
  "isLeaveRequest": true หรือ false (true เมื่อนักศึกษาแจ้งขออนุญาตออกนอกสถานศึกษา),
  "replyMessage": "ข้อความตอบกลับนักศึกษาอย่างสุภาพ อธิบายว่าดำเนินการอะไรให้บ้าง",
  "extracted": {
    "reason": "เหตุผลที่ขอออก",
    "category": "medical" | "personal" | "department" | "parent_pickup",
    "destination_name": "ชื่อสถานที่",
    "destination_lat": 14.1350,
    "destination_lng": 100.9920,
    "allowed_start_time": "12:30",
    "allowed_end_time": "15:30"
  }
}
หากเป็นเพียงการทักทาย หรือถามคำถามทั่วไป ให้ตั้ง isLeaveRequest = false และ extracted = null แล้วตอบใน replyMessage
`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, apiKey, student_id = 'user-stu-akkaracha' } = body;

    if (!message || !message.trim()) {
      return NextResponse.json({ success: false, error: 'กรุณากรอกข้อความ' }, { status: 400 });
    }

    const activeApiKey = apiKey?.trim() || process.env.GEMINI_API_KEY;

    let aiResult: {
      isLeaveRequest: boolean;
      replyMessage: string;
      extracted?: {
        reason: string;
        category: 'medical' | 'personal' | 'department' | 'parent_pickup';
        destination_name: string;
        destination_lat: number;
        destination_lng: number;
        allowed_start_time: string;
        allowed_end_time: string;
      } | null;
    } | null = null;

    // 1. If Gemini API Key is provided, call real Google Gemini API
    let usedModel: string | null = null;
    if (activeApiKey) {
      const candidateModels = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.8-flash'];
      const ai = new GoogleGenAI({ apiKey: activeApiKey });

      for (const modelName of candidateModels) {
        try {
          const response = await ai.models.generateContent({
            model: modelName,
            contents: message,
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          });

          const rawText = response.text || '';
          aiResult = JSON.parse(rawText);
          usedModel = modelName;
          break; // successfully generated
        } catch (geminiError: any) {
          console.warn(`Gemini API error with model ${modelName}:`, geminiError.message);
        }
      }
    }

    // 2. Smart Built-in Fallback Agent (if no key or API error)
    if (!aiResult) {
      const text = message.trim();
      const isQuestion = /(ขั้นตอน|ระเบียบ|กี่ขั้น|ใครอนุมัติ|ทำยังไง|มีขั้นตอน|สอบถาม|คืออะไร|เงื่อนไข)/i.test(text);
      const isGreeting = /^(สวัสดี|หวัดดี|hi|hello|ดีครับ|ดีค่ะ)/i.test(text) && !/(ไป|ขอออก|หาหมอ|ป่วย|ธุระ)/.test(text);
      const isExplicitLeave = /(ขออนุญาตออก|ขอออกนอก|ขอไปพบแพทย์|ขอไปหาหมอ|ขอไปธุระ|ไปทำธุระ|ไปหาหมอ|ไปโรงพยาบาล|กลับบ้านก่อน)/i.test(text);

      if (isQuestion && !isExplicitLeave) {
        aiResult = {
          isLeaveRequest: false,
          replyMessage:
            'ขั้นตอนการขออนุญาตออกนอกสถานศึกษามี 5 ขั้นตอนตามลำดับครับ:\n1. ครูรายวิชา (ตรวจสอบคาบเรียน)\n2. ครูที่ปรึกษา (ประสานผู้ปกครอง)\n3. หัวหน้าแผนกวิชา ทธด. (กลั่นกรอง)\n4. ฝ่ายปกครอง (ตรวจวินัย)\n5. รองผู้อำนวยการ (อนุมัติขั้นสุดท้าย & ซิงค์ข้อมูลเข้ากล้องสแกนหน้าประตู 1)\n\nหากนักศึกษาต้องการยื่นขออนุญาต สามารถพิมพ์แจ้งเหตุผล สถานที่ และเวลาในแชทนี้ได้เลยครับ!',
          extracted: null,
        };
      } else if (isGreeting) {
        aiResult = {
          isLeaveRequest: false,
          replyMessage:
            'สวัสดีครับ! ผมคือ น้องเกต AI ผู้ช่วยประจำวิทยาลัยการอาชีพองครักษ์ ยินดีช่วยเหลือครับ หากต้องการยื่นขออนุญาตออกนอกวิทยาลัย สามารถพิมพ์แจ้งเหตุผล สถานที่ปลายทาง และช่วงเวลาที่ต้องการออกได้เลยครับ',
          extracted: null,
        };
      } else {
        // Smart parameter extraction
        let category: 'medical' | 'personal' | 'department' | 'parent_pickup' = 'personal';
        let dest = 'นอกสถานศึกษา';
        let lat = 14.1285;
        let lng = 100.9985;

        if (text.includes('แพทย์') || text.includes('หมอ') || text.includes('ป่วย') || text.includes('โรงพยาบาล') || text.includes('รพ.')) {
          category = 'medical';
          dest = 'โรงพยาบาลองครักษ์';
          lat = 14.1350;
          lng = 100.9920;
        } else if (text.includes('อำเภอ') || text.includes('บัตรประชาชน') || text.includes('ว่าการ')) {
          category = 'personal';
          dest = 'ที่ว่าการอำเภอองครักษ์';
          lat = 14.1205;
          lng = 100.9902;
        } else if (text.includes('หอประชุม') || text.includes('แผนก') || text.includes('โครงงาน') || text.includes('อุปกรณ์')) {
          category = 'department';
          dest = 'หอประชุมใหญ่วิทยาลัยการอาชีพองครักษ์';
          lat = 14.1288;
          lng = 100.9980;
        } else if (text.includes('ผู้ปกครอง') || text.includes('รับกลับ') || text.includes('แม่มารับ') || text.includes('พ่อมารับ')) {
          category = 'parent_pickup';
          dest = 'เดินทางกลับที่พักพร้อมผู้ปกครอง';
        }

        // Time window extraction
        const timeMatch = text.match(/(\d{1,2}[:.]\d{2})\s*[-ถึง]\s*(\d{1,2}[:.]\d{2})/);
        let startTime = '12:30';
        let endTime = '15:30';
        if (timeMatch) {
          startTime = timeMatch[1].replace('.', ':');
          endTime = timeMatch[2].replace('.', ':');
        }

        aiResult = {
          isLeaveRequest: true,
          replyMessage: `รับเรื่องขออนุญาตเรียบร้อยครับ! ระบบได้บันทึกคำร้องและเริ่มกระบวนการอนุมัติ 5 ขั้นตอนอัตโนมัติแล้ว โดยส่งเรื่องต่อไปยังครูประจำวิชาและครูที่ปรึกษา (แผนกเทคโนโลยีธุรกิจดิจิทัล) ให้ทันทีครับ`,
          extracted: {
            reason: text,
            category,
            destination_name: dest,
            destination_lat: lat,
            destination_lng: lng,
            allowed_start_time: startTime,
            allowed_end_time: endTime,
          },
        };
      }
    }

    // 3. If AI recognized a leave request, create record in SQLite database
    let createdRequest: LeaveRequest | null = null;
    if (aiResult.isLeaveRequest && aiResult.extracted) {
      const ext = aiResult.extracted;

      // Lookup student info
      const student = queryOne(`
        SELECT u.*, cg.advisor_teacher_id, d.head_teacher_id
        FROM users u
        LEFT JOIN class_groups cg ON u.class_group_id = cg.id
        LEFT JOIN departments d ON u.department_id = d.id
        WHERE u.id = ?
      `, student_id);

      const countRow = queryOne(`SELECT COUNT(*) as count FROM leave_requests`);
      const nextSeq = (countRow ? countRow.count : 0) + 90;
      const requestCode = `#GP-2569-${String(nextSeq).padStart(3, '0')}`;
      const newId = `req-${Date.now()}`;
      const todayStr = new Date().toISOString().split('T')[0];

      execute(`
        INSERT INTO leave_requests (
          id, request_code, student_id, category, reason, destination_name, destination_lat, destination_lng,
          leave_date, allowed_start_time, allowed_end_time, current_step, overall_status,
          step1_teacher_id, step2_advisor_id, step3_dept_head_id, step4_discipline_id, step5_deputy_id
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, 1, 'pending',
          ?, ?, ?, ?, ?
        )
      `,
        newId, requestCode, student_id, ext.category, ext.reason, ext.destination_name, ext.destination_lat, ext.destination_lng,
        todayStr, ext.allowed_start_time, ext.allowed_end_time,
        'user-t-atthamed', student?.advisor_teacher_id || 'user-t-atthamed', student?.head_teacher_id || 'user-head-pattana', 'user-discipline-01', 'user-deputy-chaiyot'
      );

      createdRequest = (queryOne<LeaveRequest>(`SELECT * FROM leave_requests WHERE id = ?`, newId)) || null;
    }

    return NextResponse.json({
      success: true,
      reply: aiResult.replyMessage,
      request: createdRequest,
      poweredBy: usedModel ? `Google Gemini AI (${usedModel})` : (activeApiKey ? 'Google Gemini AI' : 'Smart Gate AI Assistant'),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
