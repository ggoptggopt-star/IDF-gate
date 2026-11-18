'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { GateExitLog } from '@/types';
import {
  ChevronLeft,
  ScanFace,
  ShieldCheck,
  ShieldAlert,
  Camera,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Radio,
  Zap,
  Volume2,
  Lock,
  Unlock,
  RefreshCw,
  ExternalLink,
  Clock,
  Navigation,
} from 'lucide-react';

export default function GatePage() {
  const router = useRouter();
  const { user } = useAuth();

  // Webcam & AI state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedDirection, setSelectedDirection] = useState<'exit' | 'return'>('exit');
  const [demoScenario, setDemoScenario] = useState<'A' | 'B' | 'D'>('A');

  // Verification result
  const [scanResult, setScanResult] = useState<{
    authorized: boolean;
    message: string;
    studentName?: string;
    requestCode?: string;
    requestId?: string;
    similarityScore?: number;
  } | null>(null);

  // Virtual Gate State
  const [gateState, setGateState] = useState<'closed' | 'opening' | 'open' | 'closing'>('closed');
  const [gateArmAngle, setGateArmAngle] = useState(0); // 0 = closed, 90 = open
  const [ledStatus, setLedStatus] = useState<'red' | 'green'>('red');
  const [relayPulse, setRelayPulse] = useState(false);
  const [lcdLine1, setLcdLine1] = useState('SMART GATE PASS');
  const [lcdLine2, setLcdLine2] = useState('GATE 1: READY');
  const [countdown, setCountdown] = useState<number | null>(null);
  const [ultrasonicDistance, setUltrasonicDistance] = useState(85); // cm

  // Real-time Logs
  const [logs, setLogs] = useState<GateExitLog[]>([]);
  const [esp32Ip, setEsp32Ip] = useState('192.168.1.105');
  const [syncToHardware, setSyncToHardware] = useState(false);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/gate/logs');
      const data = await res.json();
      if (data.success && data.logs) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Camera initialization
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setCameraActive(true);
    } catch (err) {
      console.warn('Webcam not accessible:', err);
      setCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setCameraActive(false);
  };

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  // Trigger Gate Open Sequence
  const triggerGateOpen = (studentName: string, reqCode: string) => {
    // 1. Relay Pulse 0.5s & Green LED
    setRelayPulse(true);
    setLedStatus('green');
    setLcdLine1(`PASS: ${studentName.slice(0, 15)}`);
    setLcdLine2(`${reqCode} [GATE OPEN]`);

    // Hardware HTTP request if enabled
    if (syncToHardware && esp32Ip) {
      fetch(`http://${esp32Ip}/gate/open`, { method: 'POST', mode: 'no-cors' }).catch((e) =>
        console.log('Hardware webhook sent')
      );
    }

    setTimeout(() => {
      setRelayPulse(false);
    }, 500);

    // 2. Animate Gate Arm to 90 degrees
    setGateState('open');
    setGateArmAngle(90);

    // 3. Countdown 4s then close
    setCountdown(4);
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          closeGate();
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const closeGate = () => {
    setGateState('closed');
    setGateArmAngle(0);
    setLedStatus('red');
    setLcdLine1('SMART GATE PASS');
    setLcdLine2('GATE 1: READY');
    setCountdown(null);
  };

  // Perform Face Scan Verification
  const handleVerifyScan = async (scenario = demoScenario) => {
    setIsScanning(true);
    setScanResult(null);

    try {
      const res = await fetch('/api/gate/verify-face', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mock_scenario: scenario,
          direction: selectedDirection,
          similarity_score: scenario === 'A' ? 0.954 : scenario === 'B' ? 0.912 : 0.885,
        }),
      });

      const data = await res.json();

      if (data.success && data.authorized) {
        // Success
        setScanResult({
          authorized: true,
          message: data.message,
          studentName: data.student.full_name,
          requestCode: data.request.request_code,
          requestId: data.request.id,
          similarityScore: Math.round(data.similarity_score * 1000) / 10,
        });

        triggerGateOpen(data.student.full_name, data.request.request_code);
        await fetchLogs();

        // If exit, navigate to Rider Live Trip Mode automatically
        if (selectedDirection === 'exit' && data.request.id) {
          setTimeout(() => {
            router.push(`/trip/${data.request.id}`);
          }, 2400);
        }
      } else {
        // Denied
        setScanResult({
          authorized: false,
          message: data.reason || 'ไม่มีสิทธิ์ออกนอกสถานศึกษา',
          studentName: data.student?.full_name,
          similarityScore: data.similarity_score ? Math.round(data.similarity_score * 1000) / 10 : 88.5,
        });

        // Buzz & LCD Denied
        setLedStatus('red');
        setLcdLine1('ACCESS DENIED');
        setLcdLine2(data.reason ? data.reason.slice(0, 16) : 'UNAUTHORIZED');
        setTimeout(() => {
          setLcdLine1('SMART GATE PASS');
          setLcdLine2('GATE 1: READY');
        }, 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsScanning(false);
    }
  };

  // Guard Emergency Manual Override
  const handleManualOverride = async () => {
    if (confirm('ยืนยันเปิดไม้กั้นฉุกเฉินด้วยคำสั่งเจ้าหน้าที่ รปภ. (Manual Release)?')) {
      try {
        const res = await fetch('/api/gate/logs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            guard_id: user?.id || 'user-guard-gate1',
          }),
        });
        const data = await res.json();
        if (data.success) {
          triggerGateOpen('MANUAL OVERRIDE', '#GUARD-RELEASE');
          await fetchLogs();
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="p-4 space-y-4 max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <Link href="/" className="p-1 -ml-1 text-slate-700 hover:text-slate-900">
            <ChevronLeft className="w-6 h-6" />
          </Link>
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-tight">
              จุดสแกนใบหน้า & ไม้กั้นอัตโนมัติ
            </h1>
            <p className="text-[11px] text-slate-500">ป้อมยามประตู 1 • วิทยาลัยการอาชีพองครักษ์</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-full border border-emerald-200 text-xs font-bold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>AI Online</span>
        </div>
      </div>

      {/* Direction & Scenario Selector (Demo Toolbar) */}
      <div className="bg-slate-900 text-white rounded-2xl p-3 shadow-sm border border-slate-800 text-xs space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-slate-300">ทิศทางการผ่าน:</span>
          <div className="bg-slate-800 p-0.5 rounded-xl flex gap-1">
            <button
              onClick={() => setSelectedDirection('exit')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                selectedDirection === 'exit' ? 'bg-blue-600 text-white' : 'text-slate-400'
              }`}
            >
              ขาออก (Exit)
            </button>
            <button
              onClick={() => setSelectedDirection('return')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-all ${
                selectedDirection === 'return' ? 'bg-emerald-600 text-white' : 'text-slate-400'
              }`}
            >
              ขากลับ (Return)
            </button>
          </div>
        </div>

        {/* Demo Persona Quick Selectors */}
        <div>
          <span className="text-[10px] text-slate-400 block mb-1">เลือกสถานการณ์จำลองสำหรับสาธิต:</span>
          <div className="grid grid-cols-3 gap-1.5 text-[11px]">
            <button
              onClick={() => {
                setDemoScenario('A');
                handleVerifyScan('A');
              }}
              className={`py-1.5 px-2 rounded-xl font-bold truncate transition-all ${
                demoScenario === 'A'
                  ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              title="Scenario A: นายอัครชา อนุมัติครบ 5 ขั้นแล้ว"
            >
              🟢 อัครชา (ผ่าน ✓)
            </button>

            <button
              onClick={() => {
                setDemoScenario('B');
                handleVerifyScan('B');
              }}
              className={`py-1.5 px-2 rounded-xl font-bold truncate transition-all ${
                demoScenario === 'B'
                  ? 'bg-amber-600 text-white ring-2 ring-amber-400'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              title="Scenario B: นายนัฐพล รอขั้น 5 รอง ผอ."
            >
              🟡 นัฐพล (รอขั้น 5)
            </button>

            <button
              onClick={() => {
                setDemoScenario('D');
                handleVerifyScan('D');
              }}
              className={`py-1.5 px-2 rounded-xl font-bold truncate transition-all ${
                demoScenario === 'D'
                  ? 'bg-rose-700 text-white ring-2 ring-rose-400'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              title="Scenario D: นายสมชาย ไม่อนุมัติ"
            >
              🔴 สมชาย (ไม่อนุมัติ)
            </button>
          </div>
        </div>
      </div>

      {/* Part 1: Live Webcam Viewfinder & Target */}
      <div className="bg-slate-900 rounded-3xl p-3 border border-slate-800 shadow-md relative overflow-hidden">
        <div className="aspect-video bg-black rounded-2xl overflow-hidden relative flex items-center justify-center">
          {cameraActive ? (
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
          ) : (
            <div className="text-center text-slate-500 text-xs p-4 flex flex-col items-center">
              <Camera className="w-8 h-8 mb-2 opacity-50" />
              <span>ไม่พบกล้องเว็บแคม (ระบบจำลองภาพพร้อมสแกน)</span>
            </div>
          )}

          {/* Holographic Face Frame Target */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div
              className={`w-36 h-48 rounded-[40px] border-2 border-dashed transition-all duration-300 flex items-center justify-center ${
                gateState === 'open'
                  ? 'border-emerald-400 bg-emerald-500/10 scale-105'
                  : isScanning
                  ? 'border-cyan-400 animate-pulse'
                  : scanResult?.authorized === false
                  ? 'border-rose-500 bg-rose-500/10'
                  : 'border-blue-400/80'
              }`}
            >
              <div className="w-4 h-4 border-t-2 border-l-2 border-white absolute top-4 left-4"></div>
              <div className="w-4 h-4 border-t-2 border-r-2 border-white absolute top-4 right-4"></div>
              <div className="w-4 h-4 border-b-2 border-l-2 border-white absolute bottom-4 left-4"></div>
              <div className="w-4 h-4 border-b-2 border-r-2 border-white absolute bottom-4 right-4"></div>

              {isScanning && (
                <div className="absolute inset-x-0 h-0.5 bg-cyan-400 shadow-[0_0_15px_#22d3ee] animate-bounce"></div>
              )}
            </div>
          </div>

          {/* Live Floating Tag */}
          <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-mono flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping"></span>
            <span>LIVE 30 FPS</span>
          </div>

          {/* Result Alert Pill */}
          {scanResult && (
            <div
              className={`absolute bottom-2 inset-x-3 p-2.5 rounded-xl text-xs font-bold text-center backdrop-blur-md shadow-lg flex items-center justify-center gap-2 ${
                scanResult.authorized
                  ? 'bg-emerald-900/90 text-emerald-200 border border-emerald-500'
                  : 'bg-rose-950/90 text-rose-200 border border-rose-500'
              }`}
            >
              {scanResult.authorized ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <XCircle className="w-4 h-4 text-rose-400" />
              )}
              <span>{scanResult.message}</span>
              {scanResult.similarityScore && (
                <span className="text-[10px] opacity-80 font-mono">({scanResult.similarityScore}%)</span>
              )}
            </div>
          )}
        </div>

        {/* Rider Live Trip Mode Link if authorized for exit */}
        {scanResult?.authorized && scanResult.requestId && selectedDirection === 'exit' && (
          <div className="mt-2.5 p-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg flex items-center justify-between animate-fadeIn">
            <div className="flex items-center gap-2">
              <Navigation className="w-5 h-5 animate-pulse text-emerald-200" />
              <div className="text-left">
                <div className="font-bold text-xs">สแกนผ่านเรียบร้อย!</div>
                <div className="text-[10px] text-emerald-100">กำลังพาเข้าหน้า Rider Trip Mode ใน 2 วินาที...</div>
              </div>
            </div>
            <Link
              href={`/trip/${scanResult.requestId}`}
              className="px-3 py-1.5 rounded-xl bg-white text-emerald-800 font-bold text-xs shadow-sm hover:bg-emerald-50 active:scale-95 transition-all flex items-center gap-1 shrink-0"
            >
              <span>เปิดทันที</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}

        {/* Scan Action Button */}
        <div className="mt-3">
          <button
            onClick={() => handleVerifyScan()}
            disabled={isScanning}
            className="w-full py-3 bg-[#0077D7] hover:bg-[#0066CC] active:scale-[0.99] text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-md transition-all"
          >
            <ScanFace className="w-4 h-4" />
            <span>{isScanning ? 'กำลังวิเคราะห์ใบหน้า...' : 'กดสแกนใบหน้าตรวจสิทธิ์ (Scan Face)'}</span>
          </button>
        </div>
      </div>

      {/* Part 2: Interactive Virtual Gate Simulator */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-[#0066CC]" />
            <h3 className="text-xs font-bold text-slate-800">
              Interactive Virtual Barrier Gate (จำลองไม้กั้น)
            </h3>
          </div>
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
              gateState === 'open'
                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 animate-pulse'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {gateState === 'open' ? '🟢 ไม้กั้นเปิด (90°)' : '🔴 ไม้กั้นปิด (0°)'}
          </span>
        </div>

        {/* Gate Canvas Animation */}
        <div className="h-44 bg-gradient-to-b from-slate-100 to-slate-200 rounded-2xl relative overflow-hidden border border-slate-300/80 flex items-end justify-center pb-3">
          {/* Street Road Surface */}
          <div className="absolute inset-x-0 bottom-0 h-10 bg-slate-800 border-t-2 border-dashed border-amber-400/80"></div>

          {/* Barrier Housing Post (Base Cabinet) */}
          <div className="relative z-10 flex items-end">
            <div className="w-14 h-28 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 rounded-t-xl shadow-lg border-2 border-amber-700 flex flex-col items-center justify-between p-1.5 relative">
              {/* Traffic LED indicator on cabinet */}
              <div className="w-4 h-9 bg-slate-900 rounded-md p-1 flex flex-col items-center justify-between">
                <span
                  className={`w-2 h-2 rounded-full transition-all ${
                    ledStatus === 'red' ? 'bg-rose-500 shadow-[0_0_8px_#f43f5e]' : 'bg-rose-950'
                  }`}
                ></span>
                <span
                  className={`w-2 h-2 rounded-full transition-all ${
                    ledStatus === 'green' ? 'bg-emerald-400 shadow-[0_0_8px_#10b981]' : 'bg-emerald-950'
                  }`}
                ></span>
              </div>

              {/* TowerPro SG90 Servo Pivot point */}
              <div className="w-6 h-6 rounded-full bg-slate-800 border-2 border-white flex items-center justify-center relative">
                <div className="w-2 h-2 rounded-full bg-amber-400"></div>

                {/* Barrier Arm (Boom Pole) with Red/White Stripes */}
                <div
                  style={{
                    transformOrigin: '0% 50%',
                    transform: `rotate(-${gateArmAngle}deg)`,
                    transition: 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  }}
                  className="absolute left-3 w-48 h-3.5 rounded-r-md border border-slate-700 shadow-md flex overflow-hidden z-20"
                >
                  {/* Stripes */}
                  <div className="w-8 h-full bg-rose-600"></div>
                  <div className="w-8 h-full bg-white"></div>
                  <div className="w-8 h-full bg-rose-600"></div>
                  <div className="w-8 h-full bg-white"></div>
                  <div className="w-8 h-full bg-rose-600"></div>
                  <div className="w-8 h-full bg-white"></div>
                </div>
              </div>

              <span className="text-[8px] font-mono font-bold text-amber-950 tracking-tighter">OICEC</span>
            </div>
          </div>

          {/* Safety Distance Sensor Indicator */}
          <div className="absolute right-4 bottom-12 bg-white/90 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-slate-300 text-[10px] font-mono text-slate-700 shadow-xs">
            <span className="text-slate-400 block text-[9px]">HC-SR04 SENSOR:</span>
            <span className="font-bold text-emerald-600">{ultrasonicDistance} cm (ปลอดภัย)</span>
          </div>

          {/* Countdown Toast */}
          {countdown !== null && (
            <div className="absolute top-3 inset-x-0 mx-auto w-max px-3 py-1 bg-slate-900/90 text-white rounded-full text-xs font-bold border border-slate-700 shadow-lg animate-pulse flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>ไม้กั้นจะปิดลงอัตโนมัติใน {countdown} วินาที...</span>
            </div>
          )}
        </div>

        {/* LCD 16x2 Display Simulation (Green Backlight) */}
        <div className="bg-[#1a3821] text-[#7bfd9a] p-3 rounded-2xl font-mono text-xs border-2 border-[#122818] shadow-inner space-y-1">
          <div className="flex justify-between text-[10px] text-[#4f9c64] border-b border-[#24522e] pb-0.5">
            <span>LCD 1602A (I2C 0x27)</span>
            <span>ESP32 DEV-V1</span>
          </div>
          <p className="tracking-widest font-bold truncate">{lcdLine1.padEnd(16, ' ')}</p>
          <p className="tracking-widest font-bold truncate">{lcdLine2.padEnd(16, ' ')}</p>
        </div>

        {/* Relay Pulse & Hardware Link Status */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <span className="text-slate-600 flex items-center gap-1">
              <Zap className={`w-3.5 h-3.5 ${relayPulse ? 'text-amber-500 fill-amber-500' : 'text-slate-400'}`} />
              <span>Relay Pulse:</span>
            </span>
            <span className={`font-bold ${relayPulse ? 'text-amber-600' : 'text-slate-400'}`}>
              {relayPulse ? 'ACTIVE (0.5s)' : 'STANDBY'}
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
            <span className="text-slate-600 flex items-center gap-1">
              <Volume2 className="w-3.5 h-3.5 text-slate-400" />
              <span>Piezo Buzzer:</span>
            </span>
            <span className="font-bold text-slate-700">
              {gateState === 'open' ? 'BEEP 1x' : scanResult?.authorized === false ? 'ALARM 3x' : 'QUIET'}
            </span>
          </div>
        </div>

        {/* ESP32 Hardware Integration Box */}
        <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-700">การเชื่อมต่อบอร์ด ESP32 จริง:</span>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={syncToHardware}
                onChange={(e) => setSyncToHardware(e.target.checked)}
                className="w-3.5 h-3.5 text-blue-600 rounded"
              />
              <span className="text-[11px] text-slate-600 font-medium">ส่งคำสั่ง HTTP ไปยังบอร์ด</span>
            </label>
          </div>

          {syncToHardware && (
            <div className="flex gap-2">
              <input
                type="text"
                value={esp32Ip}
                onChange={(e) => setEsp32Ip(e.target.value)}
                placeholder="IP บอร์ด ESP32 เช่น 192.168.1.105"
                className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono"
              />
              <button
                onClick={() => alert(`ทดสอบ Ping ไปยัง http://${esp32Ip}/gate/open`)}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-semibold"
              >
                Ping
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Part 3: Guard Control Panel & Real-time Logs */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-800">แผงควบคุมเจ้าหน้าที่ รปภ. (Guard Panel)</h3>
          <span className="text-[10px] text-slate-400">ป้อมยาม 1 วก.องครักษ์</span>
        </div>

        {/* Emergency Manual Release Button */}
        <button
          onClick={handleManualOverride}
          className="w-full py-3 bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-bold text-xs rounded-2xl flex items-center justify-center gap-2 shadow-sm transition-all"
        >
          <Unlock className="w-4 h-4" />
          <span>🚨 เปิดไม้กั้นฉุกเฉิน (Emergency Manual Release)</span>
        </button>

        {/* Real-time Exit Logs Table */}
        <div className="pt-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-slate-700">ประวัติการผ่านไม้กั้น Real-time (Audit Trail):</span>
            <button
              onClick={fetchLogs}
              className="text-[11px] text-[#0066CC] font-semibold flex items-center gap-1 hover:underline"
            >
              <RefreshCw className="w-3 h-3" />
              <span>รีเฟรช</span>
            </button>
          </div>

          <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
            {logs.length === 0 ? (
              <p className="text-center text-slate-400 text-xs py-3">ยังไม่มีประวัติการสแกน</p>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-800">
                      {log.student_name || (log.trigger_type === 'guard_manual' ? 'คำสั่งเจ้าหน้าที่ รปภ.' : 'ไม่ระบุนาม')}
                    </span>
                    <p className="text-[10px] text-slate-400">
                      {log.gate_opened_at} • {log.direction === 'exit' ? 'ขาออก' : 'ขากลับ'} •{' '}
                      {log.trigger_type === 'ai_auto' ? 'AI Auto' : 'Manual'}
                    </p>
                  </div>

                  <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-full">
                    เปิดสำเร็จ ✓
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
