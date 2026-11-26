'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Search,
  Crosshair,
  X,
  CheckCircle2,
  Clock,
  ChevronDown,
  Loader2,
  AlertCircle,
  Layers,
  Sparkles,
  Paperclip,
  Image as ImageIcon,
  Trash2,
} from 'lucide-react';
import { calcDistanceKm, OICEC_COLLEGE } from '@/lib/ongkharakLocations';

export interface LocationTimeResult {
  name: string;
  lat: number;
  lng: number;
  isReturnRequired: number;
  startTime: string;
  endTime: string;
  attachmentPath?: string | null;
}

interface ChatMapPickerProps {
  onSelect: (result: LocationTimeResult) => void;
  onCancel?: () => void;
  initialLat?: number;
  initialLng?: number;
  initialName?: string;
  initialStartTime?: string;
  initialEndTime?: string;
}

// Preset class time slots
const TIME_SLOT_PRESETS = [
  { label: '🍱 พักเที่ยง', start: '12:00', end: '13:00' },
  { label: '📚 ช่วงบ่าย', start: '13:00', end: '16:30' },
  { label: '🌅 หลังเลิกเรียน', start: '16:30', end: '18:00' },
];

export default function ChatMapPicker({
  onSelect,
  onCancel,
  initialLat,
  initialLng,
  initialName = 'วิทยาลัยการอาชีพองครักษ์ (ป้อมประตู 1)',
  initialStartTime = '12:00',
  initialEndTime = '13:00',
}: ChatMapPickerProps) {
  const [selectedLat, setSelectedLat] = useState(initialLat || OICEC_COLLEGE.lat);
  const [selectedLng, setSelectedLng] = useState(initialLng || OICEC_COLLEGE.lng);
  const [locationName, setLocationName] = useState(initialName);
  const [locationAddress, setLocationAddress] = useState<string>('อ.องครักษ์ จ.นครนายก');
  const [isReturn, setIsReturn] = useState(initialName.includes('บ้าน') || initialName.includes('หอพัก') ? 0 : 1);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [selectedSlotPreset, setSelectedSlotPreset] = useState<string>('🍱 พักเที่ยง');

  // Map layer: 'satellite' (Google Maps Hybrid) vs 'roadmap' (Google Maps Roads)
  const [mapLayer, setMapLayer] = useState<'satellite' | 'roadmap'>('satellite');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [aiInterpretation, setAiInterpretation] = useState<string | null>(null);

  // Evidence Attachment state
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [gpsLoading, setGpsLoading] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const searchTimeoutRef = useRef<any>(null);

  // Initialize Google Maps in Leaflet safely on client
  useEffect(() => {
    let isMounted = true;

    async function initLeaflet() {
      if (typeof window === 'undefined' || !mapContainerRef.current) return;

      const L = await import('leaflet');

      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      const map = L.map(mapContainerRef.current, {
        center: [selectedLat, selectedLng],
        zoom: 15,
        zoomControl: true,
      });

      const tileUrl =
        mapLayer === 'satellite'
          ? 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
          : 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';

      const tileLayer = L.tileLayer(tileUrl, {
        attribution: mapLayer === 'satellite' ? '&copy; Google Satellite' : '&copy; Google Maps',
        maxZoom: 20,
      }).addTo(map);

      tileLayerRef.current = tileLayer;

      // Custom red marker pin
      const redPinIcon = L.divIcon({
        className: 'custom-pin',
        html: `
          <div style="position: relative; width: 34px; height: 42px; transform: translate(-50%, -100%);">
            <svg viewBox="0 0 24 24" width="34" height="42" fill="#E11D48" stroke="#FFFFFF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0 3px 5px rgba(0,0,0,0.45));">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
              <circle cx="12" cy="10" r="3.2" fill="#FFFFFF"></circle>
            </svg>
            <div style="position: absolute; bottom: 0; left: 50%; width: 10px; height: 4px; background: rgba(0,0,0,0.3); border-radius: 50%; transform: translateX(-50%);"></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0],
      });

      const marker = L.marker([selectedLat, selectedLng], {
        icon: redPinIcon,
        draggable: true,
      }).addTo(map);

      marker.on('dragend', (e: any) => {
        const pos = e.target.getLatLng();
        setSelectedLat(pos.lat);
        setSelectedLng(pos.lng);
        setLocationAddress(`พิกัดปักหมุดเอง (${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)})`);
      });

      map.on('click', (e: any) => {
        marker.setLatLng(e.latlng);
        setSelectedLat(e.latlng.lat);
        setSelectedLng(e.latlng.lng);
        setLocationAddress(`พิกัดปักหมุดเอง (${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)})`);
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

  // Handle Layer Toggle (Roadmap vs Satellite)
  const toggleMapLayer = async () => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const L = await import('leaflet');
    const nextLayer = mapLayer === 'satellite' ? 'roadmap' : 'satellite';
    setMapLayer(nextLayer);

    mapInstanceRef.current.removeLayer(tileLayerRef.current);
    const tileUrl =
      nextLayer === 'satellite'
        ? 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
        : 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';

    const newLayer = L.tileLayer(tileUrl, {
      attribution: nextLayer === 'satellite' ? '&copy; Google Satellite' : '&copy; Google Maps',
      maxZoom: 20,
    }).addTo(mapInstanceRef.current);

    tileLayerRef.current = newLayer;
  };

  const updatePin = (lat: number, lng: number, name: string, returnReq?: number, address?: string) => {
    setSelectedLat(lat);
    setSelectedLng(lng);
    setLocationName(name);
    if (address) setLocationAddress(address);
    if (returnReq !== undefined) {
      setIsReturn(returnReq);
    }

    if (mapInstanceRef.current && markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
      mapInstanceRef.current.flyTo([lat, lng], 16, { duration: 0.8 });
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
        updatePin(pos.coords.latitude, pos.coords.longitude, 'พิกัด GPS ปัจจุบันของฉัน', 0, 'ดึงตำแหน่งจาก GPS ในอุปกรณ์');
      },
      (err) => {
        setGpsLoading(false);
        console.warn(err);
        alert('ไม่สามารถดึงตำแหน่งปัจจุบันได้ กรุณาลากหมุดบนแผนที่หรือพิมพ์ค้นหาสถานที่ครับ');
      },
      { enableHighAccuracy: true, timeout: 7000 }
    );
  };

  // Instant Search Handler (Runs directly on Longdo Map API + AI via /api/geocode)
  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    setSearchError(null);

    if (!text.trim()) {
      setSearchResults([]);
      setAiInterpretation(null);
      return;
    }

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/geocode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: text.trim(),
            userLat: selectedLat,
            userLng: selectedLng,
          }),
        });
        const data = await res.json();
        if (data.success && data.results && data.results.length > 0) {
          setSearchResults(data.results);
          setAiInterpretation(data.aiInterpretation || null);
        }
      } catch (err) {
        // silent fallback
      }
    }, 300);
  };

  const handleSearchSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    try {
      const res = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          userLat: selectedLat,
          userLng: selectedLng,
        }),
      });
      const data = await res.json();
      if (data.success && data.results && data.results.length > 0) {
        setSearchResults(data.results);
        setAiInterpretation(data.aiInterpretation || null);
        const top = data.results[0];
        updatePin(top.lat, top.lng, top.name, top.isReturn, top.address);
      } else {
        setSearchError(data.error || `ไม่พบ "${query}" แนะนำระบุชื่อสถานที่ให้สั้นลง หรือแตะลากหมุดบนแผนที่ได้เลยครับ`);
      }
    } catch (err) {
      setSearchError('ไม่สามารถเชื่อมต่อระบบค้นหาได้ชั่วคราว ลองแตะเลือกบนภาพถ่ายดาวเทียมได้โดยตรงครับ');
    } finally {
      setIsSearching(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (data.success && data.fileUrl) {
        setAttachmentUrl(data.fileUrl);
      } else {
        alert(data.error || 'อัปโหลดรูปภาพไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      }
    } catch (err) {
      console.error('Upload error:', err);
      alert('เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ');
    } finally {
      setIsUploading(false);
    }
  };

  const handleApplyPresetSlot = (preset: typeof TIME_SLOT_PRESETS[0]) => {
    setSelectedSlotPreset(preset.label);
    setStartTime(preset.start);
    setEndTime(preset.end);
  };

  const distance = calcDistanceKm(OICEC_COLLEGE.lat, OICEC_COLLEGE.lng, selectedLat, selectedLng);

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-md p-3.5 space-y-3 max-w-full text-xs">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-2">
        <div className="flex items-center gap-1.5 font-bold text-slate-800 text-xs">
          <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
          <span>ระบุพิกัดปลายทาง & เวลาเดินทาง</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] bg-blue-50 text-[#0066CC] font-bold px-2 py-0.5 rounded-full border border-blue-200">
            {distance} กม. จากวิทยาลัย
          </span>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
              title="ปิดหน้าต่างแผนที่"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 1. Real-time Search Box (100% Longdo Map API + AI) */}
      <div className="space-y-1.5">
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="พิมพ์ชื่อ เซเว่น, โลตัส, คลินิก, รพ, มศว, ตลาด, ซอย..."
              className="w-full pl-8 pr-8 py-2 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-[#0066CC] focus:outline-none text-xs text-slate-800 placeholder:text-slate-400 transition-colors shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setSearchError(null);
                  setAiInterpretation(null);
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={isSearching}
            className="px-3.5 py-2 rounded-xl bg-[#0077D7] hover:bg-[#0066CC] disabled:bg-slate-200 text-white font-semibold text-xs flex items-center gap-1 transition-all shrink-0 shadow-xs cursor-pointer active:scale-95"
          >
            {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            <span>ค้นหา</span>
          </button>
        </form>

        {/* AI Query Interpretation Badge */}
        {aiInterpretation && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-xl px-2.5 py-1 text-[10px] text-blue-800 font-semibold flex items-center gap-1.5 animate-fadeIn">
            <Sparkles className="w-3.5 h-3.5 text-[#0066CC] shrink-0" />
            <span>{aiInterpretation}</span>
          </div>
        )}

        {/* Search Results Dropdown (Real Places from Longdo Map) */}
        {searchResults.length > 0 && (
          <div className="space-y-1 bg-blue-50/90 p-2 rounded-xl border border-blue-200 animate-fadeIn">
            <div className="flex items-center justify-between text-[10px] text-blue-900 font-bold px-0.5">
              <span>สถานที่จริงที่ค้นพบ (เรียงจากใกล้ที่สุดก่อน):</span>
              <span className="text-blue-600 font-normal">พบ {searchResults.length} แห่ง</span>
            </div>
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto pr-1">
              {searchResults.map((loc, idx) => {
                const locDist =
                  typeof loc.distance === 'number'
                    ? loc.distance
                    : calcDistanceKm(OICEC_COLLEGE.lat, OICEC_COLLEGE.lng, loc.lat, loc.lng);
                return (
                  <button
                    key={loc.id || idx}
                    type="button"
                    onClick={() => {
                      updatePin(loc.lat, loc.lng, loc.name, loc.isReturn, loc.address);
                      setSearchResults([]);
                      setSearchQuery(loc.name);
                    }}
                    className={`w-full text-left p-2 rounded-xl border transition-all flex items-start gap-2 shadow-2xs group cursor-pointer ${
                      loc.isNearest
                        ? 'bg-emerald-50 hover:bg-emerald-100/80 border-emerald-300'
                        : 'bg-white hover:bg-blue-50 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <span className="text-base shrink-0 mt-0.5">{loc.icon || '📍'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="font-semibold text-slate-900 text-xs truncate group-hover:text-[#0066CC] flex items-center gap-1.5">
                          <span>{loc.name}</span>
                          {loc.isNearest && (
                            <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.2 rounded-full font-bold shrink-0">
                              ใกล้ที่สุด ⭐
                            </span>
                          )}
                        </p>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono shrink-0">
                          {locDist} กม.
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 truncate">{loc.address}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {searchError && (
          <p className="text-[10px] text-amber-700 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{searchError}</span>
          </p>
        )}
      </div>

      {/* 2. Quick Location Presets (Clean: Only GPS and College) */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={handleGetCurrentLocation}
          disabled={gpsLoading}
          className="px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-semibold text-[11px] flex items-center gap-1 shadow-2xs transition-all cursor-pointer"
        >
          {gpsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Crosshair className="w-3 h-3" />}
          <span>GPS ปัจจุบันของฉัน</span>
        </button>
        <button
          type="button"
          onClick={() =>
            updatePin(OICEC_COLLEGE.lat, OICEC_COLLEGE.lng, 'วิทยาลัยการอาชีพองครักษ์ (ป้อมประตู 1)', 1, OICEC_COLLEGE.address)
          }
          className="px-2.5 py-1 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 font-medium text-[11px] flex items-center gap-1 transition-all cursor-pointer"
        >
          <span>🏫 วิทยาลัยการอาชีพองครักษ์</span>
        </button>
      </div>

      {/* 3. Interactive Map (Satellite / Roads with Draggable Pin) */}
      <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-inner">
        <div ref={mapContainerRef} className="w-full h-44 z-0" style={{ touchAction: 'pan-x pan-y' }} />

        {/* Toggle Layer Button (Top-Right Floating) */}
        <button
          type="button"
          onClick={toggleMapLayer}
          className="absolute top-2 right-2 z-10 bg-white/90 hover:bg-white text-slate-800 text-[10px] font-bold px-2 py-1 rounded-lg shadow-md border border-slate-200 flex items-center gap-1 backdrop-blur cursor-pointer transition-all active:scale-95"
        >
          <Layers className="w-3 h-3 text-[#0066CC]" />
          <span>{mapLayer === 'satellite' ? 'ภาพดาวเทียม Google' : 'แผนที่ถนน Google'}</span>
        </button>

        {/* Selected Coordinates Chip (Bottom-Left Floating) */}
        <div className="absolute bottom-2 left-2 z-10 bg-white/95 backdrop-blur px-2 py-0.5 rounded-md text-[10px] font-mono text-slate-700 shadow-xs border border-slate-200 flex items-center gap-1">
          <MapPin className="w-3 h-3 text-rose-500" />
          <span>
            {selectedLat.toFixed(4)}, {selectedLng.toFixed(4)}
          </span>
        </div>
      </div>

      {/* Selected Location Summary Box */}
      <div className="bg-slate-50 p-2.5 rounded-2xl border border-slate-200 space-y-1">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-800 text-xs truncate">{locationName}</span>
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
            {distance} กม.
          </span>
        </div>
        <p className="text-[10px] text-slate-500 truncate">{locationAddress}</p>
      </div>

      {/* 4. Departure & Return Time Settings */}
      <div className="space-y-2 pt-1 border-t border-slate-100">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-700 text-xs flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-[#0066CC]" />
            <span>ช่วงเวลาขออนุญาตออกนอกวิทยาลัย:</span>
          </span>
        </div>

        {/* Preset Time Slot Pills */}
        <div className="flex items-center gap-1.5">
          {TIME_SLOT_PRESETS.map((slot) => (
            <button
              key={slot.label}
              type="button"
              onClick={() => handleApplyPresetSlot(slot)}
              className={`flex-1 py-1 px-1.5 rounded-xl text-[10px] font-semibold border transition-all cursor-pointer ${
                selectedSlotPreset === slot.label
                  ? 'bg-[#0077D7] text-white border-transparent shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300'
              }`}
            >
              {slot.label}
            </button>
          ))}
        </div>

        {/* Time Inputs */}
        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200">
          <div>
            <label className="block text-[10px] text-slate-500 mb-0.5 font-medium">เวลาออก:</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => {
                setStartTime(e.target.value);
                setSelectedSlotPreset('');
              }}
              className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 text-center focus:outline-none focus:border-[#0066CC]"
            />
          </div>
          <div>
            <label className="block text-[10px] text-slate-500 mb-0.5 font-medium">เวลาที่ต้องกลับ:</label>
            <input
              type="time"
              value={endTime === 'ไม่กลับ' ? '' : endTime}
              disabled={isReturn === 0}
              placeholder={isReturn === 0 ? 'กลับบ้านเลย' : ''}
              onChange={(e) => {
                setEndTime(e.target.value);
                setSelectedSlotPreset('');
              }}
              className="w-full px-2 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 text-center disabled:bg-slate-100 disabled:text-slate-400 focus:outline-none focus:border-[#0066CC]"
            />
          </div>
        </div>

        {/* Return to College Toggle */}
        <div className="flex items-center justify-between text-xs pt-1">
          <span className="text-slate-600 font-medium text-[11px]">การเดินทางกลับ:</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                setIsReturn(1);
                if (endTime === 'ไม่กลับ') setEndTime('13:00');
              }}
              className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition-all cursor-pointer ${
                isReturn === 1
                  ? 'bg-[#0077D7] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              ต้องกลับวิทยาลัย
            </button>
            <button
              type="button"
              onClick={() => {
                setIsReturn(0);
                setEndTime('ไม่กลับ');
              }}
              className={`px-3 py-1 rounded-xl text-[11px] font-semibold transition-all cursor-pointer ${
                isReturn === 0
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              กลับบ้านเลย (ไม่กลับ)
            </button>
          </div>
        </div>
      </div>

      {/* 5. Evidence Photo Attachment Section (NEW) */}
      <div className="pt-2 border-t border-slate-100 space-y-1.5">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
          <span className="flex items-center gap-1.5">
            <Paperclip className="w-3.5 h-3.5 text-[#0066CC]" />
            <span>แนบรูปเอกสารใบนัดแพทย์ หรือ แชทผู้ปกครอง (ถ้ามี):</span>
          </span>
          {attachmentUrl && (
            <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-0.5">
              <CheckCircle2 className="w-3 h-3" />
              <span>แนบแล้ว</span>
            </span>
          )}
        </div>

        {/* Hidden File Input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*"
          className="hidden"
        />

        {attachmentUrl ? (
          <div className="relative rounded-2xl overflow-hidden border border-emerald-300 bg-emerald-50/50 p-2 flex items-center gap-2.5 animate-fadeIn">
            <img
              src={attachmentUrl}
              alt="หลักฐานที่แนบ"
              className="w-12 h-12 object-cover rounded-xl border border-emerald-200 bg-white shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-emerald-800 truncate">แนบรูปภาพหลักฐานเรียบร้อย</p>
              <p className="text-[10px] text-emerald-600 truncate">{attachmentUrl.split('/').pop()}</p>
            </div>
            <button
              type="button"
              onClick={() => setAttachmentUrl(null)}
              className="p-1.5 text-rose-500 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer"
              title="ลบรูปภาพนี้"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full py-2.5 px-3 rounded-2xl border-2 border-dashed border-slate-200 hover:border-blue-400 bg-slate-50/60 hover:bg-blue-50/30 text-slate-600 text-xs font-medium flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-[0.99]"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 text-[#0066CC] animate-spin" />
                <span className="text-[#0066CC] font-semibold">กำลังอัปโหลดรูปภาพ...</span>
              </>
            ) : (
              <>
                <ImageIcon className="w-4 h-4 text-slate-400" />
                <span>แตะเพื่อเลือกรูปถ่ายใบนัดแพทย์ หรือ ภาพแคปแชทผู้ปกครอง</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Security Rule Notice */}
      <div className="bg-amber-50/90 border border-amber-200/90 rounded-2xl p-2.5 text-amber-900 text-[11px] leading-relaxed flex items-start gap-2">
        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">กฎการผ่านไม้กั้น: </span>
          <span>
            ระบบจะอนุญาตให้นักเรียนสแกนใบหน้าเปิดไม้กั้นได้{' '}
            <span className="font-bold text-amber-950 underline">เมื่อถึงเวลาที่เลือก ({startTime} น.)</span>{' '}
            เท่านั้น
          </span>
        </div>
      </div>

      {/* 6. Confirm Button */}
      <button
        type="button"
        onClick={() => {
          onSelect({
            name: locationName,
            lat: selectedLat,
            lng: selectedLng,
            isReturnRequired: isReturn,
            startTime,
            endTime: isReturn === 0 ? 'ไม่กลับ' : endTime,
            attachmentPath: attachmentUrl,
          });
        }}
        className="w-full py-3 bg-[#0077D7] hover:bg-[#0066CC] active:scale-[0.98] text-white text-xs font-bold rounded-2xl flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
      >
        <CheckCircle2 className="w-4 h-4" />
        <span>ยืนยันพิกัดจุดหมาย & ช่วงเวลาเดินทาง ({distance} กม.)</span>
      </button>
    </div>
  );
}
