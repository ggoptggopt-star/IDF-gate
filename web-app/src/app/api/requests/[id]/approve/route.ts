import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute } from '@/lib/db';
import { LeaveRequest } from '@/types';

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
