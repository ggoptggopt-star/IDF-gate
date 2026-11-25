'use client';

import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Home, CheckCircle2, Crosshair, X, Building2, Store } from 'lucide-react';

interface ChatMapPickerProps {
  onSelect: (location: { name: string; lat: number; lng: number; isReturnRequired: number }) => void;
  onCancel?: () => void;
  initialLat?: number;
  initialLng?: number;
  initialName?: string;
}

// College coordinates: OICEC (วิทยาลัยการอาชีพองครักษ์)
const OICEC_LAT = 14.1285;
const OICEC_LNG = 100.9985;

// Popular destinations around Ongkharak
const DESTINATION_PRESETS = [
  { name: 'โรงพยาบาลองครักษ์', lat: 14.1205, lng: 101.0020, icon: '🏥', isReturn: 1 },
  { name: 'ตลาดองครักษ์', lat: 14.1220, lng: 101.0050, icon: '🛍️', isReturn: 1 },
  { name: 'บ้านพัก (คลอง 15)', lat: 14.1120, lng: 100.9450, icon: '🏠', isReturn: 0 },
  { name: 'บ้านพัก (คลอง 16)', lat: 14.1350, lng: 100.9200, icon: '🏠', isReturn: 0 },
];

function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export default function ChatMapPicker({
  onSelect,
  onCancel,
  initialLat,
  initialLng,
  initialName = 'สถานที่ปลายทาง',
}: ChatMapPickerProps) {
  const [selectedLat, setSelectedLat] = useState(initialLat || 14.1205);
  const [selectedLng, setSelectedLng] = useState(initialLng || 101.0020);
  const [locationName, setLocationName] = useState(initialName);
  const [isReturn, setIsReturn] = useState(initialName.includes('บ้าน') ? 0 : 1);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  // Initialize Leaflet Map safely on client
  useEffect(() => {
    let isMounted = true;

    async function initLeaflet() {
      if (typeof window === 'undefined' || !mapContainerRef.current) return;

      const L = await import('leaflet');

      // Inject Leaflet CSS if not already present
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      if (!isMounted || mapInstanceRef.current) return;

      const map = L.map(mapContainerRef.current, {
        center: [selectedLat, selectedLng],
        zoom: 13,
        zoomControl: false,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map);

      // Custom Pin Icon
      const pinIcon = L.divIcon({
        className: 'custom-dest-pin',
        html: `
          <div style="
            background: #ef4444;
            color: white;
            width: 34px;
            height: 34px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            border: 2px solid white;
          ">
            <span style="transform: rotate(45deg); font-size: 16px;">📍</span>
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
      });

      const marker = L.marker([selectedLat, selectedLng], {
        icon: pinIcon,
        draggable: true,
      }).addTo(map);

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setSelectedLat(pos.lat);
        setSelectedLng(pos.lng);
      });

      map.on('click', (e: any) => {
        marker.setLatLng(e.latlng);
        setSelectedLat(e.latlng.lat);
        setSelectedLng(e.latlng.lng);
      });

      mapInstanceRef.current = map;
      markerRef.current = marker;
    }

    initLeaflet();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const updatePin = (lat: number, lng: number, name: string, returnReq: number) => {
    setSelectedLat(lat);
    setSelectedLng(lng);
    setLocationName(name);
    setIsReturn(returnReq);

    if (mapInstanceRef.current && markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      mapInstanceRef.current.panTo([lat, lng]);
    }
  };

  const handleGetCurrentLocation = () => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      alert('เบราว์เซอร์ไม่รองรับ GPS');
      return;
    }

    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsLoading(false);
        updatePin(pos.coords.latitude, pos.coords.longitude, 'พิกัด GPS ปัจจุบัน', 0);
      },
      (err) => {
        setGpsLoading(false);
        console.warn(err);
        alert('ไม่สามารถดึงตำแหน่งปัจจุบันได้ กรุณาแตะเลือกบนแผนที่หรือเลือกสถานที่ใกล้เคียง');
      },
      { enableHighAccuracy: true, timeout: 7000 }
    );
  };

  const distance = calculateDistanceKm(OICEC_LAT, OICEC_LNG, selectedLat, selectedLng);

  const handleConfirm = () => {
    setConfirmed(true);
    onSelect({
      name: locationName,
      lat: Number(selectedLat.toFixed(5)),
      lng: Number(selectedLng.toFixed(5)),
      isReturnRequired: isReturn,
    });
  };

  if (confirmed) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 my-2 text-emerald-800 text-xs shadow-sm flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div>
          <p className="font-semibold text-emerald-950">บันทึกพิกัดสถานที่เรียบร้อยแล้ว ✓</p>
          <p className="text-[11px] text-emerald-700">
            {locationName} (ระยะห่างจาก วก.องครักษ์ {distance} กม.) • {isReturn === 0 ? 'กรณีไม่กลับเข้าวิทยาลัย' : 'กรณีต้องกลับเข้าวิทยาลัย'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-blue-200/80 rounded-2xl p-3 my-2 shadow-md text-xs text-slate-800 space-y-2.5">
      <div className="flex items-center justify-between pb-1.5 border-b border-slate-100">
        <div className="flex items-center gap-1.5 font-bold text-blue-900">
          <MapPin className="w-4 h-4 text-rose-500" />
          <span>ปักหมุดระบุตำแหน่งปลายทาง (Interactive Map)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
            {distance} กม. จากวิทยาลัย
          </span>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-600 p-0.5"
              title="ปิดแผนที่"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <p className="text-[11px] text-slate-600 leading-tight">
        แตะเลือกบนแผนที่ หรือเลื่อนหมุดสีแดงไปยังจุดหมายที่ต้องการเดินทางไป:
      </p>

      {/* Preset Buttons */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={handleGetCurrentLocation}
          disabled={gpsLoading}
          className="px-2.5 py-1 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 text-[11px] font-medium flex items-center gap-1 transition-all shadow-xs"
        >
          {gpsLoading ? (
            <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <Crosshair className="w-3.5 h-3.5" />
          )}
          <span>GPS ปัจจุบัน</span>
        </button>

        {DESTINATION_PRESETS.map((preset, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => updatePin(preset.lat, preset.lng, preset.name, preset.isReturn)}
            className="px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-medium transition-colors flex items-center gap-1"
          >
            <span>{preset.icon}</span>
            <span>{preset.name}</span>
          </button>
        ))}
      </div>

      {/* Mini Leaflet Map */}
      <div className="relative rounded-xl overflow-hidden border border-slate-200 h-44 bg-slate-100">
        <div ref={mapContainerRef} className="w-full h-full" />
        <div className="absolute top-2 left-2 z-[400] bg-white/90 backdrop-blur-xs px-2 py-1 rounded-md text-[10px] shadow-xs text-slate-700 flex items-center gap-1 font-mono">
          <MapPin className="w-3 h-3 text-rose-500" />
          <span>{selectedLat.toFixed(4)}, {selectedLng.toFixed(4)}</span>
        </div>
      </div>

      {/* Return Option Toggle */}
      <div className="flex items-center justify-between px-1 py-1 bg-slate-50 rounded-xl text-[11px] text-slate-600">
        <span>การเดินทางกลับ:</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsReturn(1)}
            className={`px-2.5 py-0.5 rounded-lg font-medium transition-all ${
              isReturn === 1 ? 'bg-blue-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            ต้องกลับวิทยาลัย
          </button>
          <button
            type="button"
            onClick={() => setIsReturn(0)}
            className={`px-2.5 py-0.5 rounded-lg font-medium transition-all ${
              isReturn === 0 ? 'bg-amber-600 text-white shadow-xs' : 'bg-white text-slate-600 border border-slate-200'
            }`}
          >
            กลับบ้านเลย (ไม่กลับ)
          </button>
        </div>
      </div>

      {/* Confirm Button */}
      <button
        type="button"
        onClick={handleConfirm}
        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-xs shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
      >
        <CheckCircle2 className="w-4 h-4" />
        <span>ยืนยันพิกัดจุดหมาย: {locationName} ({distance} กม.)</span>
      </button>
    </div>
  );
}