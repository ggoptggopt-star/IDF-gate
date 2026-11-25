'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Search,
  Crosshair,
  X,
  CheckCircle2,
  Clock,
  Compass,
  Building2,
  Store,
  ChevronDown,
  Loader2,
  AlertCircle
} from 'lucide-react';

export interface LocationTimeResult {
  name: string;
  lat: number;
  lng: number;
  isReturnRequired: number;
  startTime: string;
  endTime: string;
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

// College coordinates: OICEC (วิทยาลัยการอาชีพองครักษ์)
const OICEC_LAT = 14.109127;
const OICEC_LNG = 101.062441;

// Popular destinations around Ongkharak
const DESTINATION_PRESETS = [
  { name: 'โรงพยาบาลองครักษ์', lat: 14.1205, lng: 101.0020, icon: '🏥', isReturn: 1 },
  { name: 'ตลาดองครักษ์', lat: 14.1220, lng: 101.0050, icon: '🛍️', isReturn: 1 },
  { name: 'เซเว่นอีเลฟเว่น หน้า วก.องครักษ์', lat: 14.1275, lng: 100.9995, icon: '🏪', isReturn: 1 },
  { name: 'บ้านพัก (คลอง 15)', lat: 14.1120, lng: 100.9450, icon: '🏠', isReturn: 0 },
  { name: 'บ้านพัก (คลอง 16)', lat: 14.1350, lng: 100.9200, icon: '🏠', isReturn: 0 },
];

// Preset class time slots
const TIME_SLOT_PRESETS = [
  { label: '🍱 พักเที่ยง', start: '12:00', end: '13:00' },
  { label: '📚 ช่วงบ่าย', start: '13:00', end: '16:30' },
  { label: '🌅 หลังเลิกเรียน', start: '16:30', end: '18:00' },
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
  initialName = 'โรงพยาบาลองครักษ์',
  initialStartTime = '12:00',
  initialEndTime = '13:00',
}: ChatMapPickerProps) {
  const [selectedLat, setSelectedLat] = useState(initialLat || 14.1205);
  const [selectedLng, setSelectedLng] = useState(initialLng || 101.0020);
  const [locationName, setLocationName] = useState(initialName);
  const [isReturn, setIsReturn] = useState(initialName.includes('บ้าน') ? 0 : 1);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [selectedSlotPreset, setSelectedSlotPreset] = useState<string>('🍱 พักเที่ยง');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ name: string; lat: number; lng: number }>>([]);
  const [searchError, setSearchError] = useState<string | null>(null);

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
        zoom: 14,
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

      // College Marker (OICEC)
      const collegeIcon = L.divIcon({
        className: 'college-pin',
        html: `
          <div style="
            background: #1e3a8a;
            color: white;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 3px 8px rgba(0,0,0,0.35);
            border: 2px solid white;
            font-size: 15px;
          ">
            🏫
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      L.marker([OICEC_LAT, OICEC_LNG], { icon: collegeIcon })
        .addTo(map)
        .bindPopup('<b>วิทยาลัยการอาชีพองครักษ์</b><br>จุดเริ่มต้น / ป้อมประตู 1');

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

  const updatePin = (lat: number, lng: number, name: string, returnReq?: number) => {
    setSelectedLat(lat);
    setSelectedLng(lng);
    setLocationName(name);
    if (returnReq !== undefined) {
      setIsReturn(returnReq);
    }

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

  // Search Handler
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = searchQuery.trim();
    if (!query) return;

    setIsSearching(true);
    setSearchError(null);
    setSearchResults([]);

    // 1. Check local presets first
    const matchedPresets = DESTINATION_PRESETS.filter((p) =>
      p.name.toLowerCase().includes(query.toLowerCase())
    );

    try {
      // 2. Query OpenStreetMap Nominatim with Ongkharak / Nakhon Nayok bias
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
        query
      )}&countrycodes=th&limit=5`;

      const res = await fetch(url, {
        signal: controller.signal,
        headers: { 'Accept-Language': 'th,en' },
      });
      clearTimeout(timeoutId);

      const data = await res.json();
      const onlineResults = Array.isArray(data)
        ? data.map((item: any) => ({
            name: item.display_name.split(',')[0] || item.display_name,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
          }))
        : [];

      const combined = [
        ...matchedPresets.map((p) => ({ name: p.name, lat: p.lat, lng: p.lng })),
        ...onlineResults,
      ];

      if (combined.length > 0) {
        setSearchResults(combined);
        // Automatically jump to first match
        const first = combined[0];
        updatePin(first.lat, first.lng, first.name);
      } else {
        setSearchError('ไม่พบสถานที่นี้ ลองระบุชื่อให้กระชับขึ้น หรือแตะเลื่อนหมุดบนแผนที่ได้โดยตรงครับ');
      }
    } catch (err) {
      console.warn('Search error or timeout:', err);
      if (matchedPresets.length > 0) {
        setSearchResults(matchedPresets);
        updatePin(matchedPresets[0].lat, matchedPresets[0].lng, matchedPresets[0].name);
      } else {
        // Fallback: If search failed, still apply typed name and allow pinning on map
        setLocationName(query);
        setSearchError('ไม่สามารถเชื่อมต่อระบบค้นหาได้ แต่คุณสามารถเลื่อนหมุดบนแผนที่ไปยังตำแหน่งที่ต้องการได้เลยครับ');
      }
    } finally {
      setIsSearching(false);
    }
  };

  const handleApplyPresetSlot = (preset: typeof TIME_SLOT_PRESETS[0]) => {
    setSelectedSlotPreset(preset.label);
    setStartTime(preset.start);
    setEndTime(preset.end);
  };

  const distance = calculateDistanceKm(OICEC_LAT, OICEC_LNG, selectedLat, selectedLng);

  const handleConfirm = () => {
    setConfirmed(true);
    onSelect({
      name: locationName,
      lat: Number(selectedLat.toFixed(5)),
      lng: Number(selectedLng.toFixed(5)),
      isReturnRequired: isReturn,
      startTime: startTime || '12:00',
      endTime: isReturn === 1 ? (endTime || '13:00') : 'ไม่กลับ',
    });
  };

  if (confirmed) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 my-2 text-emerald-800 text-xs shadow-sm flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-5 h-5" />
        </div>
        <div>
          <p className="font-semibold text-emerald-950">บันทึกพิกัดและช่วงเวลาเรียบร้อยแล้ว ✓</p>
          <p className="text-[11px] text-emerald-700">
            {locationName} ({distance} กม.) • เวลา {startTime} น. - {isReturn === 1 ? `${endTime} น.` : 'ไม่กลับเข้าวิทยาลัย'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-blue-200/90 rounded-2xl p-3.5 my-2 shadow-lg text-xs text-slate-800 space-y-3 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center gap-1.5 font-bold text-blue-950">
          <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
          <span>ระบุพิกัดสถานที่และเวลาเดินทาง (Leaflet GPS)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] bg-blue-50 text-blue-700 px-2.5 py-0.5 rounded-full font-semibold border border-blue-100">
            {distance} กม. จากวิทยาลัย
          </span>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-600 p-0.5 transition-colors"
              title="ปิดแผนที่"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 1. Search Box */}
      <div className="space-y-1.5">
        <form onSubmit={handleSearch} className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="พิมพ์ค้นหาสถานที่ เช่น เซเว่น, คลินิก, ร้านค้า..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none text-[11px] text-slate-800 placeholder:text-slate-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setSearchError(null);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={isSearching || !searchQuery.trim()}
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white font-medium text-[11px] flex items-center gap-1 transition-all shrink-0 shadow-xs"
          >
            {isSearching ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Search className="w-3.5 h-3.5" />
            )}
            <span>ค้นหา</span>
          </button>
        </form>

        {/* Search Error Message */}
        {searchError && (
          <p className="text-[10px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span>{searchError}</span>
          </p>
        )}

        {/* Search Results Dropdown Chips */}
        {searchResults.length > 1 && (
          <div className="flex flex-wrap gap-1 pt-0.5">
            <span className="text-[10px] text-slate-500 font-medium self-center">ผลการค้นหา:</span>
            {searchResults.slice(0, 4).map((res, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  updatePin(res.lat, res.lng, res.name);
                  setSearchResults([]);
                }}
                className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-[10px] font-medium transition-colors truncate max-w-[180px]"
                title={res.name}
              >
                📍 {res.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Preset Destination Buttons */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={handleGetCurrentLocation}
          disabled={gpsLoading}
          className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-medium flex items-center gap-1 transition-all shadow-xs shrink-0"
        >
          {gpsLoading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
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
            className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-colors flex items-center gap-1 border ${
              locationName === preset.name
                ? 'bg-blue-100 text-blue-900 border-blue-300 font-semibold shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200/80'
            }`}
          >
            <span>{preset.icon}</span>
            <span>{preset.name}</span>
          </button>
        ))}
      </div>

      {/* Destination Name Input / Editor */}
      <div className="flex items-center gap-2 px-2.5 py-1.5 bg-slate-50 border border-slate-200/90 rounded-xl">
        <span className="text-[10px] font-bold text-slate-600 shrink-0">ชื่อจุดหมาย:</span>
        <input
          type="text"
          value={locationName}
          onChange={(e) => setLocationName(e.target.value)}
          placeholder="ระบุหรือแก้ไขชื่อสถานที่ปลายทาง..."
          className="flex-1 bg-transparent text-[11px] font-semibold text-blue-900 focus:outline-none"
        />
      </div>

      {/* Mini Leaflet Map */}
      <div className="relative rounded-xl overflow-hidden border border-slate-200 h-44 bg-slate-100 shadow-inner">
        <div ref={mapContainerRef} className="w-full h-full" />
        <div className="absolute top-2 left-2 z-[400] bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-md text-[10px] shadow-sm text-slate-700 flex items-center gap-1 font-mono border border-slate-200/80">
          <MapPin className="w-3 h-3 text-rose-500" />
          <span>{selectedLat.toFixed(4)}, {selectedLng.toFixed(4)}</span>
        </div>
        <div className="absolute bottom-2 right-2 z-[400] bg-white/90 backdrop-blur-xs px-2 py-0.5 rounded text-[9px] text-slate-500 shadow-xs">
          แตะหรือลากหมุดบนแผนที่ได้
        </div>
      </div>

      {/* Return Option Toggle */}
      <div className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 border border-slate-100 rounded-xl text-[11px]">
        <span className="font-semibold text-slate-700">รูปแบบการเดินทาง:</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              setIsReturn(1);
              if (endTime === 'ไม่กลับ') setEndTime('13:00');
            }}
            className={`px-3 py-1 rounded-lg font-medium text-[11px] transition-all ${
              isReturn === 1
                ? 'bg-blue-600 text-white shadow-xs font-semibold'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            🔄 ต้องกลับวิทยาลัย
          </button>
          <button
            type="button"
            onClick={() => {
              setIsReturn(0);
              setEndTime('ไม่กลับ');
            }}
            className={`px-3 py-1 rounded-lg font-medium text-[11px] transition-all ${
              isReturn === 0
                ? 'bg-amber-600 text-white shadow-xs font-semibold'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            🏠 กลับบ้านเลย (ไม่กลับ)
          </button>
        </div>
      </div>

      {/* 2. Time Selection Section (เวลาออก - เวลากลับ) */}
      <div className="bg-blue-50/60 border border-blue-100/90 rounded-xl p-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-blue-900 text-[11px]">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span>กำหนดช่วงเวลา (สแกนหน้าได้เมื่อถึงเวลาที่เลือกเท่านั้น):</span>
          </div>
        </div>

        {/* Quick Time Presets */}
        <div className="flex flex-wrap gap-1.5">
          {TIME_SLOT_PRESETS.map((slot, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleApplyPresetSlot(slot)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all border ${
                selectedSlotPreset === slot.label && startTime === slot.start && endTime === slot.end
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              {slot.label} ({slot.start}-{slot.end})
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSelectedSlotPreset('custom')}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all border ${
              selectedSlotPreset === 'custom'
                ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            ⚙️ ระบุเวลาเอง
          </button>
        </div>

        {/* Time Inputs */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          {/* Start Time */}
          <div className="bg-white p-2 rounded-lg border border-slate-200/90 shadow-2xs">
            <label className="block text-[10px] font-bold text-slate-600 mb-1">
              🕒 เวลาขอออก (เริ่มสแกนได้):
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => {
                setStartTime(e.target.value);
                setSelectedSlotPreset('custom');
              }}
              className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
            />
          </div>

          {/* End Time / Return Time */}
          <div className="bg-white p-2 rounded-lg border border-slate-200/90 shadow-2xs">
            <label className="block text-[10px] font-bold text-slate-600 mb-1">
              🏁 กำหนดเวลากลับ:
            </label>
            {isReturn === 1 ? (
              <input
                type="time"
                value={endTime === 'ไม่กลับ' ? '13:00' : endTime}
                onChange={(e) => {
                  setEndTime(e.target.value);
                  setSelectedSlotPreset('custom');
                }}
                className="w-full px-2 py-1 bg-slate-50 border border-slate-200 rounded-md text-xs font-semibold text-slate-800 focus:bg-white focus:border-blue-500 focus:outline-none"
              />
            ) : (
              <div className="h-[27px] px-2 bg-amber-50 border border-amber-200/80 rounded-md text-[10px] font-semibold text-amber-800 flex items-center justify-center">
                🏠 ไม่กลับเข้าวิทยาลัย
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirm Button */}
      <button
        type="button"
        onClick={handleConfirm}
        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold text-xs shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98]"
      >
        <CheckCircle2 className="w-4 h-4" />
        <span>
          ยืนยัน: {locationName} ({distance} กม.) • ออก {startTime} น.{isReturn === 1 ? ` - กลับ ${endTime} น.` : ' (ไม่กลับ)'}
        </span>
      </button>
    </div>
  );
}
