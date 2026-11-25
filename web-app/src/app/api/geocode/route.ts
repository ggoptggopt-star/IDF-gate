import { NextRequest, NextResponse } from 'next/server';
import {
  VERIFIED_LOCATIONS,
  searchVerifiedLocations,
  calcDistanceKm,
  OICEC_COLLEGE,
} from '@/lib/ongkharakLocations';

// Helper: Extract Lat/Lng from Google Maps link
async function resolveGoogleMapsUrl(urlStr: string) {
  try {
    let finalUrl = urlStr;
    if (urlStr.includes('maps.app.goo.gl') || urlStr.includes('goo.gl/maps') || urlStr.includes('bit.ly')) {
      const response = await fetch(urlStr, {
        method: 'HEAD',
        redirect: 'follow',
      });
      finalUrl = response.url || urlStr;
    }

    // Check @lat,lng format: e.g. /@14.1205,101.0020,15z
    const atMatch = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) {
      return {
        lat: parseFloat(atMatch[1]),
        lng: parseFloat(atMatch[2]),
        name: 'ตำแหน่งพิกัดจาก Google Maps',
      };
    }

    // Check ?q=lat,lng or ll=lat,lng
    const qMatch = finalUrl.match(/[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (qMatch) {
      return {
        lat: parseFloat(qMatch[1]),
        lng: parseFloat(qMatch[2]),
        name: 'พิกัดจาก Google Maps',
      };
    }

    // Check !3dlat!4dlng (Google Maps protobuf query params)
    const protoMatch = finalUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    if (protoMatch) {
      return {
        lat: parseFloat(protoMatch[1]),
        lng: parseFloat(protoMatch[2]),
        name: 'สถานที่จาก Google Maps',
      };
    }
  } catch (err) {
    console.warn('Error resolving Google Maps URL:', err);
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = (body.query || '').trim();

    if (!query) {
      return NextResponse.json({
        success: true,
        results: VERIFIED_LOCATIONS.slice(0, 10).map((loc) => ({
          name: loc.name,
          lat: loc.lat,
          lng: loc.lng,
          address: loc.address,
          icon: loc.icon,
          isReturn: loc.isReturn !== undefined ? loc.isReturn : 1,
          distance: calcDistanceKm(OICEC_COLLEGE.lat, OICEC_COLLEGE.lng, loc.lat, loc.lng),
        })),
      });
    }

    // 1. Direct Coordinate Detection (e.g. "14.1091, 101.0624")
    const coordMatch = query.match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      const dist = calcDistanceKm(OICEC_COLLEGE.lat, OICEC_COLLEGE.lng, lat, lng);
      return NextResponse.json({
        success: true,
        results: [
          {
            name: `พิกัดระบุเอง (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
            lat,
            lng,
            address: `ระยะห่างจาก วก.องครักษ์ ${dist} กม.`,
            icon: '📍',
            distance: dist,
          },
        ],
      });
    }

    // 2. Google Maps URL Detection
    if (query.includes('http://') || query.includes('https://') || query.includes('maps.app.goo.gl') || query.includes('google.com/maps')) {
      const urlResult = await resolveGoogleMapsUrl(query);
      if (urlResult) {
        const dist = calcDistanceKm(OICEC_COLLEGE.lat, OICEC_COLLEGE.lng, urlResult.lat, urlResult.lng);
        return NextResponse.json({
          success: true,
          results: [
            {
              name: urlResult.name,
              lat: urlResult.lat,
              lng: urlResult.lng,
              address: `ตำแหน่งจริงจากลิงก์ Google Maps (${dist} กม.)`,
              icon: '📍',
              distance: dist,
            },
          ],
        });
      }
    }

    // 3. Search Curated Verified High-Precision Database
    const matchedVerified = searchVerifiedLocations(query);
    if (matchedVerified.length > 0) {
      return NextResponse.json({
        success: true,
        results: matchedVerified.map((loc) => ({
          name: loc.name,
          lat: loc.lat,
          lng: loc.lng,
          address: loc.address,
          icon: loc.icon,
          isReturn: loc.isReturn !== undefined ? loc.isReturn : 1,
          distance: calcDistanceKm(OICEC_COLLEGE.lat, OICEC_COLLEGE.lng, loc.lat, loc.lng),
        })),
      });
    }

    // 4. OpenStreetMap Nominatim with strict Nakhon Nayok / Ongkharak viewbox bounding
    try {
      const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query + ' นครนายก'
      )}&countrycodes=th&viewbox=100.80,14.30,101.30,13.90&bounded=0&limit=5`;

      const nomRes = await fetch(nomUrl, {
        headers: { 'Accept-Language': 'th,en', 'User-Agent': 'SmartGatePass/1.0' },
      });
      const nomData = await nomRes.json();
      if (Array.isArray(nomData) && nomData.length > 0) {
        const results = nomData.map((item: any) => {
          const lat = parseFloat(item.lat);
          const lng = parseFloat(item.lon);
          const dist = calcDistanceKm(OICEC_COLLEGE.lat, OICEC_COLLEGE.lng, lat, lng);
          return {
            name: item.display_name.split(',')[0] || item.display_name,
            lat,
            lng,
            address: item.display_name,
            icon: '📍',
            distance: dist,
          };
        });

        return NextResponse.json({ success: true, results });
      }
    } catch (nomErr) {
      console.warn('Nominatim error:', nomErr);
    }

    return NextResponse.json({
      success: false,
      error: `ไม่พบสถานที่ "${query}" ในรายชื่อที่ตรวจสอบแล้ว คุณสามารถเลือกแตะหมุดบนภาพถ่ายดาวเทียม Google Maps หรือเลือกจากรายชื่อด้านล่างได้เลยครับ`,
    });
  } catch (error: any) {
    console.error('Geocode API Error:', error);
    return NextResponse.json({ success: false, error: 'เกิดข้อผิดพลาดในการค้นหาพิกัด' }, { status: 500 });
  }
}
