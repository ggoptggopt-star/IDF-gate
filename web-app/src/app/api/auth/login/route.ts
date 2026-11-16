import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { User } from '@/types';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username) {
      return NextResponse.json({ success: false, error: 'กรุณากรอกรหัสนักศึกษาหรือบุคลากร' }, { status: 400 });
    }

    const user = queryOne<User>(`
      SELECT 
        u.id, u.username, u.full_name, u.role, u.class_group_id, u.department_id,
        u.phone, u.email, u.avatar_url,
        cg.group_code, cg.level,
        d.name as department_name
      FROM users u
      LEFT JOIN class_groups cg ON u.class_group_id = cg.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE (u.username = ? OR u.full_name LIKE ?) AND u.is_active = 1
    `, username.trim(), `%${username.trim()}%`);

    if (!user) {
      return NextResponse.json({ success: false, error: 'ไม่พบบัญชีผู้ใช้งานในระบบ' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'เข้าสู่ระบบสำเร็จ',
      user,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
