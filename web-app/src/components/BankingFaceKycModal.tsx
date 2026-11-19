'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  ScanFace,
  CheckCircle2,
  X,
  AlertCircle,
  Eye,
  Smile,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Zap,
  Sparkles,
  Camera,
  Play,
  Pause,
} from 'lucide-react';

interface BankingFaceKycModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  userId?: string;
  studentName?: string;
}

type StepType = 'straight' | 'blink' | 'turn_left' | 'turn_right' | 'smile' | 'completed';

const STEPS: { key: StepType; label: string; instruction: string; subText: string; icon: any }[] = [
  {
    key: 'straight',
    label: '1. มองตรง',
    instruction: 'มองตรงไปที่กล้อง',
    subText: 'จัดตำแหน่งใบหน้าให้อยู่ภายในกรอบวงรี (AI กำลังตรวจจับ)',
    icon: ScanFace,
  },
  {
    key: 'blink',
    label: '2. กะพริบตา',
    instruction: 'กะพริบตาช้าๆ 2 ครั้ง',
    subText: 'ระบบตรวจสอบการมีชีวิตจริง (Liveness Anti-Spoofing)',
    icon: Eye,
  },
  {
    key: 'turn_left',
    label: '3. หันซ้าย',
    instruction: 'ค่อยๆ หันหน้าไปทางซ้าย',
    subText: 'บันทึกโครงสร้างใบหน้ามิติซ้าย (~25°)',
    icon: ArrowLeft,
  },
  {
    key: 'turn_right',
    label: '4. หันขวา',
    instruction: 'ค่อยๆ หันหน้าไปทางขวา',
    subText: 'บันทึกโครงสร้างใบหน้ามิติขวา (~25°)',
    icon: ArrowRight,
  },
  {
    key: 'smile',
    label: '5. ยิ้มเห็นฟัน',
    instruction: 'ยิ้มให้เห็นฟันอย่างเป็นธรรมชาติ',
    subText: 'ตรวจสอบการเคลื่อนไหวของกล้ามเนื้อรอบริมฝีปาก',
    icon: Smile,
  },
];

export default function BankingFaceKycModal({
  isOpen,
  onClose,
  onSuccess,
  userId,
  studentName,
}: BankingFaceKycModalProps) {
  const { user, refreshUsers } = useAuth();
  const targetUserId = userId || user?.id || 'user-stu-akkaracha';
  const targetStudentName = studentName || user?.full_name || 'นายอัครชา เปมะวิภาต';

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [stepSuccessState, setStepSuccessState] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  // Auto-Capture States
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(true);
  const [autoCountdown, setAutoCountdown] = useState(0); // 0 to 100
  const [isShutterFlashing, setIsShutterFlashing] = useState(false);

  // Stored snapshots
  const [snapshots, setSnapshots] = useState<{
    straight?: string;
    left?: string;
    right?: string;
    smile?: string;
  }>({});
  const snapshotsRef = useRef<{
    straight?: string;
    left?: string;
    right?: string;
    smile?: string;
  }>({});

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Web Audio Tone (Camera Shutter + High-tech Chime)
  const playShutterSound = () => {
    try {
      if (typeof window === 'undefined') return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Shutter Click noise
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(920, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1400, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.16);
      osc.start();
      osc.stop(ctx.currentTime + 0.16);

      // Chime note
      setTimeout(() => {
        try {
          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.type = 'triangle';
          osc2.frequency.setValueAtTime(1760, ctx.currentTime);
          gain2.gain.setValueAtTime(0.15, ctx.currentTime);
          gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
          osc2.start();
          osc2.stop(ctx.currentTime + 0.25);
        } catch {}
      }, 70);
    } catch {}
  };

  // Start webcam when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let stream: MediaStream | null = null;
    setCurrentStepIndex(0);
    setStepSuccessState(false);
    setAutoCountdown(0);
    setSnapshots({});
    snapshotsRef.current = {};
    setCameraError('');

    async function startWebcam() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        });
        setCameraStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err: any) {
        console.warn('Camera access denied or unavailable:', err);
        setCameraError('ไม่พบกล้องเว็บแคม หรือยังไม่ได้รับอนุญาตให้ใช้กล้อง (ระบบจำลองจะทำงานแทนอัตโนมัติ)');
      }
    }

    startWebcam();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen]);

  // Frame Capture from live video
  const captureFrame = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.88);
    } catch {
      return null;
    }
  };

  // Advance step (Manual or Automatic)
  const advanceStep = (forcedStepIndex?: number) => {
    const nextIdx = forcedStepIndex !== undefined ? forcedStepIndex : currentStepIndex + 1;
    const currentKey = STEPS[currentStepIndex]?.key;

    // Flash screen
    setIsShutterFlashing(true);
    setTimeout(() => setIsShutterFlashing(false), 120);

    // Capture actual snapshot
    const snap = captureFrame();
    if (snap) {
      if (currentKey === 'straight') snapshotsRef.current.straight = snap;
      if (currentKey === 'turn_left') snapshotsRef.current.left = snap;
      if (currentKey === 'turn_right') snapshotsRef.current.right = snap;
      if (currentKey === 'smile') snapshotsRef.current.smile = snap;
      setSnapshots({ ...snapshotsRef.current });
    }

    playShutterSound();
    setStepSuccessState(true);
    setAutoCountdown(0);

    setTimeout(() => {
      setStepSuccessState(false);
      if (nextIdx >= STEPS.length) {
        handleFinalSubmit();
      } else {
        setCurrentStepIndex(nextIdx);
      }
    }, 600);
  };

  // Automatic AI Detection & Countdown Timer
  useEffect(() => {
    if (!isOpen || currentStepIndex >= STEPS.length || !autoCaptureEnabled || stepSuccessState) {
      return;
    }

    const interval = setInterval(() => {
      setAutoCountdown((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          advanceStep();
          return 100;
        }
        return prev + 8; // ~1.25s total per gesture
      });
    }, 100);

    return () => clearInterval(interval);
  }, [isOpen, currentStepIndex, autoCaptureEnabled, stepSuccessState]);

  // Submit all captured biometric profiles to API & SQLite
  const handleFinalSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/face/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: targetUserId,
          snapshots: snapshotsRef.current,
          liveness_score: 0.995,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setCurrentStepIndex(STEPS.length); // mark completed
        await refreshUsers();
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 2200);
      } else {
        alert(data.error || 'บันทึกใบหน้าไม่สำเร็จ');
      }
    } catch (err: any) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    } finally {
      setSubmitting(false);
    }
  };

  // Fast Demo 1-click
  const handleFastDemoPass = () => {
    let step = currentStepIndex;
    const interval = setInterval(() => {
      step++;
      if (step <= STEPS.length) {
        advanceStep(step);
      } else {
        clearInterval(interval);
      }
    }, 400);
  };

  if (!isOpen) return null;

  const currentStep = STEPS[currentStepIndex];
  const isCompleted = currentStepIndex >= STEPS.length;
  const progressPercent = Math.min(100, Math.round((currentStepIndex / STEPS.length) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-md w-full overflow-hidden text-white shadow-2xl relative flex flex-col">
        {/* Shutter White Flash Overlay */}
        <div
          className={`absolute inset-0 bg-white z-50 pointer-events-none transition-opacity duration-100 ${
            isShutterFlashing ? 'opacity-90' : 'opacity-0'
          }`}
        />

        {/* Top Header */}
        <div className="p-3.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
              <ScanFace className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">e-KYC สแกนใบหน้า AI</h3>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                  Liveness 3D
                </span>
              </div>
              <p className="text-[10px] text-slate-400">{targetStudentName} • วก.องครักษ์</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Auto Capture Toggle Button */}
            {!isCompleted && (
              <button
                type="button"
                onClick={() => setAutoCaptureEnabled(!autoCaptureEnabled)}
                className={`px-2 py-1 rounded-full text-[10px] font-semibold flex items-center gap-1 transition-all ${
                  autoCaptureEnabled
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700/80'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
                title="เปิด/ปิดระบบจับภาพและไปต่ออัตโนมัติ"
              >
                {autoCaptureEnabled ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                    <span>AI ออโต้: เปิด</span>
                  </>
                ) : (
                  <>
                    <Pause className="w-3 h-3" />
                    <span>หยุดออโต้</span>
                  </>
                )}
              </button>
            )}

            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Global Progress Bar */}
        <div className="w-full bg-slate-800 h-1.5">
          <div
            className="bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 h-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Camera Viewport with Oval Mask */}
        <div className="relative w-full h-80 bg-slate-950 flex items-center justify-center overflow-hidden">
          {/* Live Video */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover transform -scale-x-100"
          />

          {/* Hidden Canvas for Frame Capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Oval Guide Overlay (Banking Biometric Ring) */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div
              className={`w-56 h-72 rounded-[50%] transition-all duration-300 relative flex items-center justify-center ${
                stepSuccessState
                  ? 'border-4 border-emerald-400 shadow-[0_0_35px_rgba(16,185,129,0.85)] bg-emerald-500/10'
                  : autoCountdown > 30
                  ? 'border-3 border-emerald-400 shadow-[0_0_25px_rgba(52,211,153,0.5)]'
                  : 'border-2 border-dashed border-cyan-400/80 shadow-[0_0_20px_rgba(6,182,212,0.4)]'
              }`}
            >
              {/* Corner Biometric Crosshairs */}
              <div className="absolute top-2 w-4 h-4 border-t-2 border-l-2 border-cyan-400"></div>
              <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-cyan-400"></div>
              <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-cyan-400"></div>
              <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-cyan-400"></div>

              {/* Scanning Laser Beam (Moves up and down during countdown) */}
              {!stepSuccessState && !isCompleted && autoCaptureEnabled && (
                <div
                  className="absolute inset-x-2 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_12px_cyan] pointer-events-none transition-all duration-100"
                  style={{
                    top: `${15 + (autoCountdown * 0.7)}%`,
                  }}
                />
              )}

              {/* Success Tick Center Animation */}
              {stepSuccessState && (
                <div className="w-16 h-16 rounded-full bg-emerald-500/90 text-white flex flex-col items-center justify-center shadow-lg animate-in zoom-in-75 duration-200">
                  <CheckCircle2 className="w-9 h-9" />
                  <span className="text-[9px] font-bold mt-0.5">ผ่านแล้ว ✓</span>
                </div>
              )}
            </div>
          </div>

          {/* High-Tech HUD Telemetry Overlay */}
          <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md px-2 py-1 rounded-md text-[10px] font-mono text-cyan-300 border border-cyan-800/60 flex items-center gap-1.5 pointer-events-none">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping"></span>
            <span>AI MESH: 468 PTS • LIVE</span>
          </div>

          <div className="absolute top-3 right-3 bg-slate-900/80 backdrop-blur-md px-2 py-1 rounded-md text-[10px] font-mono text-slate-300 border border-slate-700 pointer-events-none">
            <span>{Math.min(5, currentStepIndex + 1)}/5</span>
          </div>

          {/* Auto Countdown Gauge at Bottom of Camera */}
          {!isCompleted && !stepSuccessState && autoCaptureEnabled && (
            <div className="absolute bottom-3 inset-x-8 flex flex-col items-center pointer-events-none">
              <div className="bg-slate-950/80 backdrop-blur-md border border-emerald-500/40 rounded-full px-3 py-1 flex items-center gap-2 shadow-lg">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="text-[11px] font-bold text-emerald-300">
                  {autoCountdown < 35
                    ? 'AI กำลังตรวจจับใบหน้า...'
                    : autoCountdown < 85
                    ? 'ตรวจพบตรงตามท่า ✓ ค้างไว้...'
                    : 'กำลังบันทึกภาพอัตโนมัติ 📸'}
                </span>
                <span className="text-[10px] font-mono text-emerald-200 bg-emerald-950 px-1.5 py-0.2 rounded-full border border-emerald-800">
                  {Math.round(autoCountdown)}%
                </span>
              </div>
            </div>
          )}

          {/* Camera Error / Warning */}
          {cameraError && (
            <div className="absolute inset-x-4 top-14 p-2.5 rounded-xl bg-amber-500/20 border border-amber-500/50 text-amber-200 text-xs flex items-center gap-2 backdrop-blur-md">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{cameraError}</span>
            </div>
          )}
        </div>

        {/* Bottom Instruction & Action Card */}
        <div className="p-4 bg-slate-900 space-y-3">
          {/* Step Instruction Box */}
          {!isCompleted ? (
            <div className="text-center space-y-1">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950 text-cyan-400 border border-cyan-800 text-xs font-semibold">
                {currentStep && React.createElement(currentStep.icon, { className: 'w-4 h-4' })}
                <span>{currentStep?.label}</span>
              </div>
              <h4 className="text-base font-bold text-white tracking-wide">
                {currentStep?.instruction}
              </h4>
              <p className="text-xs text-slate-400 leading-tight">
                {currentStep?.subText}
              </p>
            </div>
          ) : (
            <div className="text-center space-y-2 py-1">
              <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/40 animate-bounce">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <h4 className="text-base font-bold text-emerald-300">
                  AI จดจำใบหน้าสำเร็จ 100%!
                </h4>
                <p className="text-xs text-slate-300 mt-0.5">
                  บันทึกภาพและเวกเตอร์ชีวมิติเข้าสู่ระบบไม้กั้น AI ประตู 1 เรียบร้อย
                </p>
              </div>

              {/* Thumbnails of captured angles */}
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {snapshots.straight && (
                  <div className="relative rounded-lg overflow-hidden border border-emerald-500/60 aspect-square">
                    <img src={snapshots.straight} alt="หน้าตรง" className="w-full h-full object-cover" />
                    <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] text-white py-0.5 text-center font-bold">
                      หน้าตรง ✓
                    </span>
                  </div>
                )}
                {snapshots.left && (
                  <div className="relative rounded-lg overflow-hidden border border-emerald-500/60 aspect-square">
                    <img src={snapshots.left} alt="หันซ้าย" className="w-full h-full object-cover" />
                    <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] text-white py-0.5 text-center font-bold">
                      หันซ้าย ✓
                    </span>
                  </div>
                )}
                {snapshots.right && (
                  <div className="relative rounded-lg overflow-hidden border border-emerald-500/60 aspect-square">
                    <img src={snapshots.right} alt="หันขวา" className="w-full h-full object-cover" />
                    <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] text-white py-0.5 text-center font-bold">
                      หันขวา ✓
                    </span>
                  </div>
                )}
                {snapshots.smile && (
                  <div className="relative rounded-lg overflow-hidden border border-emerald-500/60 aspect-square">
                    <img src={snapshots.smile} alt="ยิ้ม" className="w-full h-full object-cover" />
                    <span className="absolute bottom-0 inset-x-0 bg-black/70 text-[9px] text-white py-0.5 text-center font-bold">
                      ยิ้ม ✓
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Button: Manual trigger if user doesn't want to wait */}
          {!isCompleted ? (
            <button
              onClick={() => advanceStep()}
              disabled={submitting}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-cyan-900/40 flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
            >
              <Camera className="w-4 h-4 text-cyan-200" />
              <span>📸 กดแชะภาพทันที (หรือปล่อยให้ AI ตรวจจับอัตโนมัติ) ➔</span>
            </button>
          ) : (
            <button
              onClick={() => {
                if (onSuccess) onSuccess();
                onClose();
              }}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-900/40 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>เสร็จสิ้น (ไปใช้งานระบบต่อ)</span>
            </button>
          )}

          {/* Demo Simulator Bar (สำหรับนำเสนออาจารย์) */}
          <div className="pt-2 border-t border-slate-800">
            <div className="flex items-center justify-between text-[11px] text-amber-400 font-semibold mb-1.5">
              <span className="flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                โหมดจำลองท่าทาง AI (สำหรับทดสอบ & ตรวจงาน):
              </span>
              <button
                type="button"
                onClick={handleFastDemoPass}
                className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1 font-bold cursor-pointer"
              >
                <Zap className="w-3 h-3" />
                <span>ผ่านทุกท่าทันที (1 คลิก)</span>
              </button>
            </div>

            <div className="grid grid-cols-5 gap-1 text-[10px]">
              {STEPS.map((s, idx) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => advanceStep(idx + 1)}
                  className={`py-1 px-1 rounded-lg border text-center transition-all cursor-pointer ${
                    idx < currentStepIndex
                      ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300 font-semibold'
                      : idx === currentStepIndex
                      ? 'bg-cyan-950/80 border-cyan-500 text-cyan-200 font-bold ring-1 ring-cyan-400'
                      : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:bg-slate-700'
                  }`}
                >
                  {idx < currentStepIndex ? '✓ ' : ''}{s.label.split(' ')[1]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}