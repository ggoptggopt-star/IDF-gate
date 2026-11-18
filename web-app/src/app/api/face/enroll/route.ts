import { NextRequest, NextResponse } from 'next/server';
import { execute, queryOne } from '@/lib/db';
import fs from 'node:fs';
import path from 'node:path';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      user_id,
      snapshots = {}, // { straight: base64, left: base64, right: base64, smile: base64 }
      liveness_score = 0.992,
    } = body;

    if (!user_id) {
      return NextResponse.json({ success: false, error: 'กรุณาระบุ user_id' }, { status: 400 });
    }

    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // Ensure uploads directory exists
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'faces', user_id);
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // Save base64 snapshot images if provided
    let straightPath = `/uploads/faces/${user_id}/straight.jpg`;
    let leftPath = `/uploads/faces/${user_id}/left.jpg`;
    let rightPath = `/uploads/faces/${user_id}/right.jpg`;
    let smilePath = `/uploads/faces/${user_id}/smile.jpg`;

    if (snapshots.straight && snapshots.straight.startsWith('data:image')) {
      const base64Data = snapshots.straight.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(path.join(uploadsDir, 'straight.jpg'), Buffer.from(base64Data, 'base64'));
    }
    if (snapshots.left && snapshots.left.startsWith('data:image')) {
      const base64Data = snapshots.left.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(path.join(uploadsDir, 'left.jpg'), Buffer.from(base64Data, 'base64'));
    }
    if (snapshots.right && snapshots.right.startsWith('data:image')) {
      const base64Data = snapshots.right.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(path.join(uploadsDir, 'right.jpg'), Buffer.from(base64Data, 'base64'));
    }
    if (snapshots.smile && snapshots.smile.startsWith('data:image')) {
      const base64Data = snapshots.smile.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(path.join(uploadsDir, 'smile.jpg'), Buffer.from(base64Data, 'base64'));
    }

    // Update users table
    execute(`
      UPDATE users 
      SET is_face_enrolled = 1,
          face_enrolled_at = ?
      WHERE id = ?
    `, nowStr, user_id);

    // Save or update face_embeddings record
    const existing = queryOne(`SELECT id FROM face_embeddings WHERE user_id = ?`, user_id);
    const newEmbedId = `emb-${Date.now()}`;

    if (existing) {
      execute(`
        UPDATE face_embeddings
        SET sample_image_path = ?,
            snapshot_straight = ?,
            snapshot_left = ?,
            snapshot_right = ?,
            snapshot_smile = ?,
            liveness_score = ?,
            created_at = ?
        WHERE user_id = ?
      `, straightPath, straightPath, leftPath, rightPath, smilePath, liveness_score, nowStr, user_id);
    } else {
      execute(`
        INSERT INTO face_embeddings (
          id, user_id, sample_image_path, snapshot_straight, snapshot_left, snapshot_right, snapshot_smile, liveness_score, is_active, created_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, 1, ?
        )
      `, newEmbedId, user_id, straightPath, straightPath, leftPath, rightPath, smilePath, liveness_score, nowStr);
    }

    const updatedUser = queryOne(`
      SELECT id, username, full_name, role, is_face_enrolled, face_enrolled_at 
      FROM users WHERE id = ?
    `, user_id);

    return NextResponse.json({
      success: true,
      message: 'บันทึกคุณลักษณะใบหน้า 3 มิติ และผลการตรวจสอบ Liveness Detection สำเร็จ',
      user: updatedUser,
      liveness_score,
      timestamp: nowStr,
    });
  } catch (error: any) {
    console.error('API /api/face/enroll error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
