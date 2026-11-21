import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@/lib/db';
import { LeaveRequest } from '@/types';
import { sendPushToUsers } from '@/lib/webPushServer';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get('student_id');
    const status = searchParams.get('status');

    let sql = `
      SELECT 
        lr.*,
        u.full_name as student_name,
        u.username as student_code,
        cg.group_code,
        cs.course_name
      FROM leave_requests lr
      JOIN users u ON lr.student_id = u.id
      LEFT JOIN class_groups cg ON u.class_group_id = cg.id
      LEFT JOIN courses_schedule cs ON lr.course_id = cs.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (studentId) {
      sql += ' AND lr.student_id = ?';
      params.push(studentId);
    }

    if (status) {
      sql += ' AND lr.overall_status = ?';
      params.push(status);
    }

    sql += ' ORDER BY lr.created_at DESC';

    const requests = query<LeaveRequest>(sql, ...params);
    return NextResponse.json({ success: true, requests });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      student_id,
      course_id,
      category,
      reason,
      destination_name,
      destination_lat,
      destination_lng,
      attachment_path,
      leave_date,
      allowed_start_time,
      allowed_end_time,
      is_return_required,
    } = body;

    if (!student_id || !reason) {
      return NextResponse.json({ success: false, error: 'กรุณาระบุข้อมูลนักศึกษาและเหตุผลที่ขออนุญาต' }, { status: 400 });
    }

    // Lookup student and class group
    const student = queryOne(`
      SELECT u.*, cg.advisor_teacher_id, d.head_teacher_id
      FROM users u
      LEFT JOIN class_groups cg ON u.class_group_id = cg.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.id = ?
    `, student_id);

    if (!student) {
      return NextResponse.json({ success: false, error: 'ไม่พบข้อมูลนักศึกษา' }, { status: 404 });
    }

    // Lookup course teacher for Step 1
    let validCourseId: string | null = null;
    let step1TeacherId: string | null = null;
    if (course_id) {
      const course = queryOne(`SELECT id, teacher_id FROM courses_schedule WHERE id = ?`, course_id);
      if (course) {
        validCourseId = course.id;
        step1TeacherId = course.teacher_id;
      }
    }
    // Fallback if no course is specified or course not found
    if (!validCourseId) {
      const defaultCourse = queryOne(`SELECT id, teacher_id FROM courses_schedule WHERE class_group_id = ? LIMIT 1`, student.class_group_id) 
        || queryOne(`SELECT id, teacher_id FROM courses_schedule LIMIT 1`);
      if (defaultCourse) {
        validCourseId = defaultCourse.id;
        step1TeacherId = defaultCourse.teacher_id;
      } else {
        step1TeacherId = 'user-t-atthamed';
      }
    }

    const step2AdvisorId = student.advisor_teacher_id || 'user-t-atthamed';
    const step3DeptHeadId = student.head_teacher_id || 'user-head-pattana';
    const step4DisciplineId = 'user-discipline-01';
    const step5DeputyId = 'user-deputy-chaiyot';

    // Generate request code e.g. #GP-2569-090
    const countRow = queryOne(`SELECT COUNT(*) as count FROM leave_requests`);
    const nextSeq = (countRow ? countRow.count : 0) + 85;
    const requestCode = `#GP-2569-${String(nextSeq).padStart(3, '0')}`;
    const newId = `req-${Date.now()}`;

    const todayStr = leave_date || new Date().toISOString().split('T')[0];
    const startTimeStr = allowed_start_time || '12:30';
    const endTimeStr = allowed_end_time || '15:30';
    const isReturnRequired = is_return_required !== undefined 
      ? (is_return_required ? 1 : 0) 
      : (endTimeStr.includes('ไม่กลับ') ? 0 : 1);

    execute(`
      INSERT INTO leave_requests (
        id, request_code, student_id, course_id, category, reason, destination_name, destination_lat, destination_lng, attachment_path,
        leave_date, allowed_start_time, allowed_end_time, current_step, overall_status,
        step1_teacher_id, step2_advisor_id, step3_dept_head_id, step4_discipline_id, step5_deputy_id,
        is_return_required, trip_stage
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, 1, 'pending',
        ?, ?, ?, ?, ?,
        ?, 'not_started'
      )
    `,
      newId, requestCode, student_id, validCourseId, category || 'personal', reason,
      destination_name || 'นอกสถานศึกษา', destination_lat || 14.1350, destination_lng || 100.9920, attachment_path || null,
      todayStr, startTimeStr, endTimeStr,
      step1TeacherId, step2AdvisorId, step3DeptHeadId, step4DisciplineId, step5DeputyId,
      isReturnRequired
    );

    const created = queryOne(`
      SELECT 
        lr.*,
        u.full_name as student_name,
        u.username as student_code,
        cg.group_code,
        cs.course_name
      FROM leave_requests lr
      JOIN users u ON lr.student_id = u.id
      LEFT JOIN class_groups cg ON u.class_group_id = cg.id
      LEFT JOIN courses_schedule cs ON lr.course_id = cs.id
      WHERE lr.id = ?
    `, newId);

    if (step1TeacherId) {
      sendPushToUsers([step1TeacherId], {
        title: `🔔 มีคำร้องขอออกใหม่: ${student.full_name}`,
        body: `${reason} • ${destination_name || 'นอกสถานศึกษา'} (รออนุมัติขั้นที่ 1)`,
        url: '/chat',
        tag: `req-${newId}-step-1`,
      }).catch(() => {});
    }

    return NextResponse.json({ success: true, request: created });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
