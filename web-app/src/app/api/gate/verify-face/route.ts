import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute } from '@/lib/db';
import { LeaveRequest } from '@/types';
import { sendPushToUsers } from '@/lib/webPushServer';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      student_id,
      direction = 'exit', // 'exit' or 'return'
      similarity_score = 0.945,
      trigger_type = 'ai_auto',
      guard_id,
      mock_scenario, // 'A', 'B', 'C', 'D' for quick demo selection
    } = body;

    let targetStudentId = student_id;

    // Handle mock scenarios
    if (mock_scenario === 'A') {
      targetStudentId = 'user-stu-akkaracha';
    } else if (mock_scenario === 'B') {
      targetStudentId = 'user-stu-nattaphon';
    } else if (mock_scenario === 'D') {
      targetStudentId = 'user-stu-vc3-demo';
    }

    if (!targetStudentId) {
      return NextResponse.json({ success: false, authorized: false, reason: 'ไม่พบข้อมูลใบหน้าในระบบ' }, { status: 400 });
    }

    // Lookup student
    const student = queryOne(`
      SELECT u.*, cg.group_code
      FROM users u
      LEFT JOIN class_groups cg ON u.class_group_id = cg.id
      WHERE u.id = ?
    `, targetStudentId);

    if (!student) {
      return NextResponse.json({ success: false, authorized: false, reason: 'ไม่พบบัญชีนักศึกษาในระบบ' }, { status: 404 });
    }

    // Find active leave request for this student
    const request = queryOne<LeaveRequest>(`
      SELECT * FROM leave_requests 
      WHERE student_id = ?
      ORDER BY created_at DESC 
      LIMIT 1
    `, targetStudentId);

    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const newLogId = `log-${Date.now()}`;

    // Authorization evaluation based on direction:
    let isAuthorized = false;
    let reasonText = 'คำร้องยังไม่ได้รับการอนุมัติครบ 5 ขั้นตอน';

    if (direction === 'exit') {
      // Exit scan requirements:
      if (request && request.overall_status === 'approved' && request.synced_to_gate === 1) {
        isAuthorized = true;
      } else if (!request) {
        reasonText = 'ไม่พบประวัติการยื่นคำร้องขออนุญาตออกนอกสถานศึกษา';
      } else if (request.overall_status === 'completed_exit') {
        reasonText = 'นักศึกษาได้สแกนผ่านประตูขาออกไปแล้ว (สถานะ: ออกนอกสถานศึกษาแล้ว)';
      } else if (request.overall_status === 'returned') {
        reasonText = 'คำร้องนี้สิ้นสุดการเดินทางเรียบร้อยแล้ว (รายงานตัวกลับแล้ว)';
      } else if (request.overall_status === 'rejected') {
        reasonText = `คำร้องถูกปฏิเสธ: ${request.step1_remark || 'ไม่อนุญาต'}`;
      } else if (request.overall_status === 'pending') {
        reasonText = `คำร้องอยู่ระหว่างการพิจารณา (ขั้นที่ ${request.current_step}/5)`;
      }
    } else {
      // Return scan requirements:
      if (request && (request.overall_status === 'completed_exit' || (request.overall_status === 'approved' && request.synced_to_gate === 1))) {
        if (request.is_return_required === 0) {
          reasonText = 'คำร้องนี้ระบุไม่ต้องเดินทางกลับเข้าสถานศึกษา (ออกยาว/กลับบ้าน)';
        } else {
          isAuthorized = true;
        }
      } else if (!request) {
        reasonText = 'ไม่พบประวัติการยื่นคำร้องขออนุญาต';
      } else if (request.overall_status === 'returned') {
        reasonText = 'นักศึกษาได้รายงานตัวกลับเข้าสถานศึกษาเรียบร้อยแล้ว';
      } else if (request.overall_status === 'rejected') {
        reasonText = `คำร้องถูกปฏิเสธ: ${request.step1_remark || 'ไม่อนุญาต'}`;
      } else if (request.overall_status === 'pending') {
        reasonText = `คำร้องอยู่ระหว่างการพิจารณา (ขั้นที่ ${request.current_step}/5)`;
      } else {
        reasonText = 'ไม่พบประวัติการสแกนขาออก หรือคำร้องไม่ถูกต้อง';
      }
    }

    if (!isAuthorized || !request) {
      return NextResponse.json({
        success: true,
        authorized: false,
        reason: reasonText,
        similarity_score,
        student: {
          id: student.id,
          full_name: student.full_name,
          student_code: student.username,
          group_code: student.group_code,
        },
        request: request || null,
      });
    }

    // Student IS authorized!
    // Update request status based on direction:
    const nextStatus = direction === 'exit' ? 'completed_exit' : 'returned';
    const nextTripStage = direction === 'exit' ? 'heading_to_dest' : 'completed';

    execute(`
      UPDATE leave_requests
      SET overall_status = ?,
          trip_stage = ?,
          return_arrived_at = CASE WHEN ? = 'return' THEN ? ELSE return_arrived_at END,
          updated_at = ?
      WHERE id = ?
    `, nextStatus, nextTripStage, direction, nowStr, nowStr, request.id);

    // Insert log
    execute(`
      INSERT INTO gate_exit_logs (
        id, request_id, student_id, direction, gps_lat, gps_lng, similarity_score, trigger_type, triggered_by_guard_id, gate_opened_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `,
      newLogId,
      request.id,
      student.id,
      direction,
      14.1285,
      100.9985,
      similarity_score,
      trigger_type,
      guard_id || null,
      nowStr
    );

    // Push background notification to student and related approvers
    const notifTitle = direction === 'exit'
      ? `🚪 ไม้กั้นเปิด: นักศึกษาเดินทางออกนอกสถานศึกษาแล้ว`
      : `🏁 ไม้กั้นเปิด: นักศึกษารายงานตัวกลับเข้าสถานศึกษาแล้ว`;
    const notifBody = `${student.full_name} (${student.username}) สแกนใบหน้าสำเร็จ (${(similarity_score * 100).toFixed(1)}%) รหัส: ${request.request_code}`;

    const involvedUsers = [
      student.id,
      request.step1_teacher_id,
      request.step2_advisor_id,
      request.step4_discipline_id,
      'user-guard-01',
    ].filter(Boolean) as string[];

    sendPushToUsers(involvedUsers, {
      title: notifTitle,
      body: notifBody,
      url: `/gate`,
      tag: `gate-${direction}-${request.id}`,
    }).catch((e) => console.error('Push error on gate verification:', e));

    return NextResponse.json({
      success: true,
      authorized: true,
      message: direction === 'exit' ? 'อนุญาตให้ออกนอกสถานศึกษาได้ ไม้กั้นกำลังเปิด' : 'รายงานตัวกลับเข้าสถานศึกษาสำเร็จ ไม้กั้นกำลังเปิด',
      similarity_score,
      student: {
        id: student.id,
        full_name: student.full_name,
        student_code: student.username,
        group_code: student.group_code,
      },
      request: {
        ...request,
        overall_status: nextStatus,
        trip_stage: nextTripStage,
      },
      direction,
      gate_opened_at: nowStr,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
