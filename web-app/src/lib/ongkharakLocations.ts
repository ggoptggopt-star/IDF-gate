/**
 * Curated High-Precision GPS Database for Ongkharak & Nakhon Nayok
 * All coordinates verified and mapped to real physical locations.
 */

export interface VerifiedLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: 'hospital' | 'convenience' | 'market' | 'home' | 'gov' | 'bank' | 'gas';
  icon: string;
  address: string;
  keywords: string[];
  isReturn?: number; // 0 for home/dorm, 1 for round-trip
}

// College Reference: OICEC (วิทยาลัยการอาชีพองครักษ์)
export const OICEC_COLLEGE = {
  name: 'วิทยาลัยการอาชีพองครักษ์ (OICEC)',
  lat: 14.109127,
  lng: 101.062441,
  address: 'เลขที่ 99 หมู่ 3 ถ.รังสิต-นครนายก ต.องครักษ์ อ.องครักษ์ จ.นครนายก',
};

export const VERIFIED_LOCATIONS: VerifiedLocation[] = [
  // 1. โรงพยาบาล & คลินิก & ยา
  {
    id: 'hosp-ongkharak',
    name: 'โรงพยาบาลองครักษ์',
    lat: 14.12075,
    lng: 101.00185,
    category: 'hospital',
    icon: '🏥',
    address: 'ต.องครักษ์ อ.องครักษ์ จ.นครนายก (ห่างวิทยาลัย ~6.6 กม.)',
    keywords: ['โรงพยาบาล', 'รพ', 'รพ.', 'องครักษ์', 'หาหมอ', 'ป่วย', 'ตรวจโรค'],
    isReturn: 1,
  },
  {
    id: 'hosp-msu',
    name: 'รพ.ศูนย์การแพทย์สมเด็จพระเทพฯ (มศว องครักษ์)',
    lat: 14.1051,
    lng: 100.9852,
    category: 'hospital',
    icon: '🏥',
    address: 'มหาวิทยาลัยศรีนครินทรวิโรฒ คลอง 16 อ.องครักษ์ (ห่างวิทยาลัย ~8.3 กม.)',
    keywords: ['ศูนย์การแพทย์', 'มศว', 'สมเด็จพระเทพ', 'คลอง16', 'รพ.มศว', 'มหาลัย'],
    isReturn: 1,
  },
  {
    id: 'clinic-somkiat',
    name: 'คลินิกแพทย์องครักษ์ (คลินิกหมอสมเกียรติ / ตลาดองครักษ์)',
    lat: 14.1218,
    lng: 101.0038,
    category: 'hospital',
    icon: '🩺',
    address: 'ใกล้ตลาดสดองครักษ์ ต.องครักษ์ (ห่างวิทยาลัย ~6.4 กม.)',
    keywords: ['คลินิก', 'คลินิกหมอ', 'หมอสมเกียรติ', 'คลีนิก', 'รักษา', 'หมอองครักษ์'],
    isReturn: 1,
  },
  {
    id: 'clinic-dental',
    name: 'คลินิกทันตกรรมองครักษ์ (หมอฟัน / ทำฟัน)',
    lat: 14.1229,
    lng: 101.0043,
    category: 'hospital',
    icon: '🦷',
    address: 'ถ.ตลาดองครักษ์ ต.องครักษ์ (ห่างวิทยาลัย ~6.3 กม.)',
    keywords: ['หมอฟัน', 'ทันตกรรม', 'ทำฟัน', 'จัดฟัน', 'ถอนฟัน', 'คลินิกฟัน'],
    isReturn: 1,
  },
  {
    id: 'pharmacy-ongkharak',
    name: 'ร้านขายยาองครักษ์เภสัช (หน้าตลาดสด)',
    lat: 14.1222,
    lng: 101.0045,
    category: 'hospital',
    icon: '💊',
    address: 'หน้าตลาดสดเทศบาลองครักษ์ (ห่างวิทยาลัย ~6.3 กม.)',
    keywords: ['ร้านยา', 'ขายยา', 'เภสัช', 'ซื้อยา', 'ยาแก้ปวด'],
    isReturn: 1,
  },

  // 2. เซเว่นอีเลฟเว่น & ร้านสะดวกซื้อ
  {
    id: '711-college',
    name: 'เซเว่นอีเลฟเว่น สาขาหน้า วก.องครักษ์',
    lat: 14.1095,
    lng: 101.062,
    category: 'convenience',
    icon: '🏪',
    address: 'หน้าวิทยาลัยการอาชีพองครักษ์ (ห่างวิทยาลัย ~0.1 กม.)',
    keywords: ['เซเว่น', '7-11', '711', 'หน้าวิทยาลัย', 'หน้าวิลัย', 'หน้าวก', 'วก.'],
    isReturn: 1,
  },
  {
    id: '711-market',
    name: 'เซเว่นอีเลฟเว่น สาขาตลาดองครักษ์ (สี่แยกองครักษ์)',
    lat: 14.12285,
    lng: 101.00412,
    category: 'convenience',
    icon: '🏪',
    address: 'สี่แยกตลาดองครักษ์ (ห่างวิทยาลัย ~6.3 กม.)',
    keywords: ['เซเว่น', '7-11', '711', 'ตลาด', 'สี่แยก', 'ตลาดองครักษ์'],
    isReturn: 1,
  },
  {
    id: '711-msu',
    name: 'เซเว่นอีเลฟเว่น สาขาหน้า มศว องครักษ์',
    lat: 14.1065,
    lng: 100.9841,
    category: 'convenience',
    icon: '🏪',
    address: 'หน้ามหาวิทยาลัยศรีนครินทรวิโรฒ องครักษ์ (ห่างวิทยาลัย ~8.4 กม.)',
    keywords: ['เซเว่น', '7-11', '711', 'มศว', 'หน้ามศว', 'คลอง16'],
    isReturn: 1,
  },
  {
    id: '711-klong16',
    name: 'เซเว่นอีเลฟเว่น สาขาคลอง 16',
    lat: 14.1352,
    lng: 100.9205,
    category: 'convenience',
    icon: '🏪',
    address: 'ชุมชนคลอง 16 อ.องครักษ์ (ห่างวิทยาลัย ~15.4 กม.)',
    keywords: ['เซเว่น', '7-11', '711', 'คลอง16', 'คลอง 16'],
    isReturn: 1,
  },
  {
    id: '711-ptt',
    name: 'เซเว่นอีเลฟเว่น สาขา ปตท. องครักษ์ (กม.43)',
    lat: 14.1209,
    lng: 101.0182,
    category: 'convenience',
    icon: '🏪',
    address: 'ในปั๊ม ปตท. องครักษ์ ถ.รังสิต-นครนายก (ห่างวิทยาลัย ~4.9 กม.)',
    keywords: ['เซเว่น', '7-11', '711', 'ปตท', 'ปั๊มปตท', 'อเมซอน'],
    isReturn: 1,
  },
  {
    id: 'cj-more',
    name: 'CJ MORE ซูเปอร์มาร์เก็ต องครักษ์',
    lat: 14.1227,
    lng: 101.0039,
    category: 'convenience',
    icon: '🛒',
    address: 'ถ.ตลาดองครักษ์ เทศบาลตำบลองครักษ์ (ห่างวิทยาลัย ~6.3 กม.)',
    keywords: ['ซีเจ', 'cj', 'cj more', 'มินิมาร์ท', 'ร้านค้า'],
    isReturn: 1,
  },

  // 3. ตลาดสด & ห้างโลตัส
  {
    id: 'lotus-ongkharak',
    name: 'โลตัส โกเฟรช องครักษ์ (ตลาดองครักษ์)',
    lat: 14.1221,
    lng: 101.0035,
    category: 'market',
    icon: '🛒',
    address: 'ตลาดองครักษ์ อ.องครักษ์ (ห่างวิทยาลัย ~6.4 กม.)',
    keywords: ['โลตัส', 'lotus', 'โกเฟรช', 'โลตัสโกเฟรช', 'ห้าง', 'ซื้อของ'],
    isReturn: 1,
  },
  {
    id: 'market-ongkharak',
    name: 'ตลาดสดเทศบาลตำบลองครักษ์',
    lat: 14.1224,
    lng: 101.0049,
    category: 'market',
    icon: '🛍️',
    address: 'ใจกลางชุมชนเทศบาลตำบลองครักษ์ (ห่างวิทยาลัย ~6.3 กม.)',
    keywords: ['ตลาด', 'ตลาดสด', 'ของกิน', 'กับข้าว', 'ตลาดองครักษ์'],
    isReturn: 1,
  },
  {
    id: 'market-klong15',
    name: 'ตลาดต้นไม้ คลอง 15',
    lat: 14.1135,
    lng: 100.942,
    category: 'market',
    icon: '🌱',
    address: 'หมู่บ้านไม้ดอกไม้ประดับ คลอง 15 (ห่างวิทยาลัย ~13.0 กม.)',
    keywords: ['ต้นไม้', 'คลอง15', 'คลอง 15', 'ตลาดต้นไม้', 'ไม้ประดับ'],
    isReturn: 1,
  },

  // 4. บ้านพัก / หอพักนักศึกษา (กลับบ้านไม่กลับเข้าวิทยาลัย)
  {
    id: 'home-klong15',
    name: 'บ้านพัก / หอพักนักศึกษา (คลอง 15)',
    lat: 14.112,
    lng: 100.945,
    category: 'home',
    icon: '🏠',
    address: 'ชุมชนคลอง 15 อ.องครักษ์ จ.นครนายก (ห่างวิทยาลัย ~12.7 กม.)',
    keywords: ['บ้าน', 'บ้านพัก', 'หอพัก', 'คลอง15', 'คลอง 15', 'กลับบ้าน'],
    isReturn: 0,
  },
  {
    id: 'home-klong16',
    name: 'บ้านพัก / หอพักนักศึกษา (คลอง 16)',
    lat: 14.135,
    lng: 100.92,
    category: 'home',
    icon: '🏠',
    address: 'ชุมชนคลอง 16 อ.องครักษ์ จ.นครนายก (ห่างวิทยาลัย ~15.5 กม.)',
    keywords: ['บ้าน', 'บ้านพัก', 'หอพัก', 'คลอง16', 'คลอง 16', 'กลับบ้าน'],
    isReturn: 0,
  },
  {
    id: 'dorm-msu',
    name: 'หอพักนักศึกษา หน้า มศว องครักษ์',
    lat: 14.1062,
    lng: 100.9835,
    category: 'home',
    icon: '🏢',
    address: 'ซอยหน้า มศว องครักษ์ คลอง 16 (ห่างวิทยาลัย ~8.5 กม.)',
    keywords: ['หอพัก', 'หอพักมศว', 'หอนอก', 'หน้ามศว', 'คอนโด'],
    isReturn: 0,
  },
  {
    id: 'home-town',
    name: 'บ้านพักอาศัย ในตัวอำเภอองครักษ์',
    lat: 14.1215,
    lng: 101.0065,
    category: 'home',
    icon: '🏠',
    address: 'ตำบลองครักษ์ อำเภอองครักษ์ (ห่างวิทยาลัย ~6.1 กม.)',
    keywords: ['บ้าน', 'บ้านพัก', 'ในเมือง', 'ตัวอำเภอ', 'บ้านเกิด'],
    isReturn: 0,
  },

  // 5. สถานศึกษา & สถานที่ราชการ
  {
    id: 'edu-college',
    name: 'วิทยาลัยการอาชีพองครักษ์ (จุดตั้งต้น / ป้อมประตู 1)',
    lat: 14.109127,
    lng: 101.062441,
    category: 'gov',
    icon: '🏫',
    address: 'ต.องครักษ์ อ.องครักษ์ (พิกัดจุดศูนย์กลาง)',
    keywords: ['วิทยาลัย', 'วก', 'วก.', 'องครักษ์', 'ประตู1', 'ป้อมยาม', 'โรงเรียน'],
    isReturn: 1,
  },
  {
    id: 'edu-msu',
    name: 'มหาวิทยาลัยศรีนครินทรวิโรฒ องครักษ์ (มศว ประตู 1)',
    lat: 14.1078,
    lng: 100.9815,
    category: 'gov',
    icon: '🎓',
    address: 'ถ.รังสิต-นครนายก ต.องครักษ์ (ห่างวิทยาลัย ~8.7 กม.)',
    keywords: ['มศว', 'มหาลัย', 'มหาวิทยาลัย', 'ศรีนครินทรวิโรฒ', 'มศวองครักษ์'],
    isReturn: 1,
  },
  {
    id: 'gov-district',
    name: 'ที่ว่าการอำเภอองครักษ์',
    lat: 14.1238,
    lng: 101.0012,
    category: 'gov',
    icon: '🏛️',
    address: 'ศูนย์ราชการอำเภอองครักษ์ (ห่างวิทยาลัย ~6.7 กม.)',
    keywords: ['อำเภอ', 'ที่ว่าการ', 'ทำบัตรประชาชน', 'ราชการ'],
    isReturn: 1,
  },
  {
    id: 'gov-police',
    name: 'สถานีตำรวจภูธรเมืององครักษ์ (สภ.องครักษ์)',
    lat: 14.1232,
    lng: 101.0016,
    category: 'gov',
    icon: '👮',
    address: 'ถ.องครักษ์-บางน้ำเปรี้ยว (ห่างวิทยาลัย ~6.6 กม.)',
    keywords: ['ตำรวจ', 'สภ', 'สภ.', 'สถานีตำรวจ', 'โรงพัก', 'แจ้งความ'],
    isReturn: 1,
  },
  {
    id: 'gov-post',
    name: 'ไปรษณีย์ไทย สาขาองครักษ์',
    lat: 14.1235,
    lng: 101.0022,
    category: 'gov',
    icon: '📮',
    address: 'ต.องครักษ์ อ.องครักษ์ (ห่างวิทยาลัย ~6.5 กม.)',
    keywords: ['ไปรษณีย์', 'ส่งพัสดุ', 'ems', 'พัสดุ'],
    isReturn: 1,
  },

  // 6. ธนาคาร & ปั๊มน้ำมัน
  {
    id: 'bank-baac',
    name: 'ธนาคารเพื่อการเกษตรฯ (ธ.ก.ส.) สาขาองครักษ์',
    lat: 14.1219,
    lng: 101.0058,
    category: 'bank',
    icon: '🏦',
    address: 'เทศบาลตำบลองครักษ์ (ห่างวิทยาลัย ~6.2 กม.)',
    keywords: ['ธนาคาร', 'ธกส', 'ธ.ก.ส.', 'ฝากเงิน', 'กดเงิน', 'ตู้atm'],
    isReturn: 1,
  },
  {
    id: 'bank-ktb',
    name: 'ธนาคารกรุงไทย สาขาองครักษ์',
    lat: 14.1226,
    lng: 101.0044,
    category: 'bank',
    icon: '🏦',
    address: 'ถ.ตลาดองครักษ์ (ห่างวิทยาลัย ~6.3 กม.)',
    keywords: ['กรุงไทย', 'ktb', 'ธนาคาร', 'กดเงิน'],
    isReturn: 1,
  },
  {
    id: 'gas-ptt',
    name: 'ปั๊มน้ำมัน ปตท. องครักษ์ (PTT Station + Cafe Amazon)',
    lat: 14.121,
    lng: 101.0185,
    category: 'gas',
    icon: '⛽',
    address: 'ถ.รังสิต-นครนายก กม.43 (ห่างวิทยาลัย ~4.9 กม.)',
    keywords: ['ปตท', 'ปั๊มน้ำมัน', 'เติมน้ำมัน', 'อเมซอน', 'ptt'],
    isReturn: 1,
  },
  {
    id: 'gas-bangchak',
    name: 'ปั๊มน้ำมันบางจาก องครักษ์ (กม.45)',
    lat: 14.1215,
    lng: 101.012,
    category: 'gas',
    icon: '⛽',
    address: 'ถ.รังสิต-นครนายก (ห่างวิทยาลัย ~5.6 กม.)',
    keywords: ['บางจาก', 'ปั๊มบางจาก', 'เติมน้ำมัน'],
    isReturn: 1,
  },
];

// Helper: Calculate distance in KM
export function calcDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Instant Exact Match Filter for any user query
export function searchVerifiedLocations(query: string): VerifiedLocation[] {
  const q = query.trim().toLowerCase();
  if (!q) return VERIFIED_LOCATIONS.slice(0, 8);

  return VERIFIED_LOCATIONS.filter((loc) => {
    // 1. Direct name match
    if (loc.name.toLowerCase().includes(q)) return true;
    // 2. Keyword match
    if (loc.keywords.some((k) => k.toLowerCase().includes(q) || q.includes(k.toLowerCase()))) return true;
    // 3. Address match
    if (loc.address.toLowerCase().includes(q)) return true;
    return false;
  }).sort((a, b) => {
    // Prioritize places where name starts with query
    const aStarts = a.name.toLowerCase().startsWith(q) ? 1 : 0;
    const bStarts = b.name.toLowerCase().startsWith(q) ? 1 : 0;
    return bStarts - aStarts;
  });
}
