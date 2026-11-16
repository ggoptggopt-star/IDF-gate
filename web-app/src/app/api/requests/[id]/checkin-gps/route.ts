import { NextRequest, NextResponse } from 'next/server';
import { queryOne, execute } from '@/lib/db';

function calculateHaversineDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c * 10) / 10;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { lat, lng } = await req.json();

    if (lat === undefined || lng === undefined) {
      return NextResponse.json({ success: false, error: 'กรุณาระบุพิกัด GPS (lat, lng)' }, { status: 400 });
    }

    const request = queryOne(`SELECT * FROM leave_requests WHERE id = ?`, id);
    if (!request) {
      return NextResponse.json({ success: false, error: 'ไม่พบใบคำร้องขออนุญาต' }, { status: 404 });
    }

    // Default target coords if not explicitly set (e.g. Ongkharak Hospital: 14.1350, 100.9920)
    const targetLat = request.destination_lat || 14.1350;
    const targetLng = request.destination_lng || 100.9920;

    const distanceMeters = calculateHaversineDistanceMeters(lat, lng, targetLat, targetLng);
    
    // Geofencing radius threshold (e.g. 300 meters)
    const isVerified = distanceMeters <= 300 ? 1 : 0;
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    execute(`
      UPDATE leave_requests
      SET 
        checkin_lat = ?,
        checkin_lng = ?,
        checkin_at = ?,
        checkin_distance_m = ?,
        checkin_verified = ?,
        updated_at = ?
      WHERE id = ?
    `, lat, lng, nowStr, distanceMeters, isVerified, nowStr, id);

    const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

    return NextResponse.json({
      success: true,
      message: isVerified ? 'เช็คอินพิกัดปลายทางสำเร็จตรงตามสถานที่' : 'เช็คอินแล้ว (อยู่นอกรัศมีสถานที่ปลายทาง)',
      checkin: {
        lat,
        lng,
        checkin_at: nowStr,
        distance_m: distanceMeters,
        verified: Boolean(isVerified),
        maps_url: mapsUrl,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
