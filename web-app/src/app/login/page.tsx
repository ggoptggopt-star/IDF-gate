'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { ScanFace, Lock, User, ShieldCheck, MessageCircle, ArrowRight, Camera, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react';
import BankingFaceKycModal from '@/components/BankingFaceKycModal';

export default function LoginPage() {
  const router = useRouter();
  const { login, loginWithFace, users } = useAuth();

  const [activeTab, setActiveTab] = useState<'login' | 'enroll'>('login');
  const [username, setUsername] = useState('6731901001'); // Default demo: นายอัครชา
  const [password, setPassword] = useState('123456');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Face ID modal state
  const [showFaceModal, setShowFaceModal] = useState(false);
  const [faceScanState, setFaceScanState] = useState<'scanning' | 'matched' | 'failed'>('scanning');
  const [matchedStudentName, setMatchedStudentName] = useState('');

  // Enroll camera state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [enrollStudentCode, setEnrollStudentCode] = useState('6731901001');
  const [enrollStep, setEnrollStep] = useState(1);
  const [enrollSuccess, setEnrollSuccess] = useState(false);
  const [showBankingKycModal, setShowBankingKycModal] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const ok = await login(username, password);
    setLoading(false);

    if (ok) {
      router.push('/');
    } else {
      setError('รหัสนักศึกษา/บุคลากร หรือรหัสผ่านไม่ถูกต้อง');
    }
  };

  const startFaceScan = () => {
    setShowFaceModal(true);
    setFaceScanState('scanning');
    
    // Simulate AI Face detection and match with demo student
    setTimeout(() => {
      const demoStudent = users.find((u) => u.username === username) || users.find((u) => u.role === 'student');
      if (demoStudent) {
        setMatchedStudentName(demoStudent.full_name);
        setFaceScanState('matched');
        setTimeout(async () => {
          await loginWithFace(demoStudent.id);
          setShowFaceModal(false);
          router.push('/');
        }, 1200);
      } else {
        setFaceScanState('failed');
      }
    }, 1800);
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Camera access not available or permission denied:', err);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
  };

  useEffect(() => {
    if (activeTab === 'enroll') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-[#F4F7FB] flex flex-col justify-between p-4 max-w-md mx-auto">
      {/* Header Profile Emblem */}
      <div className="pt-6 pb-2 text-center flex flex-col items-center">
        {/* Glow AI Face Circle */}
        <div className="relative mb-3">
          <div className="w-20 h-20 rounded-full bg-gradient-to-b from-[#00A3FF] to-[#0055B3] p-[3px] shadow-[0_0_25px_rgba(0,163,255,0.4)] flex items-center justify-center">
            <div className="w-full h-full rounded-full bg-[#03152B] flex items-center justify-center relative overflow-hidden">
              <ScanFace className="w-10 h-10 text-cyan-400 animate-pulse" />
            </div>
          </div>
          <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 bg-[#10B981] text-white text-[10px] font-bold px-2 py-0.5 rounded-full border border-white shadow-sm whitespace-nowrap">
            AI FACE
          </span>
        </div>

        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Smart Gate Pass AI</h1>
        <p className="text-[#0066CC] font-semibold text-sm mt-0.5">วิทยาลัยการอาชีพองครักษ์ (OICEC)</p>
        <p className="text-slate-500 text-xs mt-1">ระบบขออนุญาตออกนอกสถานศึกษา & เปิดไม้กั้นด้วยใบหน้า</p>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 my-4">
        {/* Switcher Tabs */}
        <div className="bg-slate-100 p-1 rounded-2xl grid grid-cols-2 mb-6">
          <button
            type="button"
            onClick={() => setActiveTab('login')}
            className={`py-2 text-xs font-semibold rounded-xl transition-all ${
              activeTab === 'login'
                ? 'bg-white text-[#0066CC] shadow-sm font-bold'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            เข้าสู่ระบบ
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('enroll')}
            className={`py-2 text-xs font-semibold rounded-xl transition-all ${
              activeTab === 'enroll'
                ? 'bg-white text-[#0066CC] shadow-sm font-bold'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            ลงทะเบียนใบหน้า
          </button>
        </div>

        {activeTab === 'login' ? (
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-600 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                รหัสนักศึกษา / บุคลากร
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </span>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="เช่น 6731901001 หรือ teacher_pattana"
                  required
                  className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] transition-all"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-medium text-slate-700">รหัสผ่าน</label>
                <button
                  type="button"
                  onClick={() => alert('รหัสผ่านเริ่มต้นคือ 123456')}
                  className="text-[11px] text-[#0066CC] hover:underline"
                >
                  ลืมรหัสผ่าน?
                </button>
              </div>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200/80 rounded-2xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#0077D7] hover:bg-[#0066CC] text-white font-medium text-xs rounded-2xl flex items-center justify-center gap-2 shadow-sm transition-all active:scale-[0.99]"
            >
              <span>{loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบขออนุญาต'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={startFaceScan}
              className="w-full py-3 bg-[#EBF3FC] hover:bg-[#DEEEFC] text-[#0066CC] border border-[#B8D7F9] font-medium text-xs rounded-2xl flex items-center justify-center gap-2 transition-all active:scale-[0.99]"
            >
              <ScanFace className="w-4 h-4 text-[#0066CC]" />
              <span>สแกนใบหน้าเพื่อเข้าสู่ระบบ (Face ID)</span>
            </button>
          </form>
        ) : (
          /* Enrollment Tab */
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-xs text-slate-600">ลงทะเบียนข้อมูลใบหน้าสำหรับ AI Face Recognition</p>
              <p className="text-[11px] text-slate-400 mt-0.5">เปิดกล้องหน้าตรง เก็บภาพ 3 มุมเพื่อความแม่นยำ</p>
            </div>

            <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900 flex items-center justify-center border border-slate-200">
              {cameraStream ? (
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                  <Camera className="w-8 h-8 mb-2 opacity-50" />
                  <span className="text-[11px]">ไม่พบกล้องเว็บแคม หรือยังไม่ได้อนุญาตการใช้กล้อง</span>
                </div>
              )}

              {/* Overlay Face Guide */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                <div className="w-32 h-44 border-2 border-cyan-400/80 rounded-[40px] border-dashed animate-pulse"></div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">รหัสนักศึกษาที่จะลงทะเบียน</label>
              <input
                type="text"
                value={enrollStudentCode}
                onChange={(e) => setEnrollStudentCode(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                placeholder="เช่น 6731901001"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowBankingKycModal(true)}
              className="w-full py-3.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25 active:scale-[0.98] transition-all"
            >
              <Sparkles className="w-4 h-4 text-cyan-200 animate-spin" />
              <span>เริ่มสแกน e-KYC (หันซ้าย-ขวา-ยิ้ม-กะพริบตา)</span>
            </button>

            {enrollSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs text-center flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                <span>บันทึกและสกัด Feature Vector เรียบร้อย!</span>
              </div>
            )}
          </div>
        )}

        {/* School Link Divider */}
        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <span className="relative bg-white px-3 text-[11px] text-slate-400 font-medium">
            เชื่อมต่อระบบสถานศึกษา
          </span>
        </div>

        {/* Integration Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => alert('จำลองการเชื่อมโยงระบบฐานข้อมูล ศธ.02')}
            className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl flex items-center justify-center gap-2 text-slate-700 text-xs font-medium transition-all"
          >
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <span>ระบบ ศธ.02</span>
          </button>

          <button
            type="button"
            onClick={() => alert('จำลองการแจ้งเตือนผู้ปกครองผ่าน LINE Messaging API')}
            className="py-2.5 px-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-2xl flex items-center justify-center gap-2 text-slate-700 text-xs font-medium transition-all"
          >
            <MessageCircle className="w-4 h-4 text-[#06C755]" />
            <span>แจ้งผู้ปกครอง</span>
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-3">
        <p className="text-[11px] text-slate-400">
          พัฒนาเพื่อความปลอดภัยในสถานศึกษา • <span className="text-[#0066CC] font-medium">งานปกครอง วก.องครักษ์</span>
        </p>
      </footer>

      {/* Face ID Simulation Modal */}
      {showFaceModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full text-center shadow-xl animate-scaleUp">
            <div className="relative w-28 h-28 mx-auto mb-4 flex items-center justify-center">
              <div className={`w-full h-full rounded-full border-4 ${
                faceScanState === 'matched' ? 'border-emerald-500 bg-emerald-50' : 'border-blue-500 animate-spin bg-blue-50'
              }`}></div>
              <div className="absolute inset-0 flex items-center justify-center">
                {faceScanState === 'matched' ? (
                  <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                ) : (
                  <ScanFace className="w-12 h-12 text-blue-600" />
                )}
              </div>
            </div>

            <h3 className="font-bold text-slate-800 text-base mb-1">
              {faceScanState === 'scanning' && 'กำลังสแกนใบหน้า...'}
              {faceScanState === 'matched' && 'ยืนยันตัวตนสำเร็จ!'}
              {faceScanState === 'failed' && 'ไม่พบใบหน้าในระบบ'}
            </h3>

            <p className="text-xs text-slate-500 mb-4">
              {faceScanState === 'scanning' && 'กรุณามองตรงไปที่กล้องเว็บแคม'}
              {faceScanState === 'matched' && `ยินดีต้อนรับ ${matchedStudentName}`}
              {faceScanState === 'failed' && 'กรุณาลองใหม่อีกครั้ง หรือล็อกอินด้วยรหัสผ่าน'}
            </p>

            {faceScanState === 'scanning' && (
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div className="bg-blue-600 h-1.5 rounded-full animate-pulse w-3/4"></div>
              </div>
            )}

            {faceScanState === 'failed' && (
              <button
                onClick={() => setShowFaceModal(false)}
                className="w-full py-2 bg-slate-200 text-slate-700 text-xs rounded-xl font-medium"
              >
                ปิดหน้าต่าง
              </button>
            )}
          </div>
        </div>
      )}

      {/* Banking Face e-KYC Modal */}
      <BankingFaceKycModal
        isOpen={showBankingKycModal}
        onClose={() => setShowBankingKycModal(false)}
        userId={users.find((u) => u.username === enrollStudentCode)?.id || 'user-stu-akkaracha'}
        studentName={users.find((u) => u.username === enrollStudentCode)?.full_name || 'นายอัครชา เปมะวิภาต'}
        onSuccess={() => {
          setShowBankingKycModal(false);
          setActiveTab('login');
        }}
      />
    </div>
  );
}
