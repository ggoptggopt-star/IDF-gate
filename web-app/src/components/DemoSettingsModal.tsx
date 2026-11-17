'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  RefreshCw,
  MapPin,
  Cpu,
  Sliders,
  CheckCircle2,
  X,
  BookOpen,
  Wifi,
  Volume2,
} from 'lucide-react';

interface DemoSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function DemoSettingsModal({ isOpen, onClose }: DemoSettingsModalProps) {
  const [isResetting, setIsResetting] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // Settings state
  const [mockGpsLocation, setMockGpsLocation] = useState<'real' | 'gate' | 'hospital' | 'far'>('hospital');
  const [esp32Ip, setEsp32Ip] = useState('192.168.1.105');
  const [aiThreshold, setAiThreshold] = useState(85);

  useEffect(() => {
    const savedGps = localStorage.getItem('sgp_mock_gps') as any;
    if (savedGps) setMockGpsLocation(savedGps);
    const savedIp = localStorage.getItem('sgp_esp32_ip');
    if (savedIp) setEsp32Ip(savedIp);
    const savedThresh = localStorage.getItem('sgp_ai_thresh');
    if (savedThresh) setAiThreshold(Number(savedThresh));
  }, []);

  const handleSaveSettings = () => {
    localStorage.setItem('sgp_mock_gps', mockGpsLocation);
    localStorage.setItem('sgp_esp32_ip', esp32Ip);
    localStorage.setItem('sgp_ai_thresh', String(aiThreshold));
    onClose();
  };

  const handleResetDemoData = async () => {
    if (confirm('คุณต้องการรีเซ็ตข้อมูลทั้ง 4 สถานการณ์จำลอง (Scenarios A-D) กลับเป็นค่าเริ่มต้นใช่หรือไม่?')) {
      setIsResetting(true);
      try {
        const res = await fetch('/api/admin/reset-demo', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          setResetSuccess(true);
          setTimeout(() => {
            setResetSuccess(false);
            onClose();
            window.location.reload();
          }, 1000);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsResetting(false);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-sm w-full p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto border border-slate-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0066CC] flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">แผงตั้งค่าสาธิต (Demo Panel)</h3>
              <p className="text-[10px] text-slate-400">ควบคุมระบบสำหรับการทดสอบและนำเสนอ</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Section 1: Reset Demo Data */}
        <div className="bg-rose-50/70 border border-rose-200 rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-rose-900">1. รีเซ็ตข้อมูลสาธิต (Reset Data)</span>
            <span className="text-[10px] bg-rose-200 text-rose-800 font-semibold px-2 py-0.5 rounded-full">
              4 Scenarios
            </span>
          </div>
          <p className="text-[11px] text-rose-700 leading-tight">
            ล้างคำร้องและประวัติทั้งหมด ให้กลับเป็นค่าเริ่มต้นสำหรับพรีเซนต์รอบใหม่
          </p>
          <button
            onClick={handleResetDemoData}
            disabled={isResetting}
            className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.99] text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isResetting ? 'animate-spin' : ''}`} />
            <span>{isResetting ? 'กำลังรีเซ็ตข้อมูล...' : 'รีเซ็ตข้อมูลเริ่มต้น (1-Click Reset)'}</span>
          </button>
          {resetSuccess && (
            <p className="text-center text-[11px] font-bold text-emerald-700 flex items-center justify-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>รีเซ็ตสำเร็จ! กำลังรีเฟรชหน้าจอ...</span>
            </p>
          )}
        </div>

        {/* Section 2: Mock GPS Selector for Presentation */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-xs text-slate-800 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-blue-600" />
              <span>2. จำลองพิกัด GPS (วันพรีเซนต์)</span>
            </span>
            <span className="text-[10px] text-slate-400">Geofencing</span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <button
              onClick={() => setMockGpsLocation('hospital')}
              className={`p-2 rounded-xl text-left border transition-all ${
                mockGpsLocation === 'hospital'
                  ? 'bg-blue-600 text-white font-bold border-blue-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              🏥 รพ.องครักษ์
              <span className="block text-[9px] opacity-80">(เช็คอินตรงจุดหมาย)</span>
            </button>

            <button
              onClick={() => setMockGpsLocation('gate')}
              className={`p-2 rounded-xl text-left border transition-all ${
                mockGpsLocation === 'gate'
                  ? 'bg-blue-600 text-white font-bold border-blue-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              🏫 ป้อมยาม วก.องครักษ์
              <span className="block text-[9px] opacity-80">(รายงานตัวกลับเข้า)</span>
            </button>

            <button
              onClick={() => setMockGpsLocation('far')}
              className={`p-2 rounded-xl text-left border transition-all ${
                mockGpsLocation === 'far'
                  ? 'bg-blue-600 text-white font-bold border-blue-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              🌲 นอกพื้นที่ (ห่างไกล)
              <span className="block text-[9px] opacity-80">(ทดสอบอยู่นอกเขต)</span>
            </button>

            <button
              onClick={() => setMockGpsLocation('real')}
              className={`p-2 rounded-xl text-left border transition-all ${
                mockGpsLocation === 'real'
                  ? 'bg-blue-600 text-white font-bold border-blue-600 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              🛰️ พิกัดจริง (GPS)
              <span className="block text-[9px] opacity-80">(จาก Web Browser)</span>
            </button>
          </div>
        </div>

        {/* Section 3: Hardware & AI Threshold */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-2.5 text-xs">
          <span className="font-bold text-slate-800 flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-emerald-600" />
            <span>3. ตั้งค่าฮาร์ดแวร์ & AI Threshold</span>
          </span>

          <div>
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-600">ค่าความแม่นยำ AI ขั้นต่ำ (Threshold):</span>
              <span className="font-bold text-[#0066CC]">{aiThreshold}%</span>
            </div>
            <input
              type="range"
              min="70"
              max="99"
              value={aiThreshold}
              onChange={(e) => setAiThreshold(Number(e.target.value))}
              className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#0066CC]"
            />
          </div>

          <div>
            <span className="text-[11px] text-slate-600 block mb-1">IP ของบอร์ด ESP32 จริง:</span>
            <input
              type="text"
              value={esp32Ip}
              onChange={(e) => setEsp32Ip(e.target.value)}
              placeholder="เช่น 192.168.1.105"
              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono"
            />
          </div>
        </div>

        {/* Section 4: Course Schedules Overview */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 text-xs space-y-1.5">
          <span className="font-bold text-slate-800 flex items-center gap-1">
            <BookOpen className="w-3.5 h-3.5 text-amber-600" />
            <span>4. ตารางสอนจริงแผนก ทธด. (สายอนุมัติอัตโนมัติ)</span>
          </span>
          <p className="text-[10px] text-slate-500">
            • 31910-1003 การวิเคราะห์ข้อมูล (ปวส.2 พุธเช้า | ครูอรรถเมธ)<br />
            • 31910-2023 บำรุงรักษาคอมฯ (ปวส.2 พฤหัสบ่าย | ครูพัฒนา)<br />
            • 21910-2017 โปรแกรมพกพาเบื้องต้น (ปวช.3 จันทร์เช้า | ครูอรรถเมธ)
          </p>
        </div>

        {/* Save Button */}
        <button
          onClick={handleSaveSettings}
          className="w-full py-2.5 bg-[#0066CC] hover:bg-[#0055B3] text-white font-bold text-xs rounded-xl shadow-sm transition-all"
        >
          บันทึกการตั้งค่า
        </button>
      </div>
    </div>
  );
}
