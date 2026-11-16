'use client';

import React, { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  ScanFace,
  UserCheck,
  Bell,
  RefreshCw,
  LogOut,
  Camera,
  CheckCircle2,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Lock,
} from 'lucide-react';

export default function ProfilePage() {
  const router = useRouter();
  const { user, logout, refreshUsers } = useAuth();

  const [autoOpenGate, setAutoOpenGate] = useState(true);
  const [notifyParents, setNotifyParents] = useState(true);

  // Modals
  const [showTestScanModal, setShowTestScanModal] = useState(false);
  const [testScanState, setTestScanState] = useState<'idle' | 'scanning' | 'success'>('idle');
  const [similarityScore, setSimilarityScore] = useState(94.8);

  const [showReEnrollModal, setShowReEnrollModal] = useState(false);
  const [showPdpaModal, setShowPdpaModal] = useState(false);
  const [pdpaConsent, setPdpaConsent] = useState(Boolean(user?.pdpa_consented));

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const getInitials = (name?: string) => {
    if (!name) return 'นศ';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return parts[0].charAt(0) + parts[1].charAt(0);
    }
    return name.slice(0, 2);
  };

  const handleTestScan = () => {
    setShowTestScanModal(true);
    setTestScanState('scanning');
    setTimeout(() => {
      setSimilarityScore(96.2);
      setTestScanState('success');
    }, 1800);
  };

  const startReEnrollCamera = async () => {
    setShowReEnrollModal(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Camera not available:', err);
    }
  };

  const closeReEnrollCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }
    setShowReEnrollModal(false);
  };

  const handleConfirmPdpa = async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/users/pdpa-consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, consent: true }),
      });
      const data = await res.json();
      if (data.success) {
        setPdpaConsent(true);
        setShowPdpaModal(false);
        await refreshUsers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <div className="p-4 space-y-4">
      {/* Top Header Section (Screen 4 Header) */}
      <div className="flex items-center justify-between pt-2">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          ข้อมูลนักศึกษา & ใบหน้า AI
        </h2>

        {/* Right Button "ทดสอบสแกน" */}
        <button
          onClick={handleTestScan}
          className="px-3 py-1.5 bg-white hover:bg-slate-50 text-[#0066CC] border border-blue-200 rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all"
        >
          <ScanFace className="w-4 h-4 text-[#0066CC]" />
          <span>ทดสอบสแกน</span>
        </button>
      </div>

      {/* Main Profile Card */}
      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm text-center">
        {/* Large Avatar */}
        <div className="relative w-24 h-24 mx-auto mb-3">
          <div className="w-full h-full rounded-full bg-slate-100 border-4 border-[#0066CC] flex items-center justify-center font-bold text-slate-800 text-2xl shadow-sm">
            {getInitials(user?.full_name)}
          </div>
          <div className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-[#10B981] text-white flex items-center justify-center border-2 border-white shadow-xs">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>

        <h3 className="text-lg font-bold text-slate-900">
          {user?.full_name || 'นายอัครชา เปมะวิภาต'}
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          รหัสนักศึกษา {user?.username || '6731901001'} • {user?.group_code || 'ปวส.2/1'}
        </p>
        <p className="text-xs font-medium text-[#0066CC] mt-0.5">
          {user?.department_name || 'แผนกวิชาเทคโนโลยีธุรกิจดิจิทัล'} • วก.องครักษ์
        </p>

        {/* PDPA Consent Badge */}
        <div className="mt-3">
          {pdpaConsent || user?.pdpa_consented ? (
            <button
              onClick={() => setShowPdpaModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold hover:bg-emerald-100 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>ยินยอมรับทราบนโยบาย PDPA แล้ว ✓</span>
            </button>
          ) : (
            <button
              onClick={() => setShowPdpaModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-300 text-[11px] font-semibold hover:bg-amber-100 transition-colors animate-pulse"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
              <span>กดยืนยันรับทราบนโยบาย PDPA (จำเป็น)</span>
            </button>
          )}
        </div>

        {/* 3 Stats Boxes (Screen 4 Stats) */}
        <div className="grid grid-cols-3 gap-2.5 mt-5">
          <div className="bg-[#F8FAFC] rounded-2xl p-3 text-center border border-slate-100">
            <p className="text-base font-extrabold text-[#0066CC]">4 ครั้ง</p>
            <p className="text-[10px] text-slate-400 mt-0.5">ขออนุญาตเทอมนี้</p>
          </div>
          <div className="bg-[#F8FAFC] rounded-2xl p-3 text-center border border-slate-100">
            <p className="text-base font-extrabold text-slate-800">100%</p>
            <p className="text-[10px] text-slate-400 mt-0.5">กลับตรงเวลา</p>
          </div>
          <div className="bg-[#F8FAFC] rounded-2xl p-3 text-center border border-slate-100">
            <p className="text-base font-extrabold text-[#10B981]">12 ครั้ง</p>
            <p className="text-[10px] text-slate-400 mt-0.5">ผ่านไม้กั้น AI</p>
          </div>
        </div>
      </div>

      {/* Settings Card ("การเชื่อมต่อผู้ปกครอง & ไม้กั้นอัตโนมัติ") */}
      <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-sm space-y-4">
        <h4 className="text-xs font-bold text-slate-800">
          การเชื่อมต่อผู้ปกครอง & ไม้กั้นอัตโนมัติ
        </h4>

        {/* Row 1: Advisor Connected */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0066CC] flex items-center justify-center">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">ครูที่ปรึกษาผู้อนุมัติ</p>
              <p className="text-[10px] text-slate-400">ครูอรรถเมธ ตะโกนา (แผนก ทธด.)</p>
            </div>
          </div>
          <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 text-[11px] font-semibold rounded-full border border-emerald-200">
            เชื่อมต่อแล้ว
          </span>
        </div>

        {/* Row 2: Auto Open Gate Switch */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#0066CC] flex items-center justify-center">
              <ScanFace className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">เปิดไม้กั้นอัตโนมัติเมื่อสแกนใบหน้า</p>
              <p className="text-[10px] text-slate-400">เฉพาะช่วงเวลาที่ได้รับอนุมัติในแชท</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAutoOpenGate(!autoOpenGate)}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              autoOpenGate ? 'bg-[#0066CC]' : 'bg-slate-200'
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                autoOpenGate ? 'translate-x-5' : ''
              }`}
            ></span>
          </button>
        </div>

        {/* Row 3: Notify Parents Switch */}
        <div className="flex items-center justify-between py-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">แจ้งเตือนผู้ปกครองเมื่อผ่านไม้กั้น</p>
              <p className="text-[10px] text-slate-400">ส่งเวลาเข้า-ออกไปยัง LINE ผู้ปกครอง</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setNotifyParents(!notifyParents)}
            className={`w-11 h-6 rounded-full transition-colors relative ${
              notifyParents ? 'bg-[#0066CC]' : 'bg-slate-200'
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                notifyParents ? 'translate-x-5' : ''
              }`}
            ></span>
          </button>
        </div>

        {/* Row 4: Re-enroll Face */}
        <button
          onClick={startReEnrollCamera}
          className="w-full flex items-center justify-between py-1 text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-[#0066CC] transition-colors">
              <RefreshCw className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">อัปเดตข้อมูลใบหน้า (Re-enroll Face)</p>
              <p className="text-[10px] text-slate-400">อัปเดตล่าสุด: วันนี้ (10 พ.ย. 2569)</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
        </button>

        {/* Row 5: View PDPA Policy */}
        <button
          onClick={() => setShowPdpaModal(true)}
          className="w-full flex items-center justify-between py-1 text-left group"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-100 transition-colors">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">นโยบายคุ้มครองข้อมูลส่วนบุคคล (PDPA)</p>
              <p className="text-[10px] text-slate-400">ชีวมิติใบหน้า & พิกัดตำแหน่งเฉพาะช่วงเวลา</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600" />
        </button>
      </div>

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        className="w-full py-3 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-2xs"
      >
        <LogOut className="w-4 h-4" />
        <span>ออกจากระบบ</span>
      </button>

      {/* Test Scan Modal */}
      {showTestScanModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full text-center shadow-xl">
            <div className="w-20 h-20 rounded-full bg-blue-50 border-4 border-blue-500 mx-auto mb-3 flex items-center justify-center">
              {testScanState === 'scanning' ? (
                <ScanFace className="w-10 h-10 text-blue-600 animate-pulse" />
              ) : (
                <CheckCircle2 className="w-10 h-10 text-emerald-600" />
              )}
            </div>
            <h3 className="font-bold text-slate-800 text-sm">
              {testScanState === 'scanning' ? 'กำลังทดสอบสแกนใบหน้า...' : 'ผลการตรวจสอบใบหน้า AI'}
            </h3>
            {testScanState === 'success' && (
              <div className="my-3 p-3 bg-emerald-50 rounded-2xl border border-emerald-200 text-xs text-emerald-800">
                <p className="font-bold">ค่าความเหมือน (Similarity Score): {similarityScore}%</p>
                <p className="text-[11px] text-emerald-600 mt-0.5">ผ่านเกณฑ์ขั้นต่ำ 85.0% พร้อมใช้งาน</p>
              </div>
            )}
            <button
              onClick={() => setShowTestScanModal(false)}
              className="w-full py-2 bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
            >
              ปิด
            </button>
          </div>
        </div>
      )}

      {/* Re-enroll Face Modal */}
      {showReEnrollModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-3">
            <h3 className="font-bold text-slate-800 text-sm">ถ่ายภาพอัปเดตใบหน้าใหม่ (Re-enroll)</h3>
            <div className="aspect-video bg-slate-900 rounded-2xl overflow-hidden relative flex items-center justify-center">
              <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              <div className="absolute inset-0 border-2 border-cyan-400 border-dashed rounded-3xl m-4 pointer-events-none"></div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={closeReEnrollCamera}
                className="flex-1 py-2.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl"
              >
                ยกเลิก
              </button>
              <button
                onClick={() => {
                  alert('บันทึกและสกัด Feature Vector ใหม่เรียบร้อยแล้ว!');
                  closeReEnrollCamera();
                }}
                className="flex-1 py-2.5 bg-[#0066CC] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
              >
                <Camera className="w-4 h-4" />
                <span>บันทึกใบหน้า</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PDPA Policy Modal */}
      {showPdpaModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-xs space-y-3 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center gap-2 text-blue-600 font-bold text-sm">
              <ShieldCheck className="w-5 h-5" />
              <span>นโยบายความยินยอมข้อมูลส่วนบุคคล (PDPA)</span>
            </div>
            <p className="text-slate-600 leading-relaxed text-[11px]">
              วิทยาลัยการอาชีพองครักษ์ ขอความยินยอมในการจัดเก็บและประมวลผลข้อมูลส่วนบุคคลของนักศึกษาเพื่อความปลอดภัยในการออกนอกสถานศึกษา:
            </p>
            <div className="bg-slate-50 p-3 rounded-2xl space-y-2 border border-slate-200/80 text-[11px]">
              <div className="flex items-start gap-1.5">
                <span className="font-bold text-slate-800 shrink-0">1. ข้อมูลชีวมิติ (Biometrics):</span>
                <span className="text-slate-600">จัดเก็บเวกเตอร์คุณลักษณะใบหน้า AI 512 มิติ สำหรับสแกนเปิดไม้กั้นอัตโนมัติ</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="font-bold text-slate-800 shrink-0">2. พิกัดตำแหน่ง (GPS):</span>
                <span className="text-slate-600">ตรวจสอบพิกัดเฉพาะเมื่อกดเช็คอินถึงสถานที่ปลายทางและหน้าป้อมยามวิทยาลัยเท่านั้น (ไม่ติดตามนอกเวลา)</span>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="font-bold text-slate-800 shrink-0">3. การคุ้มครอง:</span>
                <span className="text-slate-600">ข้อมูลถูกเข้ารหัสและใช้เพื่อวัตถุประสงค์ความปลอดภัยและระเบียบวินัยตามข้อบังคับ สอศ. เท่านั้น</span>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowPdpaModal(false)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl"
              >
                ปิด
              </button>
              <button
                onClick={handleConfirmPdpa}
                className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>ยอมรับและยินยอม</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
