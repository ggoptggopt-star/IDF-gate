import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { User } from '@/types';

export async function GET() {
  try {
    const users = query<User>(`
      SELECT 
        u.id, u.username, u.full_name, u.role, u.class_group_id, u.department_id,
        u.phone, u.email, u.avatar_url,
        cg.group_code, cg.level,
        d.name as department_name
      FROM users u
      LEFT JOIN class_groups cg ON u.class_group_id = cg.id
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE u.is_active = 1
      ORDER BY 
        CASE u.role
          WHEN 'student' THEN 1
          WHEN 'subject_teacher' THEN 2
          WHEN 'advisor' THEN 3
          WHEN 'dept_head' THEN 4
          WHEN 'discipline' THEN 5
          WHEN 'deputy_director' THEN 6
          WHEN 'guard' THEN 7
          WHEN 'admin' THEN 8
        END,
        u.username ASC
    `);

    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
