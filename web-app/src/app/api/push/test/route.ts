import { NextRequest, NextResponse } from 'next/server';
import { sendPushToUsers, broadcastPush } from '@/lib/webPushServer';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { user_id } = body;

    const payload = {
      title: '🔔 ทดสอบ Background Push บนมือถือ!',
      body: 'การแจ้งเตือนทำงานได้จริง แม้จะปิดเว็บหรือล็อกหน้าจออยู่ (Smart Gate Pass AI)',
      url: '/chat',
      tag: `test-${Date.now()}`,
    };

    let result;
    if (user_id) {
      result = await sendPushToUsers([user_id], payload);
    } else {
      result = await broadcastPush(payload);
    }

    return NextResponse.json({
      success: true,
      result,
      message: `ส่งการแจ้งเตือน Push สำเร็จ ${result.success} เครื่อง (ล้มเหลว ${result.failed})`,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
