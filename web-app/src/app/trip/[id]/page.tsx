'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  Home,
  Check,
  Camera,
  X,
  Lock,
  Image as ImageIcon,
  Crosshair,
  Radio,
  Signal,
  Smartphone,
  Monitor,
} from 'lucide-react';
import { LeaveRequest } from '@/types';
import { useAuth } from '@/context/AuthContext';

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
  const { user } = useAuth();

  const [request, setRequest] = useState<LeaveRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Determine role: Student on mobile sends GPS; Teacher on PC monitors
  const isStudent = user?.role === 'student' || user?.id === request?.student_id;

  // Real-time Live Coordinates
  const [currentCoord, setCurrentCoord] = useState<{ lat: number; lng: number }>({
    lat: OICEC_LAT,
    lng: OICEC_LNG,
  });
  const [gpsAccuracy, setGpsAccuracy] = useState<number | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [lastPingAt, setLastPingAt] = useState<string | null>(null);
  const [autoCenter, setAutoCenter] = useState(false);

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
  const destMarkerRef = useRef<any>(null);

  // Helper to build/update popup HTML dynamically
  const buildPopupHtml = useCallback(
    (lat: number, lng: number, timeStr?: string) => {
      const studentName = request?.student_name || 'นายอัครชา เปมะวิภาต';
      const classGroup = request?.group_code || 'ปวส.2/1';
      return `
        <div style="font-family:sans-serif;font-size:12px;padding:3px;min-width:180px;">
          <div style="font-weight:bold;color:#0f172a;font-size:13px;margin-bottom:2px;">${studentName} (${classGroup})</div>
          <div style="color:#10b981;font-weight:600;display:flex;align-items:center;gap:4px;margin-bottom:4px;">
            <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:#10b981;"></span>
            <span>กำลังส่งสัญญาณ GPS สด</span>
          </div>
          <div style="background:#f1f5f9;padding:4px 6px;border-radius:6px;font-family:monospace;font-size:11px;color:#1e293b;border:1px solid #e2e8f0;">
            พิกัด: ${lat.toFixed(5)}, ${lng.toFixed(5)}
          </div>
          <div style="color:#64748b;font-size:10px;margin-top:4px;">
            อัปเดตล่าสุด: ${timeStr || lastPingAt || 'เรียลไทม์'}
          </div>
        </div>
      `;
    },
    [request?.student_name, request?.group_code, lastPingAt]
  );

  // Load request data from server
  const fetchRequest = async () => {
    try {
      const res = await fetch(`/api/requests/${requestId}/trip`);
      const data = await res.json();
      if (data.success && data.request) {
        setRequest(data.request);
        const req = data.request;

        const liveLat = req.current_lat || OICEC_LAT;
        const liveLng = req.current_lng || OICEC_LNG;

        setCurrentCoord({ lat: liveLat, lng: liveLng });
        if (data.latestLoc?.recorded_at) {
          setLastPingAt(data.latestLoc.recorded_at.slice(11, 19) + ' น.');
        }

        if (riderMarkerRef.current) {
          riderMarkerRef.current.setLatLng([liveLat, liveLng]);
          const popup = riderMarkerRef.current.getPopup();
          if (popup) {
            popup.setContent(buildPopupHtml(liveLat, liveLng, data.latestLoc?.recorded_at?.slice(11, 19)));
          }
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

  const stage = request?.trip_stage || 'heading_to_dest';
  const isCompleted =
    stage === 'completed' ||
    request?.overall_status === 'returned' ||
    (isOneWay && request?.overall_status === 'completed_exit' && request?.dest_arrived_at);

  // Initialize Leaflet Map
  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current || !request) return;

    let isMounted = true;

    async function initMap() {
      const L = await import('leaflet');

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

      const initialLat = currentReq.current_lat || OICEC_LAT;
      const initialLng = currentReq.current_lng || OICEC_LNG;

      const map = L.map(mapContainerRef.current!, {
        center: [initialLat, initialLng],
        zoom: 15,
        zoomControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      // 1. College Marker (วิทยาลัยการอาชีพองครักษ์)
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
        .bindPopup('<b>วิทยาลัยการอาชีพองครักษ์ (OICEC)</b><br>จุดเริ่มต้น / ประตูวิทยาลัย');

      // 2. Destination Marker (ปลายทาง)
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
      const destMarker = L.marker([destLat, destLng], { icon: destIcon })
        .addTo(map)
        .bindPopup(`<b>${currentReq.destination_name || 'จุดหมายปลายทาง'}</b><br>เป้าหมายการเดินทาง`);
      destMarkerRef.current = destMarker;

      // 3. Student Avatar Marker with Green Radar Pulse
      const avatarSrc =
        currentReq.avatar_url ||
        `/uploads/faces/${currentReq.student_id}/straight.jpg` ||
        'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150';
      const studentName = currentReq.student_name || 'นักเรียน';
      const classGroup = currentReq.group_code || 'ปวส.2/1';

      const studentIcon = L.divIcon({
        className: 'student-radar-pin',
        html: `
          <div style="position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;width:160px;height:90px;pointer-events:auto;cursor:pointer;">
            <div style="position:absolute;top:28px;left:50%;transform:translate(-50%,-50%);width:78px;height:78px;border-radius:50%;background:rgba(34,197,94,0.3);animation:ping 2s cubic-bezier(0,0,0.2,1) infinite;pointer-events:none;"></div>
            <div style="position:absolute;top:28px;left:50%;transform:translate(-50%,-50%);width:58px;height:58px;border-radius:50%;background:rgba(16,185,129,0.35);border:2px solid rgba(52,211,153,0.7);pointer-events:none;"></div>

            <div style="position:relative;width:50px;height:50px;border-radius:50%;overflow:hidden;border:3px solid #10b981;box-shadow:0 0 16px rgba(16,185,129,0.8),0 4px 12px rgba(0,0,0,0.6);background:#0f172a;z-index:10;">
              <img src="${avatarSrc}" alt="${studentName}" style="width:100%;height:100%;object-fit:cover;" onerror="this.onerror=null; this.src='https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150';" />
              <span style="position:absolute;bottom:2px;right:2px;width:11px;height:11px;border-radius:50%;background:#22c55e;border:2px solid #ffffff;box-shadow:0 0 6px #22c55e;"></span>
            </div>

            <div style="margin-top:6px;background:rgba(15,23,42,0.95);color:#ffffff;padding:2.5px 9px;border-radius:9999px;font-size:11px;font-weight:700;border:1.5px solid #10b981;box-shadow:0 3px 10px rgba(0,0,0,0.5);white-space:nowrap;display:flex;align-items:center;gap:4px;z-index:10;">
              <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:#22c55e;"></span>
              <span>${studentName}</span>
              <span style="color:#6ee7b7;font-size:10px;font-weight:500;">(${classGroup})</span>
            </div>
          </div>
        `,
        iconSize: [160, 90],
        iconAnchor: [80, 28],
      });

      const riderMarker = L.marker([initialLat, initialLng], {
        icon: studentIcon,
        zIndexOffset: 1000,
      }).addTo(map);

      riderMarker.bindPopup(buildPopupHtml(initialLat, initialLng));

      riderMarkerRef.current = riderMarker;
      mapInstanceRef.current = map;

      // Fit bounds
      const bounds = L.latLngBounds([[initialLat, initialLng], [destLat, destLng]]);
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
    }

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [request?.id, buildPopupHtml]);

  // STUDENT TRANSMITTER: Only runs when current user is the student on mobile
  useEffect(() => {
    if (!isStudent || isCompleted) return;
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGpsError('เบราว์เซอร์ไม่รองรับ Geolocation API');
      return;
    }

    // Attempt to keep screen awake on mobile
    if ('wakeLock' in navigator) {
      try {
        (navigator as any).wakeLock.request('screen').catch(() => {});
      } catch {}
    }

    let lastPingTime = 0;

    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = Math.round(pos.coords.accuracy);
        const speed = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;
        const heading = pos.coords.heading || 0;

        setGpsAccuracy(accuracy);
        setGpsError(null);
        setCurrentCoord({ lat, lng });

        const timeStr = new Date().toLocaleTimeString('th-TH');
        setLastPingAt(timeStr);

        if (riderMarkerRef.current) {
          riderMarkerRef.current.setLatLng([lat, lng]);
          const popup = riderMarkerRef.current.getPopup();
          if (popup) {
            popup.setContent(buildPopupHtml(lat, lng, timeStr));
          }
        }

        if (autoCenter && mapInstanceRef.current) {
          mapInstanceRef.current.panTo([lat, lng]);
        }

        // Throttle transmission to server every 4 seconds
        const now = Date.now();
        if (now - lastPingTime > 4000) {
          lastPingTime = now;
          try {
            await fetch(`/api/requests/${requestId}/trip`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'ping_gps',
                lat,
                lng,
                speed,
                heading,
              }),
            });
          } catch (err) {
            console.error('Failed to transmit GPS:', err);
          }
        }
      },
      (err) => {
        console.warn('Geolocation status:', err);
        if (err.code === 1) {
          setGpsError('โปรดอนุญาตสิทธิ์เข้าถึงพิกัด GPS บนมือถือ');
        } else {
          setGpsError('กำลังเชื่อมต่อสัญญาณดาวเทียม GPS...');
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [isStudent, isCompleted, requestId, autoCenter, buildPopupHtml]);

  // TEACHER / VIEWER RADAR POLLER: Runs on Teacher's PC to display live student position
  useEffect(() => {
    if (isCompleted) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/requests/${requestId}/trip`);
        const data = await res.json();
        if (data.success && data.request) {
          const r = data.request;
          setRequest(r);

          if (r.current_lat && r.current_lng) {
            setCurrentCoord({ lat: r.current_lat, lng: r.current_lng });
            const timeStr = data.latestLoc?.recorded_at
              ? data.latestLoc.recorded_at.slice(11, 19) + ' น.'
              : new Date().toLocaleTimeString('th-TH');

            setLastPingAt(timeStr);

            if (riderMarkerRef.current) {
              riderMarkerRef.current.setLatLng([r.current_lat, r.current_lng]);
              const popup = riderMarkerRef.current.getPopup();
              if (popup) {
                popup.setContent(buildPopupHtml(r.current_lat, r.current_lng, timeStr));
              }
            }

            if (autoCenter && mapInstanceRef.current) {
              mapInstanceRef.current.panTo([r.current_lat, r.current_lng]);
            }
          }
        }
      } catch (err) {
        console.error('Teacher polling error:', err);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [requestId, isCompleted, autoCenter, buildPopupHtml]);

  // Center map on student marker
  const centerOnStudent = () => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.setView([currentCoord.lat, currentCoord.lng], 16, { animate: true });
    }
  };

  // Open Live Camera (for Student Check-in)
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
      console.warn('WebRTC Camera fallback:', e);
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

  const handleConfirmLivePhoto = async () => {
    if (!capturedPhoto) return;
    setUploadingPhoto(true);

    try {
      const blob = await (await fetch(capturedPhoto)).blob();
      const formData = new FormData();
      formData.append('file', blob, `live-${cameraAction}-${Date.now()}.jpg`);

      const uploadRes = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json();
      const photoUrl = uploadData.success ? uploadData.url : null;

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
        <p className="text-xs text-slate-400">กำลังเชื่อมต่อระบบเรดาร์ติดตามพิกัด Smart Gate Pass AI...</p>
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

  const targetLat = stage === 'heading_back' ? OICEC_LAT : destLat;
  const targetLng = stage === 'heading_back' ? OICEC_LNG : destLng;
  const distanceMeters = calcDistanceMeters(currentCoord.lat, currentCoord.lng, targetLat, targetLng);
  const distanceKm = (distanceMeters / 1000).toFixed(1);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col relative pb-32">
      {/* Top Floating Header */}
      <header className="px-4 py-3 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors"
            title="กลับหน้าหลัก"
          >
            <ChevronLeft className="w-5 h-5 text-slate-300" />
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wide text-white">
                {isStudent ? 'โหมดนำทาง (มือถือนักเรียน)' : 'เรดาร์ติดตามสด (จออาจารย์)'}
              </span>
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                {isStudent ? 'GPS สดมือถือ' : 'คอมฯ เฝ้าดูสด'}
              </span>
            </div>
            <p className="text-[10px] text-slate-400">
              {request.request_code} • {request.student_name} ({request.group_code || 'ปวส.'})
            </p>
          </div>
        </div>

        <button
          onClick={fetchRequest}
          className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300 transition-colors"
          title="รีเฟรชข้อมูลพิกัดล่าสุด"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </header>

      {/* Role-Specific Live Status Banner */}
      <div className="bg-emerald-950/70 border-b border-emerald-800/50 px-3.5 py-1.5 flex items-center justify-between gap-2 text-[11px] text-emerald-200">
        <div className="flex items-center gap-2">
          {isStudent ? (
            <Smartphone className="w-3.5 h-3.5 text-emerald-400 shrink-0 animate-pulse" />
          ) : (
            <Monitor className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
          )}
          <span>
            {isStudent ? (
              <strong>มือถือนักเรียน:</strong>
            ) : (
              <strong>จอคอมพิวเตอร์อาจารย์:</strong>
            )}{' '}
            {isStudent
              ? 'กำลังส่งพิกัด GPS จริงจากมือถือให้อาจารย์แบบเรียลไทม์'
              : `กำลังรับสัญญาณติดตามตำแหน่งสดของ ${request.student_name}`}
          </span>
        </div>
        {lastPingAt && (
          <span className="text-[10px] text-emerald-300/80 shrink-0 font-mono">
            {lastPingAt}
          </span>
        )}
      </div>

      {/* Full-bleed Interactive Leaflet Map */}
      <div className="relative w-full h-80 sm:h-96 bg-slate-950 border-b border-slate-800">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Live Distance Overlay Badge */}
        <div className="absolute top-3 left-3 z-[400] bg-slate-900/90 backdrop-blur-md border border-slate-700/80 px-3 py-1.5 rounded-xl shadow-lg flex items-center gap-2 text-xs">
          <Navigation className="w-4 h-4 text-emerald-400 animate-pulse" />
          <div>
            <div className="text-[10px] text-slate-400">ระยะห่างถึงเป้าหมาย</div>
            <div className="font-bold text-white text-xs">
              {distanceMeters > 1000 ? `${distanceKm} กม.` : `${distanceMeters} เมตร`}
            </div>
          </div>
        </div>

        {/* Status Chip */}
        <div className="absolute top-3 right-3 z-[400] bg-slate-900/90 backdrop-blur-md border border-slate-700/80 px-2.5 py-1.5 rounded-xl text-[11px] font-semibold shadow-lg text-emerald-400 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>
            {isCompleted
              ? 'สิ้นสุดการเดินทาง ✓'
              : stage === 'at_dest'
              ? 'ถึงที่หมายแล้ว 📍'
              : 'กำลังเดินทาง 🚶'}
          </span>
        </div>

        {/* Focus Student Floating Button on Map */}
        <button
          onClick={centerOnStudent}
          className="absolute bottom-3 right-3 z-[400] bg-slate-900/95 hover:bg-slate-800 border border-emerald-500/50 text-emerald-400 px-3 py-1.5 rounded-xl shadow-xl flex items-center gap-1.5 text-xs font-bold transition-all active:scale-95 cursor-pointer backdrop-blur-md"
        >
          <Crosshair className="w-4 h-4 text-emerald-400" />
          <span>🎯 โฟกัสตัวนักเรียน</span>
        </button>
      </div>

      {/* Main Body Content */}
      <div className="p-4 space-y-4">
        {/* Real-time Status Card */}
        <div className="bg-slate-800/90 border border-slate-700/80 rounded-2xl p-4 shadow-md space-y-3">
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                {isStudent ? <Smartphone className="w-4 h-4" /> : <Monitor className="w-4 h-4" />}
              </div>
              <div>
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>
                    {isStudent ? 'สถานะเครื่องส่ง GPS (มือถือนักเรียน)' : 'สถานะเรดาร์ติดตามตัว (จอคอมฯ อาจารย์)'}
                  </span>
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                </h3>
                <p className="text-[10px] text-slate-400">
                  {request.student_name} ({request.group_code || 'ปวส.'})
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300 bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-700/80">
              <Signal className="w-3 h-3 text-emerald-400 animate-pulse" />
              <span>เรียลไทม์ (Live)</span>
            </div>
          </div>

          {/* GPS Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-2.5">
              <div className="text-[10px] text-slate-400">พิกัดดาวเทียมปัจจุบัน</div>
              <div className="font-mono font-bold text-emerald-400 text-[11px] mt-0.5">
                {currentCoord.lat.toFixed(5)}, {currentCoord.lng.toFixed(5)}
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-2.5">
              <div className="text-[10px] text-slate-400">ปลายทางที่ได้รับอนุญาต</div>
              <div className="font-bold text-white text-[11px] mt-0.5 truncate">
                {request.destination_name}
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-700/50 rounded-xl p-2.5 col-span-2 sm:col-span-1">
              <div className="text-[10px] text-slate-400">เวลาอัปเดตล่าสุด</div>
              <div className="font-semibold text-slate-200 text-[11px] mt-0.5 font-mono">
                {lastPingAt || 'กำลังรับสัญญาณ'}
              </div>
            </div>
          </div>

          {gpsError && (
            <div className="text-[11px] text-amber-300 bg-amber-950/60 border border-amber-700/60 rounded-xl p-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>{gpsError}</span>
            </div>
          )}
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
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white ${
                  stage !== 'not_started' ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <Check className="w-3.5 h-3.5" />
              </div>
              <div className="text-xs">
                <p className="font-semibold text-white">2. กำลังเดินทางไป {request.destination_name}</p>
                <p className="text-[10px] text-slate-400">แชร์พิกัด GPS สดจากมือถือตลอดทาง</p>
              </div>
            </div>

            {/* Step 3: Arrived Dest */}
            <div className="flex items-center gap-3">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white ${
                  ['at_dest', 'heading_back', 'completed'].includes(stage) || (isOneWay && isCompleted)
                    ? 'bg-emerald-500'
                    : 'bg-slate-700 text-slate-400'
                }`}
              >
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
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white ${
                      ['heading_back', 'completed'].includes(stage) ? 'bg-emerald-500' : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {['heading_back', 'completed'].includes(stage) ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <span className="text-[10px]">4</span>
                    )}
                  </div>
                  <div className="text-xs">
                    <p className="font-semibold text-white">4. เดินทางกลับเข้าวิทยาลัย</p>
                    <p className="text-[10px] text-slate-400">ก่อนกำหนดเวลา {request.allowed_end_time} น.</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-white ${
                      isCompleted ? 'bg-emerald-500' : 'bg-slate-700 text-slate-400'
                    }`}
                  >
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

      {/* Bottom Sticky Action Bar */}
      {!isCompleted && (
        <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 z-40">
          {/* A. If Viewer is Teacher / Not Student: Teacher View Controls */}
          {!isStudent ? (
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={centerOnStudent}
                className="flex-1 py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98"
              >
                <Crosshair className="w-4 h-4" />
                <span>โฟกัสตัวนักเรียน</span>
              </button>
              <button
                onClick={fetchRequest}
                className="flex-1 py-3 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-lg cursor-pointer transition-all active:scale-98"
              >
                <RotateCcw className="w-4 h-4" />
                <span>รีเฟรชพิกัดสด</span>
              </button>
            </div>
          ) : (
            /* B. If Viewer is Student: Camera Check-in Controls */
            <div>
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
        </div>
      )}

      {/* Live Camera Only Modal */}
      {cameraModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-between p-4 animate-fadeIn">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileCameraInputRef}
            onChange={handleMobileFileCapture}
            className="hidden"
          />

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
