import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute } from '@/lib/db';
import { LeaveRequest } from '@/types';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const request = queryOne<LeaveRequest>(`
      SELECT lr.*, u.full_name as student_name, u.username as student_code, u.avatar_url, cg.group_code, cs.course_name
      FROM leave_requests lr
      JOIN users u ON lr.student_id = u.id
      LEFT JOIN class_groups cg ON u.class_group_id = cg.id
      LEFT JOIN courses_schedule cs ON lr.course_id = cs.id
      WHERE lr.id = ?
    `, id);

    if (!request) {
      return NextResponse.json({ success: false, error: 'ไม่พบข้อมูลคำร้อง' }, { status: 404 });
    }

    // Retrieve latest GPS location if available
    const latestLoc = queryOne<{ lat: number; lng: number; recorded_at: string; speed: number; heading: number }>(`
      SELECT lat, lng, recorded_at, speed, heading
      FROM live_locations
      WHERE request_id = ?
      ORDER BY recorded_at DESC, id DESC
      LIMIT 1
    `, id);

    if (latestLoc) {
      request.current_lat = latestLoc.lat;
      request.current_lng = latestLoc.lng;
    }

    return NextResponse.json({
      success: true,
      request,
      latestLoc: latestLoc || null
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const {
      action, // 'arrive_dest' | 'start_return' | 'arrive_college' | 'complete_trip' | 'ping_gps'
      lat,
      lng,
      speed,
      heading,
      photo_url,
    } = body;

    const request = queryOne<LeaveRequest>(`SELECT * FROM leave_requests WHERE id = ?`, id);
    if (!request) {
      return NextResponse.json({ success: false, error: 'ไม่พบข้อมูลคำร้อง' }, { status: 404 });
    }

    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // Save GPS ping if coords provided
    if (lat && lng) {
      execute(`
        INSERT INTO live_locations (id, request_id, student_id, lat, lng, speed, heading, recorded_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, `loc-${Date.now()}`, request.id, request.student_id, lat, lng, speed || 0, heading || 0, nowStr);

      execute(`
        UPDATE leave_requests
        SET current_lat = ?, current_lng = ?, updated_at = ?
        WHERE id = ?
      `, lat, lng, nowStr, request.id);
    }

    if (action === 'arrive_dest') {
      // Reached destination
      execute(`
        UPDATE leave_requests
        SET trip_stage = 'at_dest',
            dest_arrived_at = ?,
            checkin_lat = ?,
            checkin_lng = ?,
            checkin_at = ?,
            checkin_verified = 1,
            dest_checkin_photo_path = COALESCE(?, dest_checkin_photo_path),
            updated_at = ?
        WHERE id = ?
      `, nowStr, lat || request.destination_lat, lng || request.destination_lng, nowStr, photo_url || null, nowStr, request.id);
    } else if (action === 'start_return') {
      // Returning to college
      execute(`
        UPDATE leave_requests
        SET trip_stage = 'heading_back',
            updated_at = ?
        WHERE id = ?
      `, nowStr, request.id);
    } else if (action === 'arrive_college') {
      // Reached college (Round Trip complete)
      execute(`
        UPDATE leave_requests
        SET trip_stage = 'completed',
            overall_status = 'returned',
            return_arrived_at = ?,
            return_checkin_photo_path = COALESCE(?, return_checkin_photo_path),
            updated_at = ?
        WHERE id = ?
      `, nowStr, photo_url || null, nowStr, request.id);
    } else if (action === 'complete_trip') {
      // One-way Trip complete (e.g. reached home)
      execute(`
        UPDATE leave_requests
        SET trip_stage = 'completed',
            overall_status = 'completed_exit',
            dest_arrived_at = ?,
            checkin_lat = ?,
            checkin_lng = ?,
            checkin_at = ?,
            checkin_verified = 1,
            dest_checkin_photo_path = COALESCE(?, dest_checkin_photo_path),
            updated_at = ?
        WHERE id = ?
      `, nowStr, lat || request.destination_lat, lng || request.destination_lng, nowStr, photo_url || null, nowStr, request.id);
    }

    const updated = queryOne<LeaveRequest>(`
      SELECT lr.*, u.full_name as student_name, u.username as student_code, u.avatar_url, cg.group_code, cs.course_name
      FROM leave_requests lr
      JOIN users u ON lr.student_id = u.id
      LEFT JOIN class_groups cg ON u.class_group_id = cg.id
      LEFT JOIN courses_schedule cs ON lr.course_id = cs.id
      WHERE lr.id = ?
    `, id);

    return NextResponse.json({ success: true, request: updated, action });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
