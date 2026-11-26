import { NextRequest, NextResponse } from 'next/server';
import {
  VERIFIED_LOCATIONS,
  searchVerifiedLocations,
  calcDistanceKm,
  OICEC_COLLEGE,
} from '@/lib/ongkharakLocations';

// Smart Semantic Intent Mapping for AI Search
const INTENT_DICTIONARY: { keywords: string[]; terms: string[]; title: string; icon: string }[] = [
  {
    keywords: ['หมอ', 'หาหมอ', 'ป่วย', 'ไข้', 'ไม่สบาย', 'ตรวจโรค', 'ฉุกเฉิน', 'ปวดหัว', 'ปวดท้อง'],
    terms: ['โรงพยาบาล', 'คลินิก', 'สถานพยาบาล', 'รพ.สต.'],
    title: 'สถานพยาบาลและคลินิกใกล้เคียง',
    icon: '🏥',
  },
  {
    keywords: ['ปวดฟัน', 'ทำฟัน', 'ถอนฟัน', 'จัดฟัน', 'ทันตกรรม'],
    terms: ['คลินิกทันตกรรม', 'ทำฟัน', 'โรงพยาบาลองครักษ์'],
    title: 'คลินิกทันตกรรม/ทำฟัน',
    icon: '🦷',
  },
  {
    keywords: ['ยา', 'ซื้อยา', 'เภสัช', 'ร้านยา', 'แก้ปวด'],
    terms: ['ร้านขายยา', 'เภสัช', 'โรงพยาบาล'],
    title: 'ร้านขายยาและเวชภัณฑ์',
    icon: '💊',
  },
  {
    keywords: ['ซ่อมรถ', 'ปะยาง', 'ถ่ายน้ำมันเครื่อง', 'รถเสีย', 'เปลี่ยนยาง', 'มอไซค์', 'มอเตอร์ไซค์'],
    terms: ['อู่ซ่อมรถ', 'ซ่อมมอเตอร์ไซค์', 'ปะยาง', 'ศูนย์บริการ'],
    title: 'อู่ซ่อมรถ/ซ่อมมอเตอร์ไซค์',
    icon: '🔧',
  },
  {
    keywords: ['เซเว่น', '7-eleven', '7-11', 'สะดวกซื้อ', 'มินิมาร์ท'],
    terms: ['7-Eleven', 'เซเว่น', 'สะดวกซื้อ', 'โลตัส โกเฟรช', 'CJ MORE'],
    title: 'ร้านสะดวกซื้อ 7-Eleven / มินิมาร์ท',
    icon: '🏪',
  },
  {
    keywords: ['ของกิน', 'หิว', 'กินข้าว', 'ร้านอาหาร', 'ตามสั่ง', 'ก๋วยเตี๋ยว', 'ชาบู', 'หมูกระทะ', 'ส้มตำ'],
    terms: ['ตลาดองครักษ์', 'ร้านอาหาร', 'เซเว่น', 'ศูนย์อาหาร'],
    title: 'ตลาดและร้านอาหาร',
    icon: '🍲',
  },
  {
    keywords: ['กาแฟ', 'คาเฟ่', 'cafe', 'อเมซอน', 'ชานม', 'น้ำปั่น'],
    terms: ['คาเฟ่', 'Cafe', 'ร้านกาแฟ', 'อเมซอน'],
    title: 'ร้านกาแฟและคาเฟ่',
    icon: '☕',
  },
  {
    keywords: ['ตัดผม', 'ร้านตัดผม', 'บาร์เบอร์', 'เสริมสวย', 'สระผม'],
    terms: ['ร้านตัดผม', 'บาร์เบอร์', 'เสริมสวย'],
    title: 'ร้านตัดผม/เสริมสวย',
    icon: '✂️',
  },
  {
    keywords: ['เงิน', 'กดเงิน', 'โอนเงิน', 'atm', 'ตู้เอทีเอ็ม', 'ธนาคาร'],
    terms: ['ธนาคาร', 'ATM', 'กสิกร', 'ไทยพาณิชย์', 'กรุงไทย', 'ออมสิน', 'ธ.ก.ส.'],
    title: 'ธนาคารและตู้ ATM',
    icon: '🏧',
  },
  {
    keywords: ['ส่งของ', 'พัสดุ', 'ไปรษณีย์', 'ส่งจดหมาย', 'เคอรี่', 'แฟลช', 'flash', 'kerry', 'j&t'],
    terms: ['ไปรษณีย์', 'Flash Express', 'J&T', 'Kerry'],
    title: 'จุดบริการรับส่งพัสดุ',
    icon: '📦',
  },
  {
    keywords: ['น้ำมัน', 'เติมน้ำมัน', 'ปั๊ม', 'ปั๊มน้ำมัน', 'ปตท', 'บางจาก', 'พีที', 'pt'],
    terms: ['ปั๊มน้ำมัน', 'ปตท', 'บางจาก', 'PT'],
    title: 'สถานีบริการน้ำมัน',
    icon: '⛽',
  },
  {
    keywords: ['ราชการ', 'ทำบัตร', 'บัตรประชาชน', 'อำเภอ', 'เทศบาล', 'อบต', 'แจ้งความ', 'โรงพัก', 'ตำรวจ'],
    terms: ['ที่ว่าการอำเภอองครักษ์', 'สำนักงานเทศบาล', 'สถานีตำรวจ', 'อบต'],
    title: 'หน่วยงานราชการและสถานีตำรวจ',
    icon: '🏛️',
  },
  {
    keywords: ['บ้านพักบุคลากร', 'บ้านพักครู', 'บ้านพักอาจารย์', 'แฟลตครู', 'บุคลากร', 'ที่พักบุคลากร'],
    terms: ['บ้านพักบุคลากร วิทยาลัยการอาชีพองครักษ์'],
    title: 'บ้านพักบุคลากร วิทยาลัยการอาชีพองครักษ์',
    icon: '🏠',
  },
  {
    keywords: ['บ้าน', 'กลับบ้าน', 'หอพัก', 'ห้องเช่า', 'อพาร์ทเม้นท์', 'ที่พัก'],
    terms: ['บ้านพักอาศัย', 'หอพัก', 'ต.องครักษ์'],
    title: 'ที่พักอาศัย/บ้านพัก',
    icon: '🏠',
  },
];

// Helper: Resolve Lat/Lng from Google Maps link
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

    const atMatch = finalUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (atMatch) {
      return {
        lat: parseFloat(atMatch[1]),
        lng: parseFloat(atMatch[2]),
        name: 'ตำแหน่งพิกัดจาก Google Maps',
      };
    }

    const qMatch = finalUrl.match(/[?&](?:q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (qMatch) {
      return {
        lat: parseFloat(qMatch[1]),
        lng: parseFloat(qMatch[2]),
        name: 'พิกัดจาก Google Maps',
      };
    }

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

// Query Longdo Map Search API safely with zero rate-limit issues
async function searchLongdoMap(
  query: string,
  apiKey: string,
  refLat: number,
  refLng: number
) {
  const allResults: any[] = [];
  const seenIds = new Set<string>();

  try {
    const url = `https://search.longdo.com/mapsearch/json/search?keyword=${encodeURIComponent(
      query.trim()
    )}&limit=15&key=${apiKey.trim()}`;

    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    const text = await res.text();

    if (text && text.trim().startsWith('{')) {
      const data = JSON.parse(text);
      if (data && Array.isArray(data.data)) {
        for (const item of data.data) {
          if (
            typeof item.lat === 'number' &&
            typeof item.lon === 'number' &&
            !seenIds.has(item.id || item.name)
          ) {
            seenIds.add(item.id || item.name);
            const lat = Number(item.lat);
            const lng = Number(item.lon);
            const dist = calcDistanceKm(refLat, refLng, lat, lng);
            allResults.push({
              id: item.id,
              name: item.name,
              lat,
              lng,
              address: item.address || 'ค้นพบจาก Longdo Map',
              icon: getItemIcon(item),
              distance: dist,
              source: 'longdo',
            });
          }
        }
      }
    }
  } catch (err: any) {
    console.warn('Longdo Search error:', err.message);
  }

  return allResults;
}

function getItemIcon(item: any): string {
  const tag = (item.tag || '').toString().toLowerCase();
  const name = (item.name || '').toLowerCase();
  if (tag.includes('hospital') || tag.includes('medical') || name.includes('โรงพยาบาล') || name.includes('คลินิก') || name.includes('รพ.')) return '🏥';
  if (tag.includes('school') || name.includes('โรงเรียน') || name.includes('วิทยาลัย') || name.includes('มหาวิทยาลัย')) return '🏫';
  if (tag.includes('temple') || name.includes('วัด')) return '🛕';
  if (tag.includes('shopping') || tag.includes('mall') || name.includes('ตลาด') || name.includes('เซเว่น') || name.includes('โลตัส') || name.includes('cj')) return '🏪';
  if (tag.includes('gov') || name.includes('อบต') || name.includes('เทศบาล') || name.includes('อำเภอ') || name.includes('สถานีตำรวจ')) return '🏛️';
  if (name.includes('กาแฟ') || name.includes('คาเฟ่') || name.includes('cafe')) return '☕';
  if (name.includes('น้ำมัน') || name.includes('ปั๊ม')) return '⛽';
  if (name.includes('ซ่อม') || name.includes('อู่')) return '🔧';
  return '📍';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawQuery = (body.query || '').trim();
    const userLat = typeof body.userLat === 'number' && body.userLat > 0 ? body.userLat : OICEC_COLLEGE.lat;
    const userLng = typeof body.userLng === 'number' && body.userLng > 0 ? body.userLng : OICEC_COLLEGE.lng;
    const isUsingUserGps = Boolean(body.userLat && body.userLng);

    const longdoKey = (
      body.longdoKey ||
      process.env.LONGDO_MAP_KEY ||
      process.env.NEXT_PUBLIC_LONGDO_MAP_KEY ||
      'dc7f32b62b83ee2f09fb1e1dd6b60d3f'
    ).trim();

    const hasLongdoKey = Boolean(longdoKey);

    // If query is empty: Return top popular places in Ongkharak sorted by proximity
    if (!rawQuery) {
      const defaultLocations = VERIFIED_LOCATIONS.map((loc) => {
        const dist = calcDistanceKm(userLat, userLng, loc.lat, loc.lng);
        return {
          name: loc.name,
          lat: loc.lat,
          lng: loc.lng,
          address: loc.address,
          icon: loc.icon,
          isReturn: loc.isReturn !== undefined ? loc.isReturn : 1,
          distance: dist,
          distanceText: `${dist} กม. ${isUsingUserGps ? 'จากตำแหน่งคุณ' : 'จากวิทยาลัย'}`,
          source: 'verified',
        };
      })
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 10);

      if (defaultLocations.length > 0) {
        (defaultLocations[0] as any).isNearest = true;
      }

      return NextResponse.json({
        success: true,
        hasLongdoKey,
        results: defaultLocations,
      });
    }

    // 1. Direct Coordinate Detection (e.g. "14.1091, 101.0624")
    const coordMatch = rawQuery.match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      const dist = calcDistanceKm(userLat, userLng, lat, lng);
      return NextResponse.json({
        success: true,
        hasLongdoKey,
        results: [
          {
            name: `พิกัดระบุเอง (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
            lat,
            lng,
            address: `ระยะห่าง ${dist} กม. ${isUsingUserGps ? 'จากตำแหน่งคุณ' : 'จาก วก.องครักษ์'}`,
            icon: '📍',
            distance: dist,
            distanceText: `${dist} กม.`,
            isNearest: true,
            source: 'coordinate',
          },
        ],
      });
    }

    // 2. Google Maps URL Detection
    if (
      rawQuery.includes('http://') ||
      rawQuery.includes('https://') ||
      rawQuery.includes('maps.app.goo.gl') ||
      rawQuery.includes('google.com/maps')
    ) {
      const urlResult = await resolveGoogleMapsUrl(rawQuery);
      if (urlResult) {
        const dist = calcDistanceKm(userLat, userLng, urlResult.lat, urlResult.lng);
        return NextResponse.json({
          success: true,
          hasLongdoKey,
          results: [
            {
              name: urlResult.name,
              lat: urlResult.lat,
              lng: urlResult.lng,
              address: `ตำแหน่งจริงจากลิงก์ Google Maps (${dist} กม.)`,
              icon: '📍',
              distance: dist,
              distanceText: `${dist} กม.`,
              isNearest: true,
              source: 'google_maps_url',
            },
          ],
        });
      }
    }

    // 3. AI Intent Understanding & Keyword Expansion
    let searchTerms = [rawQuery];
    let aiBadge: string | null = null;

    const lowerQuery = rawQuery.toLowerCase();
    for (const intent of INTENT_DICTIONARY) {
      if (intent.keywords.some((k) => lowerQuery.includes(k) || k.includes(lowerQuery))) {
        searchTerms = Array.from(new Set([rawQuery, ...intent.terms]));
        aiBadge = `น้องเกต AI ช่วยค้นหาหมวด: ${intent.title}`;
        break;
      }
    }

    // 4. Query Longdo Map Search API safely (Official Thailand POI database)
    let longdoResults: any[] = [];
    if (hasLongdoKey) {
      longdoResults = await searchLongdoMap(rawQuery, longdoKey, userLat, userLng);
    }

    // 5. Candidate selection:
    // If Longdo has real results, prioritize them 100%!
    // Only prepend college-internal locations if query specifically asks for college buildings
    let candidates: any[] = [];
    const lowerQ = rawQuery.toLowerCase();

    if (
      lowerQ.includes('บุคลากร') ||
      lowerQ.includes('บ้านพักครู') ||
      lowerQ.includes('หอพักใน') ||
      lowerQ.includes('ป้อมยาม') ||
      lowerQ.includes('วก.องครักษ์') ||
      lowerQ.includes('วิทยาลัยการอาชีพองครักษ์')
    ) {
      const internalCollegeHits = VERIFIED_LOCATIONS.filter((loc) =>
        loc.name.toLowerCase().includes(lowerQ) ||
        loc.keywords.some((k) => k.toLowerCase() === lowerQ)
      ).map((loc) => ({
        name: loc.name,
        lat: loc.lat,
        lng: loc.lng,
        address: loc.address,
        icon: loc.icon,
        isReturn: loc.isReturn !== undefined ? loc.isReturn : 1,
        distance: calcDistanceKm(userLat, userLng, loc.lat, loc.lng),
        source: 'verified',
      }));
      candidates = [...internalCollegeHits, ...longdoResults];
    } else if (longdoResults.length > 0) {
      candidates = longdoResults;
    } else {
      // Fallback: only match if location name directly contains the search query
      const localDirectHits = VERIFIED_LOCATIONS.filter((loc) =>
        loc.name.toLowerCase().includes(lowerQ)
      ).map((loc) => ({
        name: loc.name,
        lat: loc.lat,
        lng: loc.lng,
        address: loc.address,
        icon: loc.icon,
        isReturn: loc.isReturn !== undefined ? loc.isReturn : 1,
        distance: calcDistanceKm(userLat, userLng, loc.lat, loc.lng),
        source: 'verified',
      }));
      candidates = localDirectHits;
    }

    const seenNames = new Set<string>();
    const deduped: any[] = [];

    for (const item of candidates) {
      const normName = item.name.trim().toLowerCase();
      if (!seenNames.has(normName)) {
        seenNames.add(normName);
        deduped.push({
          ...item,
          distanceText: `${item.distance} กม. ${isUsingUserGps ? 'จากตำแหน่งคุณ' : 'จากวิทยาลัย'}`,
        });
      }
    }

    if (deduped.length > 0) {
      deduped[0].isNearest = true;
      return NextResponse.json({
        success: true,
        hasLongdoKey,
        aiInterpretation: aiBadge,
        results: deduped.slice(0, 15),
      });
    }

    // 6. OpenStreetMap Nominatim Fallback if needed
    try {
      const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        rawQuery + ' องครักษ์ นครนายก'
      )}&countrycodes=th&viewbox=100.85,14.28,101.18,14.00&bounded=0&limit=5`;

      const nomRes = await fetch(nomUrl, {
        headers: { 'Accept-Language': 'th,en', 'User-Agent': 'SmartGatePass/1.0' },
      });
      const nomData = await nomRes.json();
      if (Array.isArray(nomData) && nomData.length > 0) {
        const results: any[] = nomData.map((item: any) => {
          const lat = parseFloat(item.lat);
          const lng = parseFloat(item.lon);
          const dist = calcDistanceKm(userLat, userLng, lat, lng);
          return {
            name: item.display_name.split(',')[0] || item.display_name,
            lat,
            lng,
            address: item.display_name,
            icon: '📍',
            distance: dist,
            distanceText: `${dist} กม.`,
            source: 'osm',
          };
        }).sort((a: any, b: any) => a.distance - b.distance);

        if (results.length > 0) {
          results[0].isNearest = true;
        }

        return NextResponse.json({
          success: true,
          hasLongdoKey,
          aiInterpretation: aiBadge,
          results,
        });
      }
    } catch (nomErr) {
      console.warn('Nominatim error:', nomErr);
    }

    return NextResponse.json({
      success: false,
      hasLongdoKey,
      error: `ไม่พบสถานที่ "${rawQuery}" คุณสามารถแตะเลือกบนแผนที่ หรือลากหมุดแดงไปยังจุดหมายที่ต้องการได้ทันทีครับ`,
    });
  } catch (error: any) {
    console.error('Geocode API Error:', error);
    return NextResponse.json({ success: false, error: error?.message || 'เกิดข้อผิดพลาดในการค้นหาพิกัด', stack: error?.stack }, { status: 500 });
  }
}
