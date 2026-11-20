import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute } from '@/lib/db';
import { LeaveRequest } from '@/types';
import { sendPushToUsers } from '@/lib/webPushServer';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { action, remark, approver_id, approver_role } = body;

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ success: false, error: 'กรุณาระบุ action เป็น approve หรือ reject' }, { status: 400 });
    }

    const request = queryOne<LeaveRequest>(`SELECT * FROM leave_requests WHERE id = ?`, id);
    if (!request) {
      return NextResponse.json({ success: false, error: 'ไม่พบคำร้องขออนุญาต' }, { status: 404 });
    }

    const currentStep = request.current_step;
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    if (action === 'reject') {
      const stepColStatus = `step${currentStep}_status`;
      const stepColRemark = `step${currentStep}_remark`;
      const stepColActed = `step${currentStep}_acted_at`;
      const stepColApprover = `step${currentStep}_${
        currentStep === 1 ? 'teacher_id' : currentStep === 2 ? 'advisor_id' : currentStep === 3 ? 'dept_head_id' : currentStep === 4 ? 'discipline_id' : 'deputy_id'
      }`;

      execute(`
        UPDATE leave_requests
        SET 
          overall_status = 'rejected',
          ${stepColStatus} = 'rejected',
          ${stepColRemark} = ?,
          ${stepColActed} = ?,
          ${stepColApprover} = COALESCE(${stepColApprover}, ?),
          updated_at = ?
        WHERE id = ?
      `, remark || 'ไม่อนุญาต', nowStr, approver_id || null, nowStr, id);

      const updated = queryOne(`SELECT * FROM leave_requests WHERE id = ?`, id);

      // Background push to student (works when app is closed)
      sendPushToUsers([request.student_id], {
        title: '❌ คำร้องขอออกไม่ได้รับการอนุมัติ',
        body: `เหตุผล: ${remark || 'ไม่อนุมัติตามระเบียบ'} (ติดต่อครูที่ปรึกษา)`,
        url: '/chat',
        tag: `rejected-${id}`,
      }).catch(() => {});

      return NextResponse.json({ success: true, message: 'บันทึกการไม่อนุมัติเรียบร้อย', request: updated });
    }

    // Action === 'approve'
    const stepColStatus = `step${currentStep}_status`;
    const stepColRemark = `step${currentStep}_remark`;
    const stepColActed = `step${currentStep}_acted_at`;
    const stepColApprover = `step${currentStep}_${
      currentStep === 1 ? 'teacher_id' : currentStep === 2 ? 'advisor_id' : currentStep === 3 ? 'dept_head_id' : currentStep === 4 ? 'discipline_id' : 'deputy_id'
    }`;

    if (currentStep < 5) {
      // Advance to next step
      const nextStep = currentStep + 1;
      execute(`
        UPDATE leave_requests
        SET 
          current_step = ?,
          ${stepColStatus} = 'approved',
          ${stepColRemark} = ?,
          ${stepColActed} = ?,
          ${stepColApprover} = COALESCE(${stepColApprover}, ?),
          updated_at = ?
        WHERE id = ?
      `, nextStep, remark || 'อนุมัติผ่านเกณฑ์', nowStr, approver_id || null, nowStr, id);

      // Background Push to Next Approver (works even when browser is closed)
      const nextApproverId =
        nextStep === 2
          ? request.step2_advisor_id || 'user-t-thanaphisit'
          : nextStep === 3
          ? request.step3_dept_head_id || 'user-head-pattana'
          : nextStep === 4
          ? request.step4_discipline_id || 'user-discipline-01'
          : 'user-deputy-chaiyot';

      sendPushToUsers([nextApproverId], {
        title: `🔔 ส่งต่อถึงท่าน (ขั้นที่ ${nextStep}/5): ${request.destination_name}`,
        body: `${request.reason} (ผ่านการอนุมัติขั้นที่ ${currentStep} แล้ว)`,
        url: '/chat',
        tag: `req-${id}-step-${nextStep}`,
      }).catch(() => {});

      // Background Push to Student
      sendPushToUsers([request.student_id], {
        title: `⚡ คำร้องผ่านการอนุมัติขั้นที่ ${currentStep}/5 แล้ว`,
        body: `กำลังส่งต่อไปยังขั้นที่ ${nextStep} (${request.destination_name})`,
        url: '/chat',
        tag: `student-progress-${id}-${nextStep}`,
      }).catch(() => {});
    } else {
      // Step 5 (Deputy Director) -> Final Sign-off & sync to gate!
      execute(`
        UPDATE leave_requests
        SET 
          current_step = 6,
          overall_status = 'approved',
          synced_to_gate = 1,
          ${stepColStatus} = 'approved',
          ${stepColRemark} = ?,
          ${stepColActed} = ?,
          ${stepColApprover} = COALESCE(${stepColApprover}, ?),
          updated_at = ?
        WHERE id = ?
      `, remark || 'อนุมัติขั้นสุดท้าย อนุญาตให้ออกนอกสถานศึกษาได้', nowStr, approver_id || null, nowStr, id);

      // Push to Guard
      sendPushToUsers(['user-guard-gate1'], {
        title: '🚗 ป้อมยาม: มีนักเรียนได้รับอนุมัติผ่านครบ 5 ขั้นแล้ว!',
        body: `คำร้อง #${request.request_code} ได้รับสิทธิ์สแกนหน้าเปิดไม้กั้น`,
        url: '/gate',
        tag: `gate-${id}`,
      }).catch(() => {});

      // Push to Student
      sendPushToUsers([request.student_id], {
        title: '🎉 คำร้องขอออกได้รับอนุมัติครบ 5 ขั้นแล้ว!',
        body: `ระบบส่งสิทธิ์เข้าป้อมยามแล้ว สแกนหน้าเปิดไม้กั้นได้เลย (${request.destination_name})`,
        url: '/gate',
        tag: `approved-${id}`,
      }).catch(() => {});
    }

    const updated = queryOne(`SELECT * FROM leave_requests WHERE id = ?`, id);
    return NextResponse.json({
      success: true,
      message: currentStep === 5 ? 'อนุมัติขั้นสุดท้ายเรียบร้อย ระบบได้ส่งสิทธิ์เข้าป้อมยามทันที!' : `อนุมัติขั้นที่ ${currentStep} สำเร็จ ส่งต่อขั้นที่ ${currentStep + 1}`,
      request: updated,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
