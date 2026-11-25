import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

// Reference College: Ongkharak Industrial and Community Education College (OICEC)
const OICEC_LAT = 14.109127;
const OICEC_LNG = 101.062441;

// Preset local places around Ongkharak & Nakhon Nayok for instant zero-latency match
const LOCAL_PRESETS = [
  { name: 'วิทยาลัยการอาชีพองครักษ์ (OICEC)', lat: 14.109127, lng: 101.062441, address: 'ต.องครักษ์ อ.องครักษ์ จ.นครนายก' },
  { name: 'โรงพยาบาลองครักษ์', lat: 14.1205, lng: 101.0020, address: 'ต.องครักษ์ อ.องครักษ์ จ.นครนายก' },
  { name: 'ตลาดองครักษ์', lat: 14.1220, lng: 101.0050, address: 'เทศบาลตำบลองครักษ์ อ.องครักษ์ จ.นครนายก' },
  { name: 'เซเว่นอีเลฟเว่น สาขาหน้า วก.องครักษ์', lat: 14.1095, lng: 101.0620, address: 'หน้าวิทยาลัยการอาชีพองครักษ์' },
  { name: 'เซเว่นอีเลฟเว่น สาขาตลาดองครักษ์', lat: 14.1225, lng: 101.0048, address: 'ตลาดองครักษ์' },
  { name: 'โรงพยาบาลศูนย์การแพทย์สมเด็จพระเทพฯ (มศว องครักษ์)', lat: 14.1050, lng: 100.9850, address: 'มศว คลอง 16 อ.องครักษ์' },
  { name: 'มหาวิทยาลัยศรีนครินทรวิโรฒ องครักษ์ (มศว)', lat: 14.1080, lng: 100.9800, address: 'อ.องครักษ์ จ.นครนายก' },
  { name: 'ที่ว่าการอำเภอองครักษ์', lat: 14.1240, lng: 101.0010, address: 'อ.องครักษ์ จ.นครนายก' },
  { name: 'สถานีตำรวจภูธรเมืององครักษ์ (สภ.องครักษ์)', lat: 14.1230, lng: 101.0015, address: 'อ.องครักษ์ จ.นครนายก' },
  { name: 'บ้านพัก (คลอง 15)', lat: 14.1120, lng: 100.9450, address: 'คลอง 15 อ.องครักษ์ จ.นครนายก' },
  { name: 'บ้านพัก (คลอง 16)', lat: 14.1350, lng: 100.9200, address: 'คลอง 16 อ.องครักษ์ จ.นครนายก' },
];

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
        name: 'ตำแหน่งจาก Google Maps',
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
      return NextResponse.json({ success: false, error: 'กรุณาระบุคำค้นหาสถานที่' }, { status: 400 });
    }

    // 1. Direct Coordinate Detection (e.g. "14.1091, 101.0624")
    const coordMatch = query.match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/);
    if (coordMatch) {
      const lat = parseFloat(coordMatch[1]);
      const lng = parseFloat(coordMatch[2]);
      return NextResponse.json({
        success: true,
        results: [
          {
            name: `พิกัด GPS (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
            lat,
            lng,
            address: 'พิกัดภูมิศาสตร์ที่ระบุโดยตรง',
          },
        ],
      });
    }

    // 2. Google Maps URL Detection (e.g. maps.app.goo.gl, google.com/maps)
    if (query.includes('http://') || query.includes('https://') || query.includes('maps')) {
      const urlResult = await resolveGoogleMapsUrl(query);
      if (urlResult) {
        return NextResponse.json({
          success: true,
          results: [
            {
              name: urlResult.name,
              lat: urlResult.lat,
              lng: urlResult.lng,
              address: 'นำเข้าจากลิงก์ Google Maps โดยตรง',
            },
          ],
        });
      }
    }

    // 3. Check Local Presets first
    const matchedPresets = LOCAL_PRESETS.filter((p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) || query.toLowerCase().includes(p.name.toLowerCase())
    );

    // 4. Use Google Gemini AI for Real-world Thai Geocoding (Free via existing key)
    const apiKey = process.env.GEMINI_API_KEY;
    let geminiResults: Array<{ name: string; lat: number; lng: number; address: string }> = [];

    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const prompt = `
You are a precise GPS Location Finder for Thailand, especially Ongkharak, Nakhon Nayok, and surrounding provinces.
The user is searching for this place: "${query}"

Reference college location:
- Ongkharak Industrial and Community Education College (วิทยาลัยการอาชีพองครักษ์): latitude 14.109127, longitude 101.062441

Find the real-world GPS coordinates (latitude, longitude) and official Thai place name for this location.
If the place has multiple branches or is a chain (e.g. 7-Eleven, clinic, bank, Lotus), choose or prioritize the branch nearest to Ongkharak / Nakhon Nayok / path from college.

Respond ONLY with valid JSON in this exact structure, without any markdown formatting or extra text:
[
  {
    "name": "ชื่อสถานที่ภาษาไทยที่กระชับและถูกต้อง",
    "lat": 14.1205,
    "lng": 101.0020,
    "address": "ตำบล อำเภอ จังหวัด หรือจุดสังเกต"
  }
]
`;

        const candidateModels = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-2.5-flash'];
        for (const modelName of candidateModels) {
          try {
            const response = await ai.models.generateContent({
              model: modelName,
              contents: prompt,
            });

            const rawText = response.text?.trim() || '';
            const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
            let parsed = JSON.parse(cleaned);

            if (!Array.isArray(parsed) && typeof parsed === 'object') {
              parsed = [parsed];
            }

            if (Array.isArray(parsed) && parsed.length > 0) {
              geminiResults = parsed
                .filter((p: any) => typeof p.lat === 'number' && typeof p.lng === 'number' && p.lat > 5 && p.lat < 21)
                .map((p: any) => ({
                  name: String(p.name || query),
                  lat: Number(p.lat),
                  lng: Number(p.lng),
                  address: String(p.address || ''),
                }));
              if (geminiResults.length > 0) break;
            }
          } catch (modelErr: any) {
            console.warn(`Gemini model ${modelName} error:`, modelErr.message);
          }
        }
      } catch (geminiErr: any) {
        console.warn('Gemini geocode error:', geminiErr.message);
      }
    }

    // 5. OpenStreetMap Nominatim Fallback if needed
    let nominatimResults: Array<{ name: string; lat: number; lng: number; address: string }> = [];
    if (geminiResults.length === 0) {
      try {
        const nomUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query
        )}&countrycodes=th&limit=5`;
        const nomRes = await fetch(nomUrl, {
          headers: { 'Accept-Language': 'th,en', 'User-Agent': 'SmartGatePass/1.0' },
        });
        const nomData = await nomRes.json();
        if (Array.isArray(nomData)) {
          nominatimResults = nomData.map((item: any) => ({
            name: item.display_name.split(',')[0] || item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            address: item.display_name,
          }));
        }
      } catch (nomErr) {
        console.warn('Nominatim fallback error:', nomErr);
      }
    }

    // Merge and deduplicate results
    const combined = [
      ...matchedPresets,
      ...geminiResults,
      ...nominatimResults,
    ];

    if (combined.length === 0) {
      return NextResponse.json({
        success: false,
        error: `ไม่พบสถานที่ "${query}" ลองระบุชื่อให้ชัดเจนขึ้น หรือวางลิงก์จาก Google Maps ได้เลยครับ`,
      });
    }

    return NextResponse.json({
      success: true,
      results: combined.slice(0, 5),
    });
  } catch (error: any) {
    console.error('Geocode API Error:', error);
    return NextResponse.json({ success: false, error: 'เกิดข้อผิดพลาดในการค้นหาพิกัด' }, { status: 500 });
  }
}
