'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { LeaveRequest } from '@/types';
import {
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  ExternalLink,
  Shield,
  UserCheck,
  Building2,
  Award,
  AlertCircle,
  FileText,
  User,
  ArrowRight,
  Eye,
  X,
  Navigation,
} from 'lucide-react';

export default function ApproverDashboard() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [activeTab, setActiveTab] = useState<'pending' | 'approved' | 'all'>('pending');
  const [remarks, setRemarks] = useState<{ [id: string]: string }>({});
  const [loading, setLoading] = useState(true);
  const [actionSuccessMsg, setActionSuccessMsg] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const fetchRequests = async () => {
    try {
      const res = await fetch('/api/requests');
      const data = await res.json();
      if (data.success && data.requests) {
        setRequests(data.requests);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [user]);

  // Determine current user's step authority
  const getApproverStep = (role?: string): number => {
    switch (role) {
      case 'subject_teacher': return 1;
      case 'advisor': return 2;
      case 'dept_head': return 3;
      case 'discipline': return 4;
      case 'deputy_director': return 5;
      default: return 0; // Admin or student
    }
  };

  const userStep = getApproverStep(user?.role);
  const isAdmin = user?.role === 'admin';

  // Filter requests
  const pendingRequests = requests.filter((r) => {
    if (r.overall_status === 'rejected' || r.overall_status === 'completed_exit') return false;
    if (isAdmin) return r.overall_status === 'pending';
    if (userStep > 0) {
      return r.current_step === userStep && r.overall_status === 'pending';
    }
    return r.overall_status === 'pending';
  });

  const approvedRequests = requests.filter((r) => r.overall_status === 'approved' || r.overall_status === 'completed_exit');

  const displayedRequests =
    activeTab === 'pending'
      ? pendingRequests
      : activeTab === 'approved'
      ? approvedRequests
      : requests;

  const handleAction = async (id: string, action: 'approve' | 'reject') => {
    try {
      const remark = remarks[id] || (action === 'approve' ? 'อนุมัติเรียบร้อย' : 'ไม่อนุมัติตามระเบียบ');
      const res = await fetch(`/api/requests/${id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          remark,
          approver_id: user?.id,
          approver_role: user?.role,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccessMsg(data.message);
        setTimeout(() => setActionSuccessMsg(''), 3000);
        await fetchRequests();
      } else {
        alert(data.error);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getStepIcon = (step: number) => {
    switch (step) {
      case 1: return UserCheck;
      case 2: return UserCheck;
      case 3: return Building2;
      case 4: return Shield;
      case 5: return Award;
      default: return User;
    }
  };

  return (
    <div className="space-y-4">
      {/* Lightbox Image Preview Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-lg w-full bg-white rounded-3xl p-4 shadow-2xl">
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-slate-700 shadow-md"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="rounded-2xl overflow-hidden border border-slate-200">
              <img
                src={selectedImage}
                alt="เอกสารหลักฐานแนบ"
                className="w-full h-auto max-h-[75vh] object-contain bg-slate-100"
              />
            </div>
            <div className="mt-2.5 text-center">
              <span className="text-xs font-bold text-slate-800">เอกสารหลักฐานประกอบการพิจารณา (ใบนัดแพทย์ / แชทผู้ปกครอง)</span>
              <p className="text-[11px] text-slate-500">ตรวจสอบโดยคณะกรรมการและผู้อนุมัติ วก.องครักษ์</p>
            </div>
          </div>
        </div>
      )}
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-5 shadow-sm border border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-400 bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-800">
              5-Tier Approver Workflow
            </span>
            <h2 className="text-base font-bold text-white mt-1">
              {userStep === 1 && 'ขั้นที่ 1: ตรวจสอบและลงนามครูรายวิชา'}
              {userStep === 2 && 'ขั้นที่ 2: ตรวจสอบและลงนามครูที่ปรึกษา'}
              {userStep === 3 && 'ขั้นที่ 3: กลั่นกรองระดับหัวหน้าแผนกวิชา ทธด.'}
              {userStep === 4 && 'ขั้นที่ 4: ตรวจสอบระเบียบวินัย งานปกครอง'}
              {userStep === 5 && 'ขั้นที่ 5: พิจารณาอนุมัติขั้นสุดท้าย (รอง ผอ.)'}
              {userStep === 0 && 'แผงควบคุมการอนุมัติ 5 ขั้นตอน (โหมดทดสอบ/สาธิต)'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              ผู้อนุมัติ: <span className="text-slate-200 font-semibold">{user?.full_name}</span>
            </p>
          </div>

          <div className="w-11 h-11 rounded-2xl bg-white/10 flex items-center justify-center text-emerald-400 shrink-0">
            {React.createElement(getStepIcon(userStep || 1), { className: 'w-6 h-6' })}
          </div>
        </div>
      </div>

      {actionSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-300 text-emerald-800 rounded-2xl text-xs font-semibold flex items-center gap-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-slate-100 p-1 rounded-2xl grid grid-cols-3 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('pending')}
          className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'pending'
              ? 'bg-white text-[#0066CC] shadow-sm font-bold'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <span>รออนุมัติ</span>
          {pendingRequests.length > 0 && (
            <span className="w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center">
              {pendingRequests.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('approved')}
          className={`py-2 rounded-xl transition-all ${
            activeTab === 'approved'
              ? 'bg-white text-[#0066CC] shadow-sm font-bold'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          อนุมัติแล้ว ({approvedRequests.length})
        </button>
        <button
          onClick={() => setActiveTab('all')}
          className={`py-2 rounded-xl transition-all ${
            activeTab === 'all'
              ? 'bg-white text-[#0066CC] shadow-sm font-bold'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          ทั้งหมด ({requests.length})
        </button>
      </div>

      {/* Request Cards List */}
      <div className="space-y-4">
        {displayedRequests.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 border border-slate-100 text-center text-slate-400">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-xs">ไม่มีรายการคำร้องในหมวดนี้</p>
          </div>
        ) : (
          displayedRequests.map((r) => {
            const isMyTurn = userStep === 0 || r.current_step === userStep;
            const isApproved = r.overall_status === 'approved';
            const isRejected = r.overall_status === 'rejected';

            return (
              <div
                key={r.id}
                className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-sm space-y-4"
              >
                {/* Top Request Info */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2.5 py-0.5 bg-blue-50 text-[#0066CC] rounded-full text-[11px] font-bold border border-blue-200">
                        {r.request_code}
                      </span>
                      <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-full text-[11px] font-medium">
                        {r.category === 'medical' && '🏥 พบแพทย์ / ป่วย'}
                        {r.category === 'personal' && '💼 ธุระส่วนตัวจำเป็น'}
                        {r.category === 'department' && '🏢 ธุระแผนกวิชา'}
                        {r.category === 'parent_pickup' && '🏠 ผู้ปกครองมารับ'}
                      </span>
                    </div>

                    <h4 className="text-sm font-bold text-slate-900">
                      {r.student_name || 'นายอัครชา เปมะวิภาต'}
                    </h4>
                    <p className="text-xs text-slate-500">
                      รหัส {r.student_code || '6731901001'} • ชั้น {r.group_code || 'ปวส.2/1'}
                    </p>
                  </div>

                  {/* Status Badge */}
                  <div>
                    {isApproved && (
                      <span className="px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-full flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>อนุมัติครบ 5 ขั้นแล้ว</span>
                      </span>
                    )}
                    {isRejected && (
                      <span className="px-3 py-1 bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold rounded-full flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>ไม่อนุมัติ</span>
                      </span>
                    )}
                    {!isApproved && !isRejected && (
                      <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-300 text-xs font-bold rounded-full">
                        รอขั้นที่ {r.current_step}/5
                      </span>
                    )}
                  </div>
                </div>

                {/* Details Section */}
                <div className="bg-slate-50 rounded-2xl p-3.5 text-xs space-y-2 border border-slate-100">
                  <div className="flex items-start gap-1.5">
                    <span className="font-semibold text-slate-700 shrink-0">เหตุผล:</span>
                    <span className="text-slate-800">{r.reason}</span>
                  </div>

                  {r.destination_name && (
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-slate-700 shrink-0">สถานที่ปลายทาง:</span>
                      <span className="text-blue-700 font-medium flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-blue-600" />
                        {r.destination_name}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-slate-600 pt-1 border-t border-slate-200/60">
                    <span>
                      📅 {r.leave_date} ({r.allowed_start_time} - {r.allowed_end_time} น.)
                    </span>
                    {r.course_name && (
                      <span className="text-slate-500">วิชา: {r.course_name}</span>
                    )}
                  </div>
                </div>

                {/* Evidence Attachment Box */}
                {r.attachment_path && (
                  <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={r.attachment_path}
                        alt="เอกสารหลักฐานแนบ"
                        onClick={() => setSelectedImage(r.attachment_path!)}
                        className="w-12 h-12 object-cover rounded-xl bg-white border border-blue-200 cursor-pointer hover:scale-105 transition-transform shrink-0"
                      />
                      <div>
                        <span className="font-bold text-blue-900 block">เอกสารหลักฐานแนบ:</span>
                        <span className="text-[11px] text-slate-600 block">ใบนัดแพทย์ หรือ รูปถ่ายแชทผู้ปกครอง</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedImage(r.attachment_path!)}
                      className="px-2.5 py-1.5 bg-white hover:bg-blue-100 text-[#0066CC] border border-blue-200 rounded-xl text-[11px] font-semibold flex items-center gap-1 transition-all"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>ดูรูปเต็ม</span>
                    </button>
                  </div>
                )}

                {/* GPS Destination Check-in Verification Box */}
                {r.destination_name && (
                  <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-3 text-xs flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MapPin className={`w-4 h-4 ${r.checkin_verified ? 'text-emerald-600' : 'text-slate-400'}`} />
                      <div>
                        <span className="font-bold text-slate-800">
                          {r.checkin_verified ? 'ยืนยันพิกัดปลายทางแล้ว ✓' : 'สถานะการเดินทาง:'}
                        </span>
                        <p className="text-[11px] text-slate-500">
                          {r.checkin_verified
                            ? `เช็คอินที่ ${r.destination_name} (ห่าง ${r.checkin_distance_m} ม.)`
                            : 'นักศึกษายังไม่ได้กดเช็คอินพิกัดที่จุดหมาย'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <Link
                        href={`/trip/${r.id}`}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-semibold flex items-center gap-1 shadow-xs transition-colors"
                      >
                        <Navigation className="w-3 h-3" />
                        <span>เรดาร์สด</span>
                      </Link>

                      {r.checkin_lat && r.checkin_lng && (
                        <a
                          href={`https://www.google.com/maps?q=${r.checkin_lat},${r.checkin_lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2 py-1 bg-white hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-[11px] font-semibold flex items-center gap-1 transition-colors"
                        >
                          <span>Maps</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* 5-Tier Timeline Steps */}
                <div>
                  <p className="text-[11px] font-bold text-slate-700 mb-2">ลำดับขั้นการอนุมัติ 5 ระดับ:</p>
                  <div className="grid grid-cols-5 gap-1 text-center">
                    {[
                      { step: 1, name: '1.ครูวิชา', status: r.step1_status },
                      { step: 2, name: '2.ครูที่ปรึกษา', status: r.step2_status },
                      { step: 3, name: '3.หน.แผนก', status: r.step3_status },
                      { step: 4, name: '4.ปกครอง', status: r.step4_status },
                      { step: 5, name: '5.รอง ผอ.', status: r.step5_status },
                    ].map((s) => {
                      const isStepApproved = s.status === 'approved';
                      const isStepRejected = s.status === 'rejected';
                      const isCurrent = r.current_step === s.step && r.overall_status === 'pending';

                      return (
                        <div
                          key={s.step}
                          className={`p-1.5 rounded-xl border text-[10px] ${
                            isStepApproved
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold'
                              : isStepRejected
                              ? 'bg-rose-50 border-rose-300 text-rose-700 font-bold'
                              : isCurrent
                              ? 'bg-amber-50 border-amber-400 text-amber-900 font-bold ring-1 ring-amber-400'
                              : 'bg-slate-50 border-slate-200 text-slate-400'
                          }`}
                        >
                          <p className="truncate">{s.name}</p>
                          <p className="mt-0.5 text-[9px]">
                            {isStepApproved ? '✓ อนุมัติ' : isStepRejected ? '✕ ไม่อนุมัติ' : isCurrent ? 'รอพิจารณา' : '-'}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Approver Action Panel (when pending in this step) */}
                {r.overall_status === 'pending' && isMyTurn && (
                  <div className="pt-3 border-t border-slate-200/80 space-y-2.5">
                    <input
                      type="text"
                      value={remarks[r.id] || ''}
                      onChange={(e) => setRemarks({ ...remarks, [r.id]: e.target.value })}
                      placeholder="กรอกหมายเหตุการอนุมัติ (เช่น ตรวจสอบงานแล้ว / อนุญาต)..."
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAction(r.id, 'reject')}
                        className="flex-1 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>ไม่อนุมัติ / ตีกลับ</span>
                      </button>

                      <button
                        onClick={() => handleAction(r.id, 'approve')}
                        className="flex-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {r.current_step === 5
                            ? '✓ อนุมัติขั้นสุดท้าย & ส่งสิทธิ์ไปป้อมยาม'
                            : `✓ อนุมัติส่งต่อขั้นที่ ${r.current_step + 1}`}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
