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
  AlertCircle,
  ExternalLink,
  Layers,
  Sparkles,
  Filter
} from 'lucide-react';
import {
  VERIFIED_LOCATIONS,
  VerifiedLocation,
  searchVerifiedLocations,
  calcDistanceKm,
  OICEC_COLLEGE,
  ONGKHARAK_SUBDISTRICTS,
} from '@/lib/ongkharakLocations';

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
  initialName = 'โรงพยาบาลองครักษ์',
  initialStartTime = '12:00',
  initialEndTime = '13:00',
}: ChatMapPickerProps) {
  const [selectedLat, setSelectedLat] = useState(initialLat || 14.12075);
  const [selectedLng, setSelectedLng] = useState(initialLng || 101.00185);
  const [locationName, setLocationName] = useState(initialName);
  const [locationAddress, setLocationAddress] = useState<string>('ต.องครักษ์ อ.องครักษ์ จ.นครนายก');
  const [isReturn, setIsReturn] = useState(initialName.includes('บ้าน') || initialName.includes('หอพัก') ? 0 : 1);
  const [startTime, setStartTime] = useState(initialStartTime);
  const [endTime, setEndTime] = useState(initialEndTime);
  const [selectedSlotPreset, setSelectedSlotPreset] = useState<string>('🍱 พักเที่ยง');

  // Category and Subdistrict filters
  const [activeCategory, setActiveCategory] = useState<'all' | 'hospital' | 'convenience' | 'market' | 'home' | 'temple' | 'school' | 'gov'>('all');
  const [selectedSubdistrict, setSelectedSubdistrict] = useState<string>('all');

  // Longdo Map Key configuration
  const [longdoKey, setLongdoKey] = useState<string>('');
  const [tempKeyInput, setTempKeyInput] = useState<string>('');
  const [showKeyConfig, setShowKeyConfig] = useState<boolean>(false);
  const [hasLongdoConnected, setHasLongdoConnected] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem('sgp_longdo_map_key') || '';
      if (savedKey) {
        setLongdoKey(savedKey);
        setTempKeyInput(savedKey);
        setHasLongdoConnected(true);
      }
    }
  }, []);

  const handleSaveLongdoKey = () => {
    const trimmed = tempKeyInput.trim();
    setLongdoKey(trimmed);
    if (typeof window !== 'undefined') {
      if (trimmed) {
        localStorage.setItem('sgp_longdo_map_key', trimmed);
        setHasLongdoConnected(true);
      } else {
        localStorage.removeItem('sgp_longdo_map_key');
        setHasLongdoConnected(false);
      }
    }
    setShowKeyConfig(false);
  };

  // Map layer: 'satellite' (Google Maps Hybrid) vs 'roadmap' (Google Maps Roads)
  const [mapLayer, setMapLayer] = useState<'satellite' | 'roadmap'>('satellite');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [aiInterpretation, setAiInterpretation] = useState<string | null>(null);

  const [gpsLoading, setGpsLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);

  // Initialize Google Maps in Leaflet safely on client
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
        zoom: 15,
        zoomControl: false,
      });

      // Default to Satellite Hybrid for maximum physical realism
      const tileUrl =
        mapLayer === 'satellite'
          ? 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}'
          : 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}';

      const tileLayer = L.tileLayer(tileUrl, {
        attribution: '&copy; Google Maps',
        maxZoom: 20,
      }).addTo(map);

      tileLayerRef.current = tileLayer;

      // Custom Destination Pin Icon (Red Pin)
      const pinIcon = L.divIcon({
        className: 'custom-dest-pin',
        html: `
          <div style="
            background: #ef4444;
            color: white;
            width: 38px;
            height: 38px;
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 14px rgba(0,0,0,0.45);
            border: 2px solid white;
          ">
            <span style="transform: rotate(45deg); font-size: 18px;">📍</span>
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 38],
      });

      const marker = L.marker([selectedLat, selectedLng], {
        icon: pinIcon,
        draggable: true,
      }).addTo(map);

      // College Marker (OICEC) - Blue School Icon
      const collegeIcon = L.divIcon({
        className: 'college-pin',
        html: `
          <div style="
            background: #1e3a8a;
            color: white;
            width: 34px;
            height: 34px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 3px 10px rgba(0,0,0,0.4);
            border: 2px solid white;
            font-size: 16px;
          ">
            🏫
          </div>
        `,
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      });

      L.marker([OICEC_COLLEGE.lat, OICEC_COLLEGE.lng], { icon: collegeIcon })
        .addTo(map)
        .bindPopup('<b>วิทยาลัยการอาชีพองครักษ์ (OICEC)</b><br>จุดเริ่มต้น / ซุ้มประตู 1');

      marker.on('dragend', () => {
        const pos = marker.getLatLng();
        setSelectedLat(pos.lat);
        setSelectedLng(pos.lng);
        setLocationAddress(`พิกัดปักหมุดเองบนแผนที่ดาวเทียม (${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)})`);
      });

      map.on('click', (e: any) => {
        marker.setLatLng(e.latlng);
        setSelectedLat(e.latlng.lat);
        setSelectedLng(e.latlng.lng);
        setLocationAddress(`พิกัดปักหมุดเองบนแผนที่ดาวเทียม (${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)})`);
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
      attribution: nextLayer === 'satellite' ? '&copy; Google Maps Satellite' : '&copy; Google Maps',
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
        updatePin(pos.coords.latitude, pos.coords.longitude, 'พิกัด GPS ปัจจุบันของฉัน', 0, 'ตรวจจับจากชิป GPS ในอุปกรณ์');
      },
      (err) => {
        setGpsLoading(false);
        console.warn(err);
        alert('ไม่สามารถดึงตำแหน่งปัจจุบันได้ กรุณาแตะเลือกบนแผนที่หรือพิมพ์ค้นหาสถานที่ครับ');
      },
      { enableHighAccuracy: true, timeout: 7000 }
    );
  };

  // Instant Real-Time Search Handler (Zero Hallucination + Longdo Map)
  const searchTimeoutRef = useRef<any>(null);

  const handleSearchChange = (text: string) => {
    setSearchQuery(text);
    setSearchError(null);

    if (!text.trim()) {
      setSearchResults([]);
      setAiInterpretation(null);
      return;
    }

    // 1. Immediate local search from verified Ongkharak database
    const localMatched = searchVerifiedLocations(text);
    setSearchResults(localMatched);

    // 2. Query Longdo Map Search + AI with 350ms debounce
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const res = await fetch('/api/geocode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            query: text.trim(),
            longdoKey,
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
        // keep local results
      }
    }, 350);
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
          longdoKey,
          userLat: selectedLat,
          userLng: selectedLng,
        }),
      });
      const data = await res.json();
      if (data.hasLongdoKey) {
        setHasLongdoConnected(true);
      }
      if (data.success && data.results && data.results.length > 0) {
        setSearchResults(data.results);
        setAiInterpretation(data.aiInterpretation || null);
        const top = data.results[0];
        updatePin(top.lat, top.lng, top.name, top.isReturn, top.address);
      } else {
        setSearchError(data.error || `ไม่พบ "${query}" แนะนำเลือกสถานที่จากรายการด้านล่าง หรือแตะลากหมุดบนแผนที่ดาวเทียมได้เลยครับ`);
      }
    } catch (err) {
      setSearchError('ไม่สามารถเชื่อมต่อระบบค้นหาได้ชั่วคราว ลองแตะเลือกบนภาพถ่ายดาวเทียม Google Maps ได้โดยตรงครับ');
    } finally {
      setIsSearching(false);
    }
  };

  const handleApplyPresetSlot = (preset: typeof TIME_SLOT_PRESETS[0]) => {
    setSelectedSlotPreset(preset.label);
    setStartTime(preset.start);
    setEndTime(preset.end);
  };

  const distance = calcDistanceKm(OICEC_COLLEGE.lat, OICEC_COLLEGE.lng, selectedLat, selectedLng);

  // Filtered preset list by category and subdistrict
  const displayedPresets = VERIFIED_LOCATIONS.filter((loc) => {
    if (selectedSubdistrict !== 'all' && loc.subdistrict !== selectedSubdistrict) {
      return false;
    }
    if (activeCategory === 'all') return true;
    if (activeCategory === 'hospital') return loc.category === 'hospital';
    if (activeCategory === 'convenience') return loc.category === 'convenience';
    if (activeCategory === 'market') return loc.category === 'market';
    if (activeCategory === 'home') return loc.category === 'home';
    if (activeCategory === 'temple') return loc.category === 'temple';
    if (activeCategory === 'school') return loc.category === 'school';
    if (activeCategory === 'gov') return loc.category === 'gov';
    return true;
  });

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
          <p className="font-semibold text-emerald-950">บันทึกพิกัด Google Maps และเวลาเรียบร้อยแล้ว ✓</p>
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
          <span>ปักหมุดสถานที่จริง (Google Maps GPS องครักษ์)</span>
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

      {/* 1. Longdo Map Key Setup & Status Pill */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between px-1 text-[10px]">
          <div className="flex items-center gap-1.5">
            {hasLongdoConnected ? (
              <span className="flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>🇹🇭 ค้นหาผ่าน Longdo Map (ค้นหาได้ทั่วไทย 100%)</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setShowKeyConfig(!showKeyConfig)}
                className="flex items-center gap-1 text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-md border border-blue-200 font-medium transition-colors"
              >
                <span>🔑 ใส่ Longdo Map Key (ฟรี) เพื่อค้นหาได้ทุกจุดในไทย</span>
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowKeyConfig(!showKeyConfig)}
            className="text-slate-500 hover:text-slate-700 underline text-[10px]"
          >
            {showKeyConfig ? 'ปิดหน้าต่าง' : hasLongdoConnected ? '⚙️ แก้ไข Key' : '⚙️ วิธีรับ Key ฟรี'}
          </button>
        </div>

        {/* Inline Longdo Key Config Accordion */}
        {showKeyConfig && (
          <div className="bg-slate-50 p-2.5 rounded-xl border border-blue-200 space-y-1.5 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="font-bold text-[11px] text-blue-900">ตั้งค่า Longdo Map API Key:</span>
              <a
                href="https://map.longdo.com/console"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-blue-600 hover:text-blue-800 flex items-center gap-0.5 underline font-medium"
              >
                <span>สมัครรับ Key ฟรี 1 นาที (ไม่ต้องใช้บัตร)</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={tempKeyInput}
                onChange={(e) => setTempKeyInput(e.target.value)}
                placeholder="วาง Longdo Map API Key ที่นี่..."
                className="flex-1 px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:border-blue-500 font-mono"
              />
              <button
                type="button"
                onClick={handleSaveLongdoKey}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shrink-0 transition-colors"
              >
                บันทึก
              </button>
            </div>
            <p className="text-[10px] text-slate-500">
              * คีย์ฟรีของ Longdo Map ค้นหาได้ 100,000 ครั้ง/เดือน เพียงพอสำหรับทั้งวิทยาลัยตลอดไป
            </p>
          </div>
        )}

        {/* Search Input Form */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="พิมพ์ชื่อ เซเว่น, โลตัส, คลินิก, รพ, มศว, ร้านค้า, ซอย..."
              className="w-full pl-8 pr-8 py-1.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:outline-none text-[11px] text-slate-800 placeholder:text-slate-400 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchResults([]);
                  setSearchError(null);
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
            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white font-medium text-[11px] flex items-center gap-1 transition-all shrink-0 shadow-xs cursor-pointer"
          >
            {isSearching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
            <span>ค้นหา</span>
          </button>
        </form>

        {/* AI Query Interpretation Badge */}
        {aiInterpretation && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-xl px-2.5 py-1.5 text-[10px] text-blue-800 font-semibold flex items-center gap-1.5 animate-fadeIn">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>{aiInterpretation}</span>
          </div>
        )}

        {/* Search Results Dropdown (Immediate Exact Match + Nearest Proximity) */}
        {searchResults.length > 0 && (
          <div className="space-y-1 bg-blue-50/80 p-2 rounded-xl border border-blue-200 animate-fadeIn">
            <div className="flex items-center justify-between text-[10px] text-blue-900 font-bold px-0.5">
              <span>สถานที่จริง (เรียงจากใกล้ที่สุดก่อน):</span>
              <span className="text-blue-600 font-normal">พบ {searchResults.length} แห่ง</span>
            </div>
            <div className="flex flex-col gap-1 max-h-44 overflow-y-auto pr-1">
              {searchResults.map((loc, idx) => {
                const locDist = typeof loc.distance === 'number' ? loc.distance : calcDistanceKm(OICEC_COLLEGE.lat, OICEC_COLLEGE.lng, loc.lat, loc.lng);
                return (
                  <button
                    key={loc.id || idx}
                    type="button"
                    onClick={() => {
                      updatePin(loc.lat, loc.lng, loc.name, loc.isReturn, loc.address);
                      setSearchResults([]);
                      setSearchQuery(loc.name);
                    }}
                    className={`w-full text-left p-2 rounded-lg border transition-all flex items-start gap-2 shadow-2xs group ${
                      loc.isNearest
                        ? 'bg-emerald-50 hover:bg-emerald-100/80 border-emerald-300'
                        : 'bg-white hover:bg-blue-100 border-slate-200 hover:border-blue-300'
                    }`}
                  >
                    <span className="text-base shrink-0 mt-0.5">{loc.icon || '📍'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <p className="font-semibold text-slate-900 text-[11px] truncate group-hover:text-blue-700 flex items-center gap-1.5">
                          <span>{loc.name}</span>
                          {loc.isNearest && (
                            <span className="text-[9px] bg-emerald-600 text-white px-1.5 py-0.2 rounded-full font-bold shrink-0">
                              ใกล้ที่สุด ⭐
                            </span>
                          )}
                        </p>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono shrink-0">
                          {locDist} กม. {loc.source === 'longdo' ? '• 🇹🇭 Longdo' : ''}
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
          <p className="text-[10px] text-amber-700 bg-amber-50 px-2.5 py-1 rounded-lg border border-amber-200 flex items-center gap-1">
            <AlertCircle className="w-3 h-3 shrink-0" />
            <span>{searchError}</span>
          </p>
        )}
      </div>

      {/* Category Tabs & 11 Sub-districts of Ongkharak */}
      <div className="space-y-1.5 bg-slate-50/70 p-2 rounded-xl border border-slate-200">
        <div className="flex items-center justify-between gap-1 text-[10px]">
          <span className="font-bold text-slate-700 shrink-0">📍 ตำบลใน อ.องครักษ์:</span>
          <select
            value={selectedSubdistrict}
            onChange={(e) => setSelectedSubdistrict(e.target.value)}
            className="px-2 py-0.5 rounded-lg border border-slate-300 bg-white text-[10px] text-blue-900 font-semibold focus:outline-none focus:border-blue-500 max-w-[200px]"
          >
            <option value="all">ทุกตำบล (ครบ 11 ตำบล)</option>
            {ONGKHARAK_SUBDISTRICTS.map((sub, i) => (
              <option key={i} value={sub}>
                {sub}
              </option>
            ))}
          </select>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-0.5 no-scrollbar text-[10px]">
          <button
            type="button"
            onClick={() => setActiveCategory('all')}
            className={`px-2 py-0.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeCategory === 'all'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            ทั้งหมด ({displayedPresets.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('hospital')}
            className={`px-2 py-0.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeCategory === 'hospital'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            🏥 รพ./อนามัย
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('convenience')}
            className={`px-2 py-0.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeCategory === 'convenience'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            🏪 เซเว่น/ร้านค้า
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('market')}
            className={`px-2 py-0.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeCategory === 'market'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            🛒 ตลาด/โลตัส
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('temple')}
            className={`px-2 py-0.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeCategory === 'temple'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            🛕 วัด
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('school')}
            className={`px-2 py-0.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeCategory === 'school'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            🎒 โรงเรียน/มศว
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('gov')}
            className={`px-2 py-0.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeCategory === 'gov'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            🏛️ อบต./อำเภอ
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('home')}
            className={`px-2 py-0.5 rounded-lg font-medium whitespace-nowrap transition-all ${
              activeCategory === 'home'
                ? 'bg-blue-600 text-white font-semibold shadow-xs'
                : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
            }`}
          >
            🏠 หอพัก/บ้าน
          </button>
        </div>

        {/* Preset Chips */}
        <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-0.5 pt-1">
          <button
            type="button"
            onClick={handleGetCurrentLocation}
            disabled={gpsLoading}
            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-medium flex items-center gap-1 transition-all shadow-xs shrink-0"
          >
            {gpsLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Crosshair className="w-3.5 h-3.5" />}
            <span>GPS ปัจจุบัน</span>
          </button>

          {displayedPresets.slice(0, 10).map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => updatePin(preset.lat, preset.lng, preset.name, preset.isReturn, preset.address)}
              className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all flex items-center gap-1 border ${
                locationName === preset.name
                  ? 'bg-blue-100 text-blue-900 border-blue-400 font-bold shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <span>{preset.icon}</span>
              <span className="truncate max-w-[150px]">{preset.name}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Selected Location Details Editor */}
      <div className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-slate-600 shrink-0">จุดหมาย:</span>
          <input
            type="text"
            value={locationName}
            onChange={(e) => setLocationName(e.target.value)}
            placeholder="ชื่อสถานที่ปลายทาง..."
            className="flex-1 bg-transparent text-[11px] font-semibold text-blue-900 focus:outline-none"
          />
        </div>
        {locationAddress && (
          <p className="text-[10px] text-slate-500 pl-11 truncate">📍 {locationAddress}</p>
        )}
      </div>

      {/* Google Maps Satellite / Roadmap Interactive View */}
      <div className="relative rounded-xl overflow-hidden border border-slate-300 h-52 bg-slate-100 shadow-inner">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Coordinates badge */}
        <div className="absolute top-2 left-2 z-[400] bg-white/95 backdrop-blur-xs px-2.5 py-1 rounded-md text-[10px] shadow-sm text-slate-700 flex items-center gap-1 font-mono border border-slate-200">
          <MapPin className="w-3 h-3 text-rose-500" />
          <span>{selectedLat.toFixed(4)}, {selectedLng.toFixed(4)}</span>
        </div>

        {/* Layer Switcher (Roadmap vs Satellite) */}
        <button
          type="button"
          onClick={toggleMapLayer}
          className="absolute top-2 right-2 z-[400] bg-white/95 hover:bg-white text-slate-700 px-2.5 py-1 rounded-md text-[10px] font-semibold shadow-sm border border-slate-200 flex items-center gap-1 transition-all"
        >
          <Layers className="w-3 h-3 text-blue-600" />
          <span>{mapLayer === 'satellite' ? '🗺️ แผนที่ถนน' : '🛰️ ภาพดาวเทียม'}</span>
        </button>

        <div className="absolute bottom-2 right-2 z-[400] bg-white/90 backdrop-blur-xs px-2 py-0.5 rounded text-[9px] text-slate-600 font-medium shadow-xs">
          Google Maps • แตะหรือลากหมุดบนหลังคาอาคารได้
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

      {/* Time Selection Section */}
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
        className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold text-xs shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
      >
        <CheckCircle2 className="w-4 h-4" />
        <span>
          ยืนยัน: {locationName} ({distance} กม.) • ออก {startTime} น.{isReturn === 1 ? ` - กลับ ${endTime} น.` : ' (ไม่กลับ)'}
        </span>
      </button>
    </div>
  );
}
