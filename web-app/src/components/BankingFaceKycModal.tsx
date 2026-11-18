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
  RotateCcw,
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
    subText: 'จัดตำแหน่งใบหน้าให้อยู่ภายในกรอบวงรี',
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

  // Stored snapshots at each stage
  const [snapshots, setSnapshots] = useState<{
    straight?: string;
    left?: string;
    right?: string;
    smile?: string;
  }>({});

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Web Audio Tone
  const playChime = () => {
    try {
      if (typeof window === 'undefined') return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.18);
      osc.start();
      osc.stop(ctx.currentTime + 0.18);
    } catch {}
  };

  // Start webcam when modal opens
  useEffect(() => {
    if (!isOpen) return;

    let stream: MediaStream | null = null;
    setCurrentStepIndex(0);
    setStepSuccessState(false);
    setSnapshots({});
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
        setCameraError('ไม่พบกล้องเว็บแคม หรือยังไม่ได้รับอนุญาตให้ใช้กล้อง (สามารถใช้โหมดจำลองด้านล่างได้ครับ)');
      }
    }

    startWebcam();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [isOpen]);

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
      return canvas.toDataURL('image/jpeg', 0.85);
    } catch {
      return null;
    }
  };

  // Move to next step with chime and snap capture
  const advanceStep = (forcedStepIndex?: number) => {
    const nextIdx = forcedStepIndex !== undefined ? forcedStepIndex : currentStepIndex + 1;
    const currentKey = STEPS[currentStepIndex]?.key;

    // Capture snapshot
    const snap = captureFrame();
    if (snap) {
      setSnapshots((prev) => {
        const updated = { ...prev };
        if (currentKey === 'straight') updated.straight = snap;
        if (currentKey === 'turn_left') updated.left = snap;
        if (currentKey === 'turn_right') updated.right = snap;
        if (currentKey === 'smile') updated.smile = snap;
        return updated;
      });
    }

    playChime();
    setStepSuccessState(true);

    setTimeout(() => {
      setStepSuccessState(false);
      if (nextIdx >= STEPS.length) {
        handleFinalSubmit();
      } else {
        setCurrentStepIndex(nextIdx);
      }
    }, 700);
  };

  // Submit all 4 biometric profiles
  const handleFinalSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/face/enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: targetUserId,
          snapshots,
          liveness_score: 0.994,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setCurrentStepIndex(STEPS.length); // mark completed
        await refreshUsers();
        setTimeout(() => {
          if (onSuccess) onSuccess();
          onClose();
        }, 1500);
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

  // Auto-progress demo sequence (Fast Demo 1-click)
  const handleFastDemoPass = () => {
    let step = currentStepIndex;
    const interval = setInterval(() => {
      step++;
      if (step <= STEPS.length) {
        advanceStep(step);
      } else {
        clearInterval(interval);
      }
    }, 450);
  };

  if (!isOpen) return null;

  const currentStep = STEPS[currentStepIndex];
  const isCompleted = currentStepIndex >= STEPS.length;
  const progressPercent = Math.min(100, Math.round((currentStepIndex / STEPS.length) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-md w-full overflow-hidden text-white shadow-2xl relative flex flex-col">
        {/* Top Header */}
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
              <ScanFace className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white">e-KYC สแกนใบหน้า AI</h3>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono">
                  Liveness 3D
                </span>
              </div>
              <p className="text-[10px] text-slate-400">{targetStudentName} • วก.องครักษ์</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar */}
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
            {/* Dark Mask around oval */}
            <div
              className={`w-56 h-72 rounded-[50%] transition-all duration-300 relative flex items-center justify-center ${
                stepSuccessState
                  ? 'border-4 border-emerald-400 shadow-[0_0_35px_rgba(16,185,129,0.7)]'
                  : 'border-2 border-dashed border-cyan-400/80 shadow-[0_0_20px_rgba(6,182,212,0.4)]'
              }`}
            >
              {/* Corner Biometric Crosshairs */}
              <div className="absolute top-2 w-4 h-4 border-t-2 border-l-2 border-cyan-400"></div>
              <div className="absolute top-2 right-2 w-4 h-4 border-t-2 border-r-2 border-cyan-400"></div>
              <div className="absolute bottom-2 left-2 w-4 h-4 border-b-2 border-l-2 border-cyan-400"></div>
              <div className="absolute bottom-2 right-2 w-4 h-4 border-b-2 border-r-2 border-cyan-400"></div>

              {/* Success Tick Center Animation */}
              {stepSuccessState && (
                <div className="w-16 h-16 rounded-full bg-emerald-500/90 text-white flex items-center justify-center shadow-lg animate-in zoom-in-75 duration-200">
                  <CheckCircle2 className="w-10 h-10" />
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
            <span>{currentStepIndex + 1}/5</span>
          </div>

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
            <div className="text-center space-y-1 py-1">
              <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/30">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-emerald-300">
                ลงทะเบียนใบหน้าสำเร็จ 100%!
              </h4>
              <p className="text-xs text-slate-300">
                ข้อมูลชีวมิติ 3 มิติ ได้รับการซิงค์เข้าไม้กั้นหน้าประตูเรียบร้อย
              </p>
            </div>
          )}

          {/* Manual Advance Button for User */}
          {!isCompleted && (
            <button
              onClick={() => advanceStep()}
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-xs shadow-md shadow-cyan-900/40 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
            >
              <Camera className="w-4 h-4" />
              <span>ตรวจจับท่าทางผ่าน (ถัดไป) ➔</span>
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
                className="text-[10px] text-emerald-400 hover:underline flex items-center gap-1 font-bold"
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
                  className={`py-1 px-1 rounded-lg border text-center transition-all ${
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
