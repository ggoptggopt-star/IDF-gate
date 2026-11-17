import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Fetch all students who have an approved leave request
    const whitelist = query(`
      SELECT 
        u.id as student_id,
        u.username as student_code,
        u.full_name,
        cg.group_code,
        fe.sample_image_path,
        fe.embedding_vector,
        lr.id as request_id,
        lr.request_code,
        lr.reason,
        lr.destination_name,
        lr.allowed_start_time,
        lr.allowed_end_time,
        lr.overall_status
      FROM leave_requests lr
      JOIN users u ON lr.student_id = u.id
      LEFT JOIN class_groups cg ON u.class_group_id = cg.id
      LEFT JOIN face_embeddings fe ON u.id = fe.user_id
      WHERE lr.overall_status = 'approved' AND lr.synced_to_gate = 1
      ORDER BY lr.updated_at DESC
    `);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      count: whitelist.length,
      whitelist,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
