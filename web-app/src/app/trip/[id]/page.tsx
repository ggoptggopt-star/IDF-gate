'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  Navigation,
  MapPin,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Building2,
  User,
  ArrowRight,
  ExternalLink,
  RotateCcw,
  Sparkles,
  AlertTriangle,
  Play,
  Pause,
  Home,
  Check,
} from 'lucide-react';
import { LeaveRequest } from '@/types';

// College coordinates: OICEC (วิทยาลัยการอาชีพองครักษ์)
const OICEC_LAT = 14.1285;
const OICEC_LNG = 100.9985;

function calcDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // metres
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function TripContent() {
  const params = useParams();
  const router = useRouter();
  const requestId = params?.id as string;

  const [request, setRequest] = useState<LeaveRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Simulation slider (0 to 100%)
  const [simProgress, setSimProgress] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [currentCoord, setCurrentCoord] = useState<{ lat: number; lng: number }>({
    lat: OICEC_LAT,
    lng: OICEC_LNG,
  });

  // Map references
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const riderMarkerRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);

  // Load request data
  const fetchRequest = async () => {
    try {
      const res = await fetch(`/api/requests/${requestId}/trip`);
      const data = await res.json();
      if (data.success && data.request) {
        setRequest(data.request);
        const destLat = data.request.destination_lat || 14.1350;
        const destLng = data.request.destination_lng || 100.9920;

        // If trip already at destination or back, set initial slider
        if (data.request.trip_stage === 'at_dest') {
          setSimProgress(100);
          setCurrentCoord({ lat: destLat, lng: destLng });
        } else if (data.request.trip_stage === 'completed') {
          setSimProgress(100);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (requestId) {
      fetchRequest();
    }
  }, [requestId]);

  const destLat = request?.destination_lat || 14.1350;
  const destLng = request?.destination_lng || 100.9920;
  const isOneWay = request?.is_return_required === 0;

  // Initialize Leaflet Map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current || !request) return;

    let isMounted = true;

    async function initMap() {
      const L = await import('leaflet');

      // Add CSS if needed
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      if (!isMounted || !request) return;
      const currentReq = request;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapContainerRef.current!, {
        center: [(OICEC_LAT + destLat) / 2, (OICEC_LNG + destLng) / 2],
        zoom: 14,
        zoomControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      // 1. College Marker (Start)
      const collegeIcon = L.divIcon({
        className: 'college-pin',
        html: `
          <div style="background:#0066CC;color:white;width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 3px 10px rgba(0,0,0,0.3);border:2px solid white;font-size:16px;">
            🏫
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      L.marker([OICEC_LAT, OICEC_LNG], { icon: collegeIcon })
        .addTo(map)
        .bindPopup('<b>วิทยาลัยการอาชีพองครักษ์ (OICEC)</b><br>จุดเริ่มต้น');

      // 2. Destination Marker (End)
      const destIcon = L.divIcon({
        className: 'dest-pin',
        html: `
          <div style="background:${isOneWay ? '#10b981' : '#f59e0b'};color:white;width:34px;height:34px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,0.3);border:2px solid white;">
            <span style="transform:rotate(45deg);font-size:16px;">${isOneWay ? '🏠' : '📍'}</span>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
      });
      L.marker([destLat, destLng], { icon: destIcon })
        .addTo(map)
        .bindPopup(`<b>${currentReq.destination_name || 'จุดหมายปลายทาง'}</b><br>เป้าหมายการเดินทาง`);

      // 3. Route Polyline
      const routeLine = L.polyline(
        [
          [OICEC_LAT, OICEC_LNG],
          [(OICEC_LAT + destLat) / 2 + 0.001, (OICEC_LNG + destLng) / 2 - 0.001],
          [destLat, destLng],
        ],
        {
          color: '#2563eb',
          weight: 5,
          opacity: 0.8,
          dashArray: '8, 8',
        }
      ).addTo(map);
      polylineRef.current = routeLine;

      // 4. Moving Rider Marker
      const riderIcon = L.divIcon({
        className: 'rider-live-pin',
        html: `
          <div style="position:relative;display:flex;align-items:center;justify-content:center;">
            <div style="position:absolute;width:44px;height:44px;border-radius:50%;background:rgba(16,185,129,0.35);animation:ping 1.5s cubic-bezier(0,0,0.2,1) infinite;"></div>
            <div style="background:#0f172a;color:#10b981;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.4);border:2.5px solid #10b981;font-size:16px;z-index:2;">
              🛵
            </div>
          </div>
        `,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
      });

      const riderMarker = L.marker([currentCoord.lat, currentCoord.lng], {
        icon: riderIcon,
        zIndexOffset: 1000,
      }).addTo(map);

      riderMarkerRef.current = riderMarker;
      mapInstanceRef.current = map;

      // Fit bounds
      map.fitBounds(routeLine.getBounds(), { padding: [50, 50] });
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [request]);

  // Update Rider Marker position when simulation progress changes
  useEffect(() => {
    if (!request) return;

    const fraction = simProgress / 100;
    const isHeadingBack = request.trip_stage === 'heading_back';

    let fromLat = OICEC_LAT;
    let fromLng = OICEC_LNG;
    let toLat = destLat;
    let toLng = destLng;

    if (isHeadingBack) {
      fromLat = destLat;
      fromLng = destLng;
      toLat = OICEC_LAT;
      toLng = OICEC_LNG;
    }

    const newLat = fromLat + (toLat - fromLat) * fraction;
    const newLng = fromLng + (toLng - fromLng) * fraction;

    setCurrentCoord({ lat: newLat, lng: newLng });

    if (riderMarkerRef.current) {
      riderMarkerRef.current.setLatLng([newLat, newLng]);
    }
  }, [simProgress, request?.trip_stage]);

  // Auto-play demo simulation
  useEffect(() => {
    let interval: any = null;
    if (isAutoPlaying) {
      interval = setInterval(() => {
        setSimProgress((prev) => {
          if (prev >= 100) {
            setIsAutoPlaying(false);
            return 100;
          }
          return Math.min(100, prev + 5);
        });
      }, 600);
    }
    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  // Handle Dynamic Actions
  const handleAction = async (action: 'arrive_dest' | 'start_return' | 'arrive_college' | 'complete_trip') => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/requests/${requestId}/trip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          lat: currentCoord.lat,
          lng: currentCoord.lng,
          speed: 35,
        }),
      });

      const data = await res.json();
      if (data.success && data.request) {
        setRequest(data.request);
        if (action === 'start_return') {
          setSimProgress(0); // Reset for return leg
        }
      } else {
        alert(data.error || 'เกิดข้อผิดพลาดในการบันทึก');
      }
    } catch (e: any) {
      console.error(e);
      alert(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-3">
        <div className="w-10 h-10 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-400">กำลังเชื่อมต่อระบบพิกัดสด Smart Gate Pass AI...</p>
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="w-12 h-12 text-rose-500 mb-3" />
        <h2 className="text-base font-bold text-slate-800">ไม่พบคำร้องการเดินทาง</h2>
        <Link href="/" className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold">
          กลับหน้าหลัก
        </Link>
      </div>
    );
  }

  const stage = request.trip_stage || 'heading_to_dest';
  const isCompleted = stage === 'completed' || request.overall_status === 'returned' || (isOneWay && request.overall_status === 'completed_exit' && request.dest_arrived_at);

  const targetLat = stage === 'heading_back' ? OICEC_LAT : destLat;
  const targetLng = stage === 'heading_back' ? OICEC_LNG : destLng;
  const distanceMeters = calcDistanceMeters(currentCoord.lat, currentCoord.lng, targetLat, targetLng);
  const distanceKm = (distanceMeters / 1000).toFixed(1);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col relative pb-28">
      {/* Top Floating Header */}
      <header className="px-4 py-3 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-slate-300" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wide text-white">Rider Trip Mode</span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                GPS Live
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              {request.request_code} • {isOneWay ? 'กรณีไม่กลับ (สิ้นสุดที่บ้าน)' : 'กรณีต้องกลับวิทยาลัย'}
            </p>
          </div>
        </div>

        <button
          onClick={fetchRequest}
          className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors"
          title="รีเฟรชข้อมูล"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </header>

      {/* Full-bleed Interactive Leaflet Map */}
      <div className="relative w-full h-72 sm:h-80 bg-slate-950 border-b border-slate-800">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Live Distance & Speed Overlay Badge */}
        <div className="absolute top-3 left-3 z-[400] bg-slate-900/90 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-2 text-xs">
          <Navigation className="w-4 h-4 text-emerald-400 animate-pulse" />
          <div>
            <div className="text-[10px] text-slate-400">ระยะห่างถึงเป้าหมาย</div>
            <div className="font-bold text-white text-xs">{distanceMeters > 1000 ? `${distanceKm} กม.` : `${distanceMeters} เมตร`}</div>
          </div>
        </div>

        {/* Status Chip */}
        <div className="absolute top-3 right-3 z-[400] bg-slate-900/90 backdrop-blur-md border border-slate-700/80 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold shadow-lg text-emerald-400 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>{isCompleted ? 'สิ้นสุดการเดินทาง ✓' : stage === 'at_dest' ? 'ถึงที่หมายแล้ว 📍' : 'กำลังนำทาง 🛵'}</span>
        </div>
      </div>

      {/* Main Body Sheet */}
      <div className="p-4 space-y-4">
        {/* Presentation Simulation Slider */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-3.5 shadow-md">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              จำลองการเคลื่อนที่ GPS (สำหรับนำเสนออาจารย์):
            </span>
            <button
              onClick={() => setIsAutoPlaying(!isAutoPlaying)}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-950/60 border border-cyan-800/60"
            >
              {isAutoPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              <span>{isAutoPlaying ? 'หยุดเล่น' : 'เล่นอัตโนมัติ'}</span>
            </button>
          </div>

          <div className="space-y-1.5">
            <input
              type="range"
              min="0"
              max="100"
              value={simProgress}
              onChange={(e) => {
                setSimProgress(Number(e.target.value));
                setIsAutoPlaying(false);
              }}
              className="w-full accent-emerald-500 h-2 bg-slate-700 rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-medium">
              <span>{stage === 'heading_back' ? request.destination_name : 'วิทยาลัยการอาชีพองครักษ์ (0%)'}</span>
              <span className="font-bold text-emerald-400">{simProgress}%</span>
              <span>{stage === 'heading_back' ? 'ถึงวิทยาลัย (100%)' : `${request.destination_name} (100%)`}</span>
            </div>
          </div>
        </div>

        {/* Stepper (Rider Journey Progress) */}
        <div className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-3.5 shadow-sm">
          <h4 className="text-[11px] font-bold text-slate-300 mb-3 uppercase tracking-wider">
            ขั้นตอนการเดินทาง (Trip Status)
          </h4>
          <div className="space-y-2.5">
            {/* Step 1: Gate Exit */}
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-white">1. สแกนใบหน้าผ่านไม้กั้นขาออก</p>
                <p className="text-[10px] text-emerald-400">อนุมัติและเปิดไม้กั้นสำเร็จ</p>
              </div>
            </div>

            {/* Step 2: Heading to Dest */}
            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white ${
                stage !== 'not_started' ? 'bg-emerald-500' : 'bg-slate-700'
              }`}>
                <Check className="w-3.5 h-3.5" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-white">2. กำลังเดินทางไป {request.destination_name}</p>
                <p className="text-[10px] text-slate-400">ระบบแชร์พิกัด GPS อัตโนมัติ</p>
              </div>
            </div>

            {/* Step 3: Arrived Dest */}
            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white ${
                ['at_dest', 'heading_back', 'completed'].includes(stage) || (isOneWay && isCompleted)
                  ? 'bg-emerald-500'
                  : 'bg-slate-700 text-slate-400'
              }`}>
                {['at_dest', 'heading_back', 'completed'].includes(stage) || (isOneWay && isCompleted) ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <span className="text-[10px]">3</span>
                )}
              </div>
              <div className="text-xs">
                <p className="font-semibold text-white">3. ถึงจุดหมายปลายทาง</p>
                <p className="text-[10px] text-slate-400">
                  {request.dest_arrived_at ? `ถึงเมื่อ ${request.dest_arrived_at}` : 'รอนักศึกษากดยืนยัน'}
                </p>
              </div>
            </div>

            {/* Step 4 & 5 (Only for Round Trip) */}
            {!isOneWay && (
              <>
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white ${
                    ['heading_back', 'completed'].includes(stage) ? 'bg-emerald-500' : 'bg-slate-700 text-slate-400'
                  }`}>
                    {['heading_back', 'completed'].includes(stage) ? <Check className="w-3.5 h-3.5" /> : <span className="text-[10px]">4</span>}
                  </div>
                  <div className="text-xs">
                    <p className="font-semibold text-white">4. เดินทางกลับเข้าวิทยาลัย</p>
                    <p className="text-[10px] text-slate-400">ก่อนกำหนดเวลา {request.allowed_end_time} น.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white ${
                    isCompleted ? 'bg-emerald-500' : 'bg-slate-700 text-slate-400'
                  }`}>
                    {isCompleted ? <Check className="w-3.5 h-3.5" /> : <span className="text-[10px]">5</span>}
                  </div>
                  <div className="text-xs">
                    <p className="font-semibold text-white">5. สแกนเข้าประตูวิทยาลัย (จบคำร้องสมบูรณ์)</p>
                    <p className="text-[10px] text-slate-400">รายงานตัวกลับเรียบร้อย</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Trip Destination Info Card */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 shadow-sm text-xs space-y-2">
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
            <span className="font-bold text-white flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-400" />
              <span>{request.destination_name}</span>
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold">
              {request.category === 'medical' ? 'พบแพทย์' : isOneWay ? 'กลับบ้าน' : 'ธุระจำเป็น'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-slate-300 text-[11px] pt-1">
            <div>
              <span className="text-slate-400">นักศึกษา:</span> {request.student_name}
            </div>
            <div>
              <span className="text-slate-400">ชั้นเรียน:</span> {request.group_code || 'ปวส.2/1 DBT'}
            </div>
            <div>
              <span className="text-slate-400">เวลาออก:</span> {request.allowed_start_time} น.
            </div>
            <div>
              <span className="text-slate-400">เวลากลับ:</span> {isOneWay ? 'ไม่ต้องกลับ (สิ้นสุดที่บ้าน)' : `${request.allowed_end_time} น.`}
            </div>
          </div>
        </div>

        {/* Celebration Completed Card */}
        {isCompleted && (
          <div className="bg-gradient-to-br from-emerald-950/80 to-teal-900/60 border border-emerald-500/50 rounded-2xl p-4 text-center space-y-2 animate-fadeIn">
            <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-sm text-white">ปิดงานจบคำร้องสมบูรณ์เรียบร้อย!</h3>
            <p className="text-xs text-emerald-200/90 leading-relaxed">
              {isOneWay
                ? 'นักศึกษาเดินทางถึงบ้านพักอาศัยอย่างปลอดภัย ระบบได้บันทึกเวลาและแจ้งให้อาจารย์ผู้ควบคุมทราบแล้วครับ'
                : 'นักศึกษาได้เดินทางกลับถึงวิทยาลัยการอาชีพองครักษ์เรียบร้อยครบถ้วนตามระเบียบครับ'}
            </p>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 mt-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold rounded-xl text-xs transition-colors"
            >
              <span>กลับสู่หน้าหลัก</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>

      {/* Bottom Sticky Action Bar (Dynamic Rider Controls) */}
      {!isCompleted && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 z-40">
          {/* CASE A: One-Way (e.g. Return Home) */}
          {isOneWay ? (
            <button
              onClick={() => handleAction('complete_trip')}
              disabled={submitting}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Home className="w-5 h-5" />
                  <span>📍 ถึงบ้านแล้ว (จบคำร้อง)</span>
                </>
              )}
            </button>
          ) : (
            /* CASE B: Round-Trip (e.g. Hospital / Department Project) */
            <div className="space-y-2">
              {stage === 'heading_to_dest' || stage === 'not_started' ? (
                <button
                  onClick={() => handleAction('arrive_dest')}
                  disabled={submitting}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-blue-900/40 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <MapPin className="w-5 h-5" />
                      <span>📍 ถึงจุดหมายแล้ว ({request.destination_name})</span>
                    </>
                  )}
                </button>
              ) : stage === 'at_dest' ? (
                <div className="space-y-2">
                  <div className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-2 text-center font-medium">
                    📍 อยู่ที่จุดหมายปลายทางแล้ว เมื่อเสร็จธุระกดเริ่มเดินทางกลับ
                  </div>
                  <button
                    onClick={() => handleAction('start_return')}
                    disabled={submitting}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-900 font-bold text-sm shadow-lg shadow-amber-900/30 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {submitting ? (
                      <div className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-900 rounded-full animate-spin" />
                    ) : (
                      <>
                        <RotateCcw className="w-5 h-5" />
                        <span>🔄 เริ่มเดินทางกลับวิทยาลัย</span>
                      </>
                    )}
                  </button>
                </div>
              ) : stage === 'heading_back' ? (
                <button
                  onClick={() => handleAction('arrive_college')}
                  disabled={submitting}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Building2 className="w-5 h-5" />
                      <span>🏁 กลับถึงวิทยาลัยแล้ว (จบคำร้อง)</span>
                    </>
                  )}
                </button>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function TripPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-3">
          <div className="w-10 h-10 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400">กำลังโหลดระบบพิกัดสด Smart Gate Pass AI...</p>
        </div>
      }
    >
      <TripContent />
    </React.Suspense>
  );
}
