'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ShieldCheck, MapPin, Lock, CheckCircle2, AlertCircle, Eye, ChevronDown, ChevronUp } from 'lucide-react';

export default function PdpaGpsModal() {
  const { user, refreshUsers } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [gpsError, setGpsError] = useState('');

  useEffect(() => {
    // Show only if logged-in student has NOT consented to PDPA
    if (user && user.role === 'student') {
      const consentedInStorage = typeof window !== 'undefined' ? localStorage.getItem(`pdpa_granted_${user.id}`) : null;
      if (!user.pdpa_consented && !consentedInStorage) {
        setIsOpen(true);
      }
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const handleGrantConsent = async () => {
    setLoading(true);
    setGpsError('');

    let initialLat = 14.109127;
    let initialLng = 101.062441;

    // Request GPS permission once
    if (typeof window !== 'undefined' && 'geolocation' in navigator) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 0,
          });
        });
        initialLat = position.coords.latitude;
        initialLng = position.coords.longitude;
      } catch (err: any) {
        console.warn('GPS permission prompt dismissed or unavailable, continuing with college coords:', err);
      }
    }

    try {
      const res = await fetch('/api/users/pdpa-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          consent: true,
          initial_lat: initialLat,
          initial_lng: initialLng,
        }),
      });

      if (res.ok) {
        if (typeof window !== 'undefined') {
          localStorage.setItem(`pdpa_granted_${user.id}`, 'true');
        }
        await refreshUsers();
        setIsOpen(false);
      } else {
        setGpsError('ไม่สามารถบันทึกความยินยอมได้ โปรดลองอีกครั้ง');
      }
    } catch (e: any) {
      setGpsError(e.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-md w-full p-6 text-white shadow-2xl relative">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-white">ความยินยอม PDPA & เปิดพิกัด GPS</h3>
            <p className="text-xs text-slate-400">วิทยาลัยการอาชีพองครักษ์ (OICEC)</p>
          </div>
        </div>

        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 text-xs text-slate-300 space-y-2 mb-4 leading-relaxed">
          <p className="font-medium text-slate-100 flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            การคุ้มครองข้อมูลส่วนบุคคลเพื่อความปลอดภัย:
          </p>
          <ul className="list-disc list-inside space-y-1 text-slate-300">
            <li>ระบบจะบันทึกข้อมูลใบหน้าเพื่อใช้เปิดไม้กั้นอัตโนมัติ</li>
            <li>
              <span className="text-emerald-400 font-semibold">พิกัด GPS จะทำงานเฉพาะ</span> ช่วงเวลาที่ได้รับอนุมัติออกนอกวิทยาลัยจนถึงจุดหมายเท่านั้น (ไม่ติดตามตลอด 24 ชม.)
            </li>
            <li>ข้อมูลใช้เพื่อการรายงานต่ออาจารย์ที่ปรึกษาและผู้ปกครอง</li>
          </ul>

          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 pt-1 font-medium transition-colors"
          >
            {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            {showDetails ? 'ซ่อนรายละเอียด พ.ร.บ. PDPA' : 'ดูรายละเอียดข้อตกลงและสิทธิ์ของนักศึกษา'}
          </button>

          {showDetails && (
            <div className="pt-2 text-[11px] text-slate-400 border-t border-slate-700/50 mt-2 space-y-1">
              <p>ตาม พ.ร.บ. คุ้มครองข้อมูลส่วนบุคคล พ.ศ. 2562 วิทยาลัยการอาชีพองครักษ์จะเก็บรักษาข้อมูลอย่างปลอดภัย และท่านมีสิทธิ์ขอดูหรือเพิกถอนข้อมูลได้ตามระเบียบงานปกครอง</p>
            </div>
          )}
        </div>

        {gpsError && (
          <div className="mb-4 p-2.5 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{gpsError}</span>
          </div>
        )}

        <button
          onClick={handleGrantConsent}
          disabled={loading}
          className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              <span>ยินยอมและเปิดใช้งานตำแหน่ง (ครั้งเดียว)</span>
            </>
          )}
        </button>
        <p className="text-[11px] text-center text-slate-400 mt-2">
          กดยืนยันเพียงครั้งเดียว ไม่ต้องกดยืนยันซ้ำในการใช้งานครั้งถัดไป
        </p>
      </div>
    </div>
  );
}
