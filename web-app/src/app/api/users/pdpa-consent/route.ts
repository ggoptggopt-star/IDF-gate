import { NextRequest, NextResponse } from 'next/server';
import { execute, queryOne } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { user_id, consent, initial_lat, initial_lng } = await req.json();

    if (!user_id) {
      return NextResponse.json({ success: false, error: 'กรุณาระบุ user_id' }, { status: 400 });
    }

    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    if (initial_lat && initial_lng) {
      execute(`
        UPDATE users 
        SET pdpa_consented = ?, 
            pdpa_consented_at = ?,
            home_lat = COALESCE(home_lat, ?),
            home_lng = COALESCE(home_lng, ?)
        WHERE id = ?
      `, consent ? 1 : 0, consent ? nowStr : null, initial_lat, initial_lng, user_id);
    } else {
      execute(`
        UPDATE users 
        SET pdpa_consented = ?, pdpa_consented_at = ?
        WHERE id = ?
      `, consent ? 1 : 0, consent ? nowStr : null, user_id);
    }

    const updated = queryOne(`SELECT id, username, full_name, role, pdpa_consented, pdpa_consented_at, home_lat, home_lng FROM users WHERE id = ?`, user_id);
    return NextResponse.json({ success: true, user: updated });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
