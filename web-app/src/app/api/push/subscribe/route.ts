import { NextRequest, NextResponse } from 'next/server';
import { execute, queryOne } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id, subscription } = body;

    if (!user_id || !subscription || !subscription.endpoint || !subscription.keys) {
      return NextResponse.json(
        { success: false, error: 'ข้อมูล subscription ไม่ครบถ้วน' },
        { status: 400 }
      );
    }

    const { endpoint, keys } = subscription;
    const { p256dh, auth } = keys;
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    const existing = queryOne(`SELECT id FROM push_subscriptions WHERE endpoint = ?`, endpoint);
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    if (existing) {
      execute(
        `UPDATE push_subscriptions SET user_id = ?, p256dh = ?, auth = ?, user_agent = ?, updated_at = ? WHERE endpoint = ?`,
        user_id,
        p256dh,
        auth,
        userAgent,
        nowStr,
        endpoint
      );
    } else {
      const id = `push-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      execute(
        `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        user_id,
        endpoint,
        p256dh,
        auth,
        userAgent,
        nowStr,
        nowStr
      );
    }

    return NextResponse.json({
      success: true,
      message: 'บันทึกการสมัครรับการแจ้งเตือน Background Push บนมือถือเรียบร้อยแล้ว',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
