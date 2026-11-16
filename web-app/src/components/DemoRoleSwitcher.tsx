'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { UserCheck, Shield, Award, User, RefreshCw, KeyRound, Building2 } from 'lucide-react';

export default function DemoRoleSwitcher() {
  const { user, users, switchRole } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState('');

  // Key demo personas
  const roles = [
    { label: 'นักศึกษา (อัครชา)', id: 'user-stu-akkaracha', badge: 'ปวส.2', icon: User, color: 'bg-blue-600 text-white' },
    { label: '1.ครูรายวิชา (อรรถเมธ)', id: 'user-t-atthamed', badge: 'ขั้น 1', icon: UserCheck, color: 'bg-emerald-600 text-white' },
    { label: '2.ครูที่ปรึกษา', id: 'user-t-atthamed', badge: 'ขั้น 2', icon: UserCheck, color: 'bg-teal-600 text-white' },
    { label: '3.หัวหน้าแผนก (พัฒนา)', id: 'user-head-pattana', badge: 'ขั้น 3', icon: Building2, color: 'bg-amber-600 text-white' },
    { label: '4.ฝ่ายปกครอง', id: 'user-discipline-01', badge: 'ขั้น 4', icon: Shield, color: 'bg-indigo-600 text-white' },
    { label: '5.รอง ผอ. (ชัยยศ)', id: 'user-deputy-chaiyot', badge: 'ขั้น 5', icon: Award, color: 'bg-purple-600 text-white' },
    { label: 'รปภ. ประตู 1', id: 'user-guard-gate1', badge: 'ประตู', icon: KeyRound, color: 'bg-slate-700 text-white' },
  ];

  const handleReset = async () => {
    if (confirm('คุณต้องการรีเซ็ตข้อมูลสาธิต (4 Demo Scenarios) กลับเป็นค่าเริ่มต้นใช่หรือไม่?')) {
      setIsResetting(true);
      try {
        const res = await fetch('/api/admin/reset-demo', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          setResetMessage('รีเซ็ตข้อมูลสำเร็จ!');
          setTimeout(() => {
            setResetMessage('');
            window.location.reload();
          }, 800);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsResetting(false);
      }
    }
  };

  return (
    <div className="bg-slate-900 text-slate-100 text-xs py-1.5 px-3 border-b border-slate-700 sticky top-0 z-50 shadow-md">
      <div className="flex items-center justify-between gap-2 max-w-lg mx-auto">
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="font-semibold text-slate-300 hidden sm:inline">สลับสิทธิ์สาธิต:</span>
          <span className="font-medium text-emerald-400 bg-emerald-950/80 px-2 py-0.5 rounded border border-emerald-800">
            {user ? `${user.full_name} (${user.role})` : 'ไม่ได้ล็อกอิน'}
          </span>
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          {roles.map((r) => {
            const isActive = user?.id === r.id;
            return (
              <button
                key={r.label}
                onClick={() => switchRole(r.id)}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-all shrink-0 flex items-center gap-1 ${
                  isActive
                    ? `${r.color} ring-2 ring-white/60 font-bold shadow-sm`
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                }`}
                title={r.label}
              >
                <span>{r.badge}</span>
                <span className="hidden md:inline">{r.label}</span>
              </button>
            );
          })}

          <button
            onClick={handleReset}
            disabled={isResetting}
            className="px-2 py-1 rounded text-[11px] font-medium bg-rose-900/80 hover:bg-rose-800 text-rose-200 transition-all shrink-0 flex items-center gap-1 border border-rose-700/60"
            title="รีเซ็ตสถานะคำขอและประวัติสาธิต"
          >
            <RefreshCw className={`w-3 h-3 ${isResetting ? 'animate-spin' : ''}`} />
            <span>รีเซ็ต</span>
          </button>
        </div>
      </div>

      {resetMessage && (
        <div className="text-center text-emerald-300 font-medium py-1 animate-fadeIn">
          {resetMessage}
        </div>
      )}
    </div>
  );
}
