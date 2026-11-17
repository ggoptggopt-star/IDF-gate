'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { UserCheck, Shield, Award, User, RefreshCw, KeyRound, Building2, Settings } from 'lucide-react';
import DemoSettingsModal from './DemoSettingsModal';

export default function DemoRoleSwitcher() {
  const { user, users, switchRole } = useAuth();
  const [showSettingsModal, setShowSettingsModal] = useState(false);

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

  return (
    <>
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

            {/* Link to Database Viewer */}
            <a
              href="/admin/database"
              className="px-2 py-1 rounded text-[11px] font-medium bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 transition-all shrink-0 flex items-center gap-1 border border-emerald-700/60"
              title="เปิดดูตารางฐานข้อมูล SQLite ทั้งหมด"
            >
              <span>🗄️ ดูฐานข้อมูล</span>
            </a>

            {/* Demo Settings Panel Button */}
            <button
              onClick={() => setShowSettingsModal(true)}
              className="px-2 py-1 rounded text-[11px] font-medium bg-blue-900/80 hover:bg-blue-800 text-blue-200 transition-all shrink-0 flex items-center gap-1 border border-blue-700/60"
              title="ตั้งค่าสาธิต / รีเซ็ตข้อมูล / Mock GPS"
            >
              <Settings className="w-3 h-3" />
              <span>⚙️ ตั้งค่า</span>
            </button>
          </div>
        </div>
      </div>

      {/* Settings Modal */}
      <DemoSettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </>
  );
}
