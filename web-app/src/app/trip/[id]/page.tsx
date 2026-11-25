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
  Camera,
  X,
  Lock,
  Image as ImageIcon,
} from 'lucide-react';
import { LeaveRequest } from '@/types';

// College coordinates: OICEC (วิทยาลัยการอาชีพองครักษ์)
const OICEC_LAT = 14.109127;
const OICEC_LNG = 101.062441;

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

  // Live Camera Only Modal state
  const [cameraModalOpen, setCameraModalOpen] = useState(false);
  const [cameraAction, setCameraAction] = useState<'dest' | 'return'>('dest');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fileCameraInputRef = useRef<HTMLInputElement | null>(null);

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

  // Open Live Camera
  const openLiveCamera = async (type: 'dest' | 'return') => {
    setCameraAction(type);
    setCapturedPhoto(null);
    setCameraModalOpen(true);

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        setCameraStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }
    } catch (e) {
      console.warn('WebRTC Camera not available or denied, falling back to capture="environment":', e);
    }
  };

  const closeLiveCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setCameraModalOpen(false);
    setCapturedPhoto(null);
  };

  const takeSnapshot = () => {
    if (!videoRef.current) {
      // Trigger file capture fallback
      fileCameraInputRef.current?.click();
      return;
    }

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setCapturedPhoto(dataUrl);

      // Stop camera stream preview
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
        setCameraStream(null);
      }
    }
  };

  const handleMobileFileCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setCapturedPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Upload captured photo and complete check-in
  const handleConfirmLivePhoto = async () => {
    if (!capturedPhoto) return;
    setUploadingPhoto(true);

    try {
      // 1. Upload base64 to server
      const blob = await (await fetch(capturedPhoto)).blob();
      const formData = new FormData();
      formData.append('file', blob, `live-${cameraAction}-${Date.now()}.jpg`);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json();
      const photoUrl = uploadData.success ? uploadData.url : null;

      // 2. Submit trip action with live photo
      const actionToSubmit =
        cameraAction === 'dest'
          ? isOneWay
            ? 'complete_trip'
            : 'arrive_dest'
          : 'arrive_college';

      await handleAction(actionToSubmit, photoUrl);
      closeLiveCamera();
    } catch (e: any) {
      console.error(e);
      alert('เกิดข้อผิดพลาดในการบันทึกภาพถ่าย: ' + e.message);
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Handle Dynamic Actions
  const handleAction = async (
    action: 'arrive_dest' | 'start_return' | 'arrive_college' | 'complete_trip',
    photoUrl?: string | null
  ) => {
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
          photo_url: photoUrl,
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
  const isCompleted =
    stage === 'completed' ||
    request.overall_status === 'returned' ||
    (isOneWay && request.overall_status === 'completed_exit' && request.dest_arrived_at);

  const targetLat = stage === 'heading_back' ? OICEC_LAT : destLat;
  const targetLng = stage === 'heading_back' ? OICEC_LNG : destLng;
  const distanceMeters = calcDistanceMeters(currentCoord.lat, currentCoord.lng, targetLat, targetLng);
  const distanceKm = (distanceMeters / 1000).toFixed(1);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col relative pb-32">
      {/* Top Floating Header with Mandatory Screen Lock */}
      <header className="px-4 py-3 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          {/* Back button ONLY available after trip is completed */}
          {isCompleted ? (
            <Link
              href="/"
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors"
              title="กลับหน้าหลัก"
            >
              <ChevronLeft className="w-5 h-5 text-slate-300" />
            </Link>
          ) : (
            <div
              className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center"
              title="ระบบล็อกหน้าจอจนกว่าจะสิ้นสุดคำร้อง"
            >
              <Lock className="w-4 h-4" />
            </div>
          )}

          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wide text-white">Live Trip Mode</span>
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

      {/* Mandatory Lock Banner for Active Trips */}
      {!isCompleted && (
        <div className="bg-amber-950/70 border-b border-amber-700/50 px-3.5 py-1.5 flex items-center gap-2 text-[11px] text-amber-200">
          <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span>
            <strong>โหมดล็อกหน้าจอการเดินทาง:</strong> กรุณาเช็คอินด้วยภาพถ่ายสดเมื่อถึงจุดหมาย เพื่อความโปร่งใสและปลอดภัย
          </span>
        </div>
      )}

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
              className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-950/60 border border-cyan-800/60 cursor-pointer"
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

        {/* 3-Point Evidence Timeline */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 shadow-sm text-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-2">
            <span className="font-bold text-white flex items-center gap-1.5">
              <Camera className="w-4 h-4 text-cyan-400" />
              <span>หลักฐานการเดินทาง 3 จุด (3-Point Evidence Timeline)</span>
            </span>
            <span className="text-[10px] text-slate-400">ตรวจสอบความโปร่งใส</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {/* Point 1: Request Attachment */}
            <div className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-2 flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-bold text-blue-300">1. ตอนยื่นคำขอ</p>
                <p className="text-[9px] text-slate-400">เอกสาร / แชทผู้ปกครอง</p>
              </div>
              <div className="mt-2 aspect-square rounded-lg overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center relative">
                {request.attachment_path ? (
                  <img
                    src={request.attachment_path}
                    alt="หลักฐาน 1"
                    onClick={() => setPreviewPhotoUrl(request.attachment_path!)}
                    className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                  />
                ) : (
                  <span className="text-[9px] text-slate-500 text-center px-1">ไม่มีเอกสาร (ข้าม)</span>
                )}
              </div>
              <span className="text-[9px] text-emerald-400 font-medium mt-1">✓ ยื่นแล้ว</span>
            </div>

            {/* Point 2: Destination Live Photo */}
            <div className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-2 flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-bold text-amber-300">2. ถึงจุดหมาย</p>
                <p className="text-[9px] text-slate-400">รูปถ่ายสด ณ ปลายทาง</p>
              </div>
              <div className="mt-2 aspect-square rounded-lg overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center relative">
                {request.dest_checkin_photo_path ? (
                  <img
                    src={request.dest_checkin_photo_path}
                    alt="หลักฐาน 2"
                    onClick={() => setPreviewPhotoUrl(request.dest_checkin_photo_path!)}
                    className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                  />
                ) : request.dest_arrived_at ? (
                  <span className="text-[9px] text-emerald-400 font-bold text-center px-1">✓ พิกัดยืนยัน</span>
                ) : (
                  <span className="text-[9px] text-slate-500 text-center px-1">รอเช็คอิน</span>
                )}
              </div>
              <span className="text-[9px] text-slate-400 mt-1 truncate">
                {request.dest_arrived_at ? request.dest_arrived_at.slice(11, 16) + ' น.' : 'ยังไม่ถึง'}
              </span>
            </div>

            {/* Point 3: Return Live Photo */}
            <div className="bg-slate-900/80 border border-slate-700/60 rounded-xl p-2 flex flex-col justify-between">
              <div>
                <p className="text-[10px] font-bold text-emerald-300">3. กลับวิทยาลัย</p>
                <p className="text-[9px] text-slate-400">รูปถ่ายสดรายงานตัว</p>
              </div>
              <div className="mt-2 aspect-square rounded-lg overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center relative">
                {isOneWay ? (
                  <span className="text-[9px] text-slate-400 text-center px-1">ไม่ต้องกลับ (จบที่บ้าน)</span>
                ) : request.return_checkin_photo_path ? (
                  <img
                    src={request.return_checkin_photo_path}
                    alt="หลักฐาน 3"
                    onClick={() => setPreviewPhotoUrl(request.return_checkin_photo_path!)}
                    className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                  />
                ) : request.return_arrived_at ? (
                  <span className="text-[9px] text-emerald-400 font-bold text-center px-1">✓ กลับแล้ว</span>
                ) : (
                  <span className="text-[9px] text-slate-500 text-center px-1">รอรายงานตัว</span>
                )}
              </div>
              <span className="text-[9px] text-slate-400 mt-1 truncate">
                {isOneWay ? 'ไม่กลับ' : request.return_arrived_at ? request.return_arrived_at.slice(11, 16) + ' น.' : 'ยังไม่กลับ'}
              </span>
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
                    <p className="font-semibold text-white">5. รายงานตัวกลับถึงวิทยาลัย (จบคำร้องสมบูรณ์)</p>
                    <p className="text-[10px] text-slate-400">รายงานตัวกลับเรียบร้อย</p>
                  </div>
                </div>
              </>
            )}
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
              className="inline-flex items-center gap-1.5 mt-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-900 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              <span>กลับสู่หน้าหลัก</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>

      {/* Bottom Sticky Action Bar (Live Camera Only Check-in Controls) */}
      {!isCompleted && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 z-40">
          {/* CASE A: One-Way (e.g. Return Home) */}
          {isOneWay ? (
            <button
              onClick={() => openLiveCamera('dest')}
              disabled={submitting}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Camera className="w-5 h-5 text-amber-300" />
                  <span>📸 ถ่ายรูปสดเช็คอินถึงบ้าน (จบคำร้อง)</span>
                </>
              )}
            </button>
          ) : (
            /* CASE B: Round-Trip (e.g. Hospital / Department Project) */
            <div className="space-y-2">
              {stage === 'heading_to_dest' || stage === 'not_started' ? (
                <button
                  onClick={() => openLiveCamera('dest')}
                  disabled={submitting}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm shadow-lg shadow-blue-900/40 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Camera className="w-5 h-5 text-amber-300" />
                      <span>📸 ถ่ายรูปสดเช็คอินถึงจุดหมาย ({request.destination_name})</span>
                    </>
                  )}
                </button>
              ) : stage === 'at_dest' ? (
                <div className="space-y-2">
                  <div className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl p-2 text-center font-medium">
                    📍 เช็คอินจุดหมายเรียบร้อยแล้ว เมื่อเสร็จธุระกดเริ่มเดินทางกลับ
                  </div>
                  <button
                    onClick={() => handleAction('start_return')}
                    disabled={submitting}
                    className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-900 font-bold text-sm shadow-lg shadow-amber-900/30 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
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
                  onClick={() => openLiveCamera('return')}
                  disabled={submitting}
                  className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-900/40 flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Camera className="w-5 h-5 text-amber-300" />
                      <span>📸 ถ่ายรูปสดรายงานตัวกลับถึงวิทยาลัย</span>
                    </>
                  )}
                </button>
              ) : null}
            </div>
          )}
        </div>
      )}

      {/* Live Camera Only Modal */}
      {cameraModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-4 animate-fadeIn">
          {/* Hidden Mobile Camera Input Fallback */}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileCameraInputRef}
            onChange={handleMobileFileCapture}
            className="hidden"
          />

          {/* Top Bar */}
          <div className="w-full max-w-md flex items-center justify-between text-white pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="font-bold text-xs">
                  {cameraAction === 'dest' ? 'ถ่ายภาพสด ณ สถานที่ปลายทาง' : 'ถ่ายภาพสด ณ ประตูวิทยาลัย'}
                </p>
                <p className="text-[10px] text-slate-400">ระบบบังคับเปิดกล้องสดเท่านั้น (ห้ามใช้รูปเก่า)</p>
              </div>
            </div>
            <button
              onClick={closeLiveCamera}
              className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Video Viewport / Photo Preview */}
          <div className="w-full max-w-md flex-1 my-3 relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 flex items-center justify-center">
            {capturedPhoto ? (
              <div className="relative w-full h-full flex items-center justify-center">
                <img src={capturedPhoto} alt="Snapshot Preview" className="w-full h-full object-contain" />
                <div className="absolute bottom-3 left-3 bg-black/75 px-3 py-1.5 rounded-lg text-[10px] font-mono text-emerald-400">
                  📍 {currentCoord.lat.toFixed(4)}, {currentCoord.lng.toFixed(4)} • {new Date().toLocaleTimeString()}
                </div>
              </div>
            ) : (
              <div className="relative w-full h-full flex flex-col items-center justify-center">
                <video ref={videoRef} playsInline autoPlay muted className="w-full h-full object-cover" />
                <div className="absolute top-3 right-3 bg-red-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-white"></span>
                  LIVE CAMERA
                </div>
                <div className="absolute bottom-3 inset-x-3 text-center bg-black/60 backdrop-blur-xs py-1.5 px-2 rounded-lg text-[10px] text-slate-300">
                  หันกล้องไปที่ป้ายสถานที่ หรือถ่ายภาพบริเวณที่อยู่เพื่อยืนยัน
                </div>
              </div>
            )}
          </div>

          {/* Shutter / Confirm Controls */}
          <div className="w-full max-w-md flex flex-col gap-2 pt-2">
            {capturedPhoto ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => openLiveCamera(cameraAction)}
                  className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>ถ่ายใหม่</span>
                </button>
                <button
                  type="button"
                  onClick={handleConfirmLivePhoto}
                  disabled={uploadingPhoto}
                  className="py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg flex items-center justify-center gap-1.5 transition-all"
                >
                  {uploadingPhoto ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>ยืนยันและเช็คอิน</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={takeSnapshot}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-sm shadow-lg flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <Camera className="w-5 h-5 text-amber-200" />
                  <span>📸 กดชัตเตอร์ถ่ายภาพสด</span>
                </button>
                <button
                  type="button"
                  onClick={() => fileCameraInputRef.current?.click()}
                  className="text-[11px] text-slate-400 hover:text-slate-200 text-center py-1 underline cursor-pointer"
                >
                  เปิดกล้องด้วยแอปกล้องของเครื่อง (มือถือ)
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full Photo Modal Viewer */}
      {previewPhotoUrl && (
        <div
          onClick={() => setPreviewPhotoUrl(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 cursor-pointer"
        >
          <img src={previewPhotoUrl} alt="Photo Preview" className="max-w-full max-h-[85vh] rounded-2xl object-contain shadow-2xl" />
          <p className="text-white text-xs mt-3 bg-black/50 px-3 py-1 rounded-full">แตะที่ใดก็ได้เพื่อปิด</p>
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