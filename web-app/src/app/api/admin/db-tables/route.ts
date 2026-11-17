import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';

const TABLES_INFO: { [key: string]: { thaiName: string; desc: string } } = {
  departments: { thaiName: 'แผนกวิชา', desc: 'ข้อมูลแผนกวิชาเทคโนโลยีธุรกิจดิจิทัล' },
  class_groups: { thaiName: 'กลุ่มเรียน / ห้องเรียน', desc: 'ห้องเรียน ปวช.1 ถึง ปวส.2 และครูที่ปรึกษา' },
  users: { thaiName: 'ผู้ใช้งานระบบ (8 บทบาท)', desc: 'นักศึกษา, ครูผู้สอน, ผู้บริหาร, รปภ., แอดมิน' },
  courses_schedule: { thaiName: 'ตารางสอนและรายวิชา', desc: 'ตารางสอนจริง ภาคเรียนที่ 2/2569 สำหรับผูกครูขั้นที่ 1' },
  face_embeddings: { thaiName: 'ข้อมูลใบหน้า AI (512 มิติ)', desc: 'เวกเตอร์คุณลักษณะใบหน้าสำหรับ AI Face Recognition' },
  leave_requests: { thaiName: 'ใบคำร้องขออนุญาตออก', desc: 'ข้อมูลขอออก, ผลอนุมัติ 5 ขั้นตอน และพิกัดเช็คอิน GPS' },
  gate_exit_logs: { thaiName: 'ประวัติการผ่านไม้กั้น (Audit Log)', desc: 'บันทึกเวลาเปิดไม้กั้น ขาออก/ขากลับ และค่าความแม่นยำ AI' },
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const tableName = searchParams.get('table');

    // 1. Get summary of all 7 tables
    const tableSummaries = Object.keys(TABLES_INFO).map((name) => {
      try {
        const countRow = query<{ c: number }>(`SELECT COUNT(*) as c FROM ${name}`)[0];
        return {
          name,
          thaiName: TABLES_INFO[name].thaiName,
          desc: TABLES_INFO[name].desc,
          count: countRow ? countRow.c : 0,
        };
      } catch (e) {
        return {
          name,
          thaiName: TABLES_INFO[name].thaiName,
          desc: TABLES_INFO[name].desc,
          count: 0,
        };
      }
    });

    // 2. If specific table requested, return schema and rows
    if (tableName && TABLES_INFO[tableName]) {
      const tableData = query(`SELECT * FROM ${tableName} ORDER BY rowid DESC`);
      // Get column names
      const columns = tableData.length > 0 ? Object.keys(tableData[0]) : [];

      return NextResponse.json({
        success: true,
        tables: tableSummaries,
        currentTable: {
          name: tableName,
          thaiName: TABLES_INFO[tableName].thaiName,
          desc: TABLES_INFO[tableName].desc,
          columns,
          rows: tableData,
          total: tableData.length,
        },
      });
    }

    return NextResponse.json({
      success: true,
      tables: tableSummaries,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
