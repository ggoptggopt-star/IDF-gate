'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { LeaveRequest } from '@/types';
import {
  ScanFace,
  ShieldCheck,
  Stethoscope,
  Briefcase,
  FolderKanban,
  Home,
  CheckCircle2,
  Clock,
  ArrowRight,
  MapPin,
  Check,
} from 'lucide-react';

export default function HomePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Active pass is the most recent approved request
  const activePass = requests.find((r) => r.overall_status === 'approved');

  useEffect(() => {
    async function loadRequests() {
      try {
        const studentId = user?.id || 'user-stu-akkaracha';
        const res = await fetch(`/api/requests?student_id=${studentId}`);
        const data = await res.json();
        if (data.success && data.requests) {
          setRequests(data.requests);
        }
      } catch (err) {
        console.error('Failed to load requests:', err);
      } finally {
        setLoading(false);
      }
    }

    loadRequests();
  }, [user]);

  // If user is a teacher/approver, show quick redirect button to Approver Dashboard
  const isApprover = user && ['subject_teacher', 'advisor', 'dept_head', 'discipline', 'deputy_director', 'guard', 'admin'].includes(user.role);

  // Student initials for avatar
  const getInitials = (name?: string) => {
    if (!name) return 'นศ';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return parts[0].charAt(0) + parts[1].charAt(0);
    }
    return name.slice(0, 2);
  };

  return (
    <div className="p-4 space-y-4">
      {/* Header Profile Section */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-0.5">
            <span className="w-2 h-2 rounded-full bg-[#10B981]"></span>
            <span>วิทยาลัยการอาชีพองครักษ์</span>
          </div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {user?.full_name || 'นายอัครชา เปมะวิภาต'}
          </h2>
          <p className="text-xs text-slate-500">
            รหัส {user?.username || '6731901001'} • {user?.group_code || 'ปวส.2/1'}{' '}
            {user?.department_name || 'เทคโนโลยีธุรกิจดิจิทัล'}
          </p>
        </div>

        {/* Profile Circle with Initials and Check Badge */}
        <Link href="/profile" className="relative group">
          <div className="w-13 h-13 rounded-full bg-slate-200 border-2 border-[#0066CC] flex items-center justify-center font-bold text-slate-700 text-sm shadow-sm transition-transform group-hover:scale-105">
            {getInitials(user?.full_name)}
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#10B981] text-white flex items-center justify-center border-2 border-white">
            <Check className="w-2.5 h-2.5 stroke-[3]" />
          </div>
        </Link>
      </div>

      {/* Approver Role Notice Banner */}
      {isApprover && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-between text-xs text-indigo-900">
          <div>
            <span className="font-bold">บทบาทปัจจุบัน: {user?.full_name} ({user?.role})</span>
            <p className="text-[11px] text-indigo-700">คุณมีสิทธิ์อนุมัติคำร้องในขั้นตอนของตนเอง</p>
          </div>
          <Link
            href="/chat"
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl text-xs flex items-center gap-1 shrink-0"
          >
            <span>ดูคำร้อง</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* ACTIVE PASS Card (Screen 2 Hero Card) */}
      {activePass ? (
        <div className="bg-gradient-to-br from-[#0066CC] via-[#0055B3] to-[#0A4791] rounded-3xl p-5 text-white shadow-lg shadow-blue-900/15 relative overflow-hidden">
          {/* Subtle Background Pattern */}
          <div className="absolute -right-8 -bottom-8 w-40 h-40 bg-white/5 rounded-full blur-xl pointer-events-none"></div>

          {/* Top Pill & Request Code */}
          <div className="flex items-center justify-between mb-3 text-xs">
            <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-white font-medium border border-white/20">
              <span className="w-2 h-2 rounded-full bg-cyan-300 animate-pulse"></span>
              <span>ใบอนุญาตมีผลใช้งาน (ACTIVE PASS)</span>
            </div>
            <span className="font-mono text-white/90 text-[11px] font-semibold">{activePass.request_code}</span>
          </div>

          {/* Main Title & Details */}
          <h3 className="text-lg font-bold tracking-tight mb-1">
            อนุญาตออกนอกวิทยาลัยชั่วคราว
          </h3>
          <p className="text-xs text-blue-100 leading-relaxed mb-4">
            เหตุผล: {activePass.reason} • เวลา {activePass.allowed_start_time} - {activePass.allowed_end_time} น.
            {activePass.destination_name && (
              <span className="block text-cyan-200 text-[11px] mt-0.5">
                📍 ปลายทาง: {activePass.destination_name}
              </span>
            )}
          </p>

          <div className="border-t border-white/15 pt-3 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-blue-200">
                อนุมัติโดย: ครูอรรถเมธ (ที่ปรึกษา) & รอง ผอ.
              </p>
              <p className="text-xs font-semibold text-emerald-300 flex items-center gap-1 mt-0.5">
                <span>สถานะไม้กั้น:</span>
                <span>พร้อมสแกนใบหน้า</span>
              </p>
            </div>

            <Link
              href="/gate"
              className="bg-white text-[#0066CC] hover:bg-blue-50 px-3.5 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
            >
              <ScanFace className="w-4 h-4 text-[#0066CC]" />
              <span>สแกนเปิดไม้กั้น</span>
            </Link>
          </div>
        </div>
      ) : (
        /* Empty Pass State */
        <div className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm text-center">
          <div className="w-12 h-12 bg-blue-50 text-[#0066CC] rounded-full flex items-center justify-center mx-auto mb-2">
            <Clock className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-slate-800 text-sm">ยังไม่มีบัตรผ่านที่ได้รับอนุมัติในเวลานี้</h3>
          <p className="text-xs text-slate-500 mt-1 mb-3">คุณสามารถยื่นขออนุญาตด่วนผ่านแชท AI ด้านล่างนี้ได้เลย</p>
          <Link
            href="/chat"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#0066CC] text-white text-xs font-semibold rounded-xl"
          >
            <span>ยื่นคำร้องผ่านแชท AI</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Gate 1 AI Status Banner */}
      <div className="bg-white rounded-3xl p-4 border border-slate-100 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800">
              ป้อมยามประตู 1 (กล้อง AI ออนไลน์)
            </h4>
            <p className="text-[11px] text-slate-400">
              ระบบจดจำใบหน้าเชื่อมกับชุดควบคุมไม้กั้น
            </p>
          </div>
        </div>
        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-full">
          พร้อมเปิด
        </span>
      </div>

      {/* Quick Action Grid (4 Categories matching Screen 2) */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <h3 className="text-xs font-bold text-slate-800 tracking-tight">
            แจ้งขออนุญาตด่วนผ่านแชท AI
          </h3>
          <Link href="/chat" className="text-[11px] text-[#0066CC] font-semibold hover:underline">
            คลิกเพื่อส่งคำขอ
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* 1. พบแพทย์ / ป่วย */}
          <Link
            href="/chat?category=medical"
            className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm hover:border-blue-200 transition-all flex flex-col justify-between h-24"
          >
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0066CC] flex items-center justify-center">
              <Stethoscope className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">พบแพทย์ / ป่วย</p>
              <p className="text-[10px] text-slate-400 leading-tight">แนบใบนัดหรือแจ้งอาการ</p>
            </div>
          </Link>

          {/* 2. ธุระส่วนตัวจำเป็น */}
          <Link
            href="/chat?category=personal"
            className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm hover:border-blue-200 transition-all flex flex-col justify-between h-24"
          >
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Briefcase className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">ธุระส่วนตัวจำเป็น</p>
              <p className="text-[10px] text-slate-400 leading-tight">ผู้ปกครองรับรองผ่านแชท</p>
            </div>
          </Link>

          {/* 3. ธุระแผนกวิชา */}
          <Link
            href="/chat?category=department"
            className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm hover:border-blue-200 transition-all flex flex-col justify-between h-24"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <FolderKanban className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">ธุระแผนกวิชา</p>
              <p className="text-[10px] text-slate-400 leading-tight">ครูประจำวิชาอนุมัติ</p>
            </div>
          </Link>

          {/* 4. ผู้ปกครองมารับ */}
          <Link
            href="/chat?category=parent_pickup"
            className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm hover:border-blue-200 transition-all flex flex-col justify-between h-24"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Home className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-800">ผู้ปกครองมารับ</p>
              <p className="text-[10px] text-slate-400 leading-tight">ยืนยันเบอร์ผู้ปกครอง</p>
            </div>
          </Link>
        </div>
      </div>

      {/* History Section (Screen 2 History List) */}
      <div>
        <div className="flex items-center justify-between mb-2 px-1">
          <h3 className="text-xs font-bold text-slate-800 tracking-tight">
            ประวัติการขออนุญาตและผ่านไม้กั้น
          </h3>
          <span className="text-[11px] text-slate-400">ภาคเรียนที่ 2/2569</span>
        </div>

        <div className="space-y-2.5">
          {requests.map((r) => {
            const isApproved = r.overall_status === 'approved';
            const isCompleted = r.overall_status === 'completed_exit' || r.overall_status === 'returned';
            const isRejected = r.overall_status === 'rejected';

            return (
              <div
                key={r.id}
                className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-sm flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      isApproved
                        ? 'bg-blue-600 text-white'
                        : isCompleted
                        ? 'bg-slate-100 text-slate-500'
                        : isRejected
                        ? 'bg-rose-50 text-rose-500'
                        : 'bg-amber-50 text-amber-600'
                    }`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <ScanFace className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-800 leading-tight">
                      {r.reason}
                    </h5>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {r.request_code} • {r.leave_date} ({r.allowed_start_time} - {r.allowed_end_time} น.)
                    </p>
                    {r.destination_name && (
                      <p className="text-[10px] text-slate-500 flex items-center gap-0.5 mt-0.5">
                        <MapPin className="w-2.5 h-2.5 text-blue-500" />
                        <span>{r.destination_name}</span>
                        {r.checkin_verified ? (
                          <span className="text-emerald-600 font-semibold">(เช็คอินแล้ว ✓)</span>
                        ) : null}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  {isApproved && (
                    <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold rounded-full">
                      อนุมัติแล้ว
                    </span>
                  )}
                  {isCompleted && (
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-[11px] font-medium rounded-full">
                      สำเร็จ
                    </span>
                  )}
                  {isRejected && (
                    <span className="px-2.5 py-1 bg-rose-50 text-rose-600 border border-rose-200 text-[11px] font-bold rounded-full">
                      ไม่อนุมัติ
                    </span>
                  )}
                  {r.overall_status === 'pending' && (
                    <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-[11px] font-bold rounded-full">
                      ขั้นที่ {r.current_step}/5
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
