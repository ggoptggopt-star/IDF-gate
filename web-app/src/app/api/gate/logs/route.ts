import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import { GateExitLog } from '@/types';

export async function GET() {
  try {
    const logs = query<GateExitLog>(`
      SELECT 
        gel.*,
        u.full_name as student_name,
        lr.request_code
      FROM gate_exit_logs gel
      LEFT JOIN users u ON gel.student_id = u.id
      LEFT JOIN leave_requests lr ON gel.request_id = lr.id
      ORDER BY gel.gate_opened_at DESC
      LIMIT 20
    `);

    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { guard_id, reason = 'คำสั่งฉุกเฉินเจ้าหน้าที่ รปภ. (Manual Release)' } = body;

    const newId = `log-manual-${Date.now()}`;
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    execute(`
      INSERT INTO gate_exit_logs (
        id, request_id, student_id, direction, gps_lat, gps_lng, similarity_score, trigger_type, triggered_by_guard_id, gate_opened_at
      ) VALUES (
        ?, NULL, NULL, 'exit', 14.1285, 100.9985, 1.0, 'guard_manual', ?, ?
      )
    `, newId, guard_id || 'user-guard-gate1', nowStr);

    return NextResponse.json({
      success: true,
      message: 'เปิดไม้กั้นฉุกเฉินเรียบร้อย (Manual Override Pulse 0.5s)',
      gate_opened_at: nowStr,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
