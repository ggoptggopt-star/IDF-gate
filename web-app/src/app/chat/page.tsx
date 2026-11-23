'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  Sparkles,
  Send,
  Paperclip,
  CheckCircle2,
  ExternalLink,
  ScanFace,
  Image as ImageIcon,
  X,
  FileText,
  MessageSquare,
  Building2,
  Calendar,
  Clock,
  UserCheck,
  Shield,
  Award,
  User,
  ThumbsUp,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { LeaveRequest } from '@/types';
import ChatMapPicker from '@/components/ChatMapPicker';
import { playNotificationSound, sendSystemNotification } from '@/lib/notifications';

export interface ChatSlots {
  leave_date?: string | null;
  leave_date_text?: string | null;
  destination_name?: string | null;
  destination_lat?: number | null;
  destination_lng?: number | null;
  category?: 'medical' | 'personal' | 'department' | 'parent_pickup' | null;
  reason?: string | null;
  allowed_start_time?: string | null;
  allowed_end_time?: string | null;
  attachment_path?: string | null;
  attachment_prompted?: boolean;
}

interface ChatMessage {
  id: string;
  sender: 'student' | 'bot' | 'system' | 'teacher';
  text?: string;
  time: string;
  timestamp?: number;
  dateStr?: string;
  poweredBy?: string;
  attachmentUrl?: string | null;
  requestCard?: LeaveRequest;
  quickPills?: string[];
  checkinCard?: {
    destination: string;
    distance_m: number;
    verified: boolean;
    time: string;
    maps_url: string;
  };
}

const STANDARD_QUICK_PILLS = [
  'ขอออก',
  'ขอไปพบแพทย์ตามนัด',
  'ผู้ปกครองมารับกลับบ้านก่อนเวลา',
  'เช็คสถานะคำร้องล่าสุดของฉัน',
  'วิธีสแกนใบหน้าเปิดไม้กั้นประตู',
];

function getMessengerDivider(curr: ChatMessage, prev?: ChatMessage): { show: boolean; label: string } {
  const currTs = curr.timestamp || Date.now();
  const currD = new Date(currTs);
  const now = new Date();

  const thaiMonths = [
    'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
    'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
  ];

  const formatFullDateTime = (d: Date) => {
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now.getTime() - 86400000);
    const isYesterday = d.toDateString() === yesterday.toDateString();
    const timeStr = d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' น.';

    if (isToday) return `วันนี้ เวลา ${timeStr}`;
    if (isYesterday) return `เมื่อวานนี้ เวลา ${timeStr}`;
    return `${d.getDate()} ${thaiMonths[d.getMonth()]} ${d.getFullYear() + 543} เวลา ${timeStr}`;
  };

  const formatTimeOnly = (d: Date) => {
    return d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' น.';
  };

  // 1. Very first message of conversation
  if (!prev) {
    return { show: true, label: formatFullDateTime(currD) };
  }

  const prevTs = prev.timestamp || currTs;
  const prevD = new Date(prevTs);

  // 2. Day changed
  if (currD.toDateString() !== prevD.toDateString() || (curr.dateStr && prev.dateStr && curr.dateStr !== prev.dateStr)) {
    return { show: true, label: formatFullDateTime(currD) };
  }

  // 3. Same day, but time gap > 15 minutes -> Messenger shows ONLY TIME
  if (Math.abs(currTs - prevTs) > 15 * 60 * 1000) {
    return { show: true, label: formatTimeOnly(currD) };
  }

  return { show: false, label: '' };
}

function ChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category');
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [latestRequest, setLatestRequest] = useState<LeaveRequest | null>(null);
  const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  
  // Slot-Filling State (for student role)
  const [currentSlots, setCurrentSlots] = useState<ChatSlots>({});
  const [missingSlots, setMissingSlots] = useState<string[]>([]);
  const [askAttachmentNow, setAskAttachmentNow] = useState(false);
  const [selectedAttachmentUrl, setSelectedAttachmentUrl] = useState<string | null>(null);
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const getApproverStep = (role?: string): number => {
    switch (role) {
      case 'subject_teacher': return 1;
      case 'advisor': return 2;
      case 'dept_head': return 3;
      case 'discipline': return 4;
      case 'deputy_director': return 5;
      default: return 0;
    }
  };

  const getRoleTitleForStep = (step: number): string => {
    switch (step) {
      case 1: return 'ครูประจำวิชา (ขั้นที่ 1)';
      case 2: return 'ครูที่ปรึกษา (ขั้นที่ 2)';
      case 3: return 'หัวหน้าแผนกวิชา ทธด. (ขั้นที่ 3)';
      case 4: return 'เจ้าหน้าที่งานปกครอง (ขั้นที่ 4)';
      case 5: return 'รองผู้อำนวยการฝ่ายพัฒนากิจการฯ (ขั้นที่ 5)';
      default: return 'เจ้าหน้าที่พิจารณา';
    }
  };

  const getRoleTitle = (role?: string): string => {
    switch (role) {
      case 'subject_teacher': return 'ครูประจำวิชา (ขั้นที่ 1)';
      case 'advisor': return 'ครูที่ปรึกษา (ขั้นที่ 2)';
      case 'dept_head': return 'หัวหน้าแผนกวิชา ทธด. (ขั้นที่ 3)';
      case 'discipline': return 'เจ้าหน้าที่งานปกครอง (ขั้นที่ 4)';
      case 'deputy_director': return 'รองผู้อำนวยการ (ขั้นที่ 5)';
      case 'guard': return 'เจ้าหน้าที่ รปภ. ประตู 1';
      case 'admin': return 'ผู้ดูแลระบบ';
      default: return 'นักศึกษา';
    }
  };

  const isGuard = user?.role === 'guard';
  const isApprover = (user?.role && user.role !== 'student' && user.role !== 'guard') || user?.role === 'admin';
  const userStep = getApproverStep(user?.role);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSubmitting, askAttachmentNow, missingSlots]);

  // Load API key from localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem('sgp_gemini_api_key');
    if (savedKey) setGeminiApiKey(savedKey);
  }, []);

  // Save chat messages to localStorage when updated (Student only)
  useEffect(() => {
    if (user?.role === 'student' && messages.length > 0) {
      const studentId = user?.id || 'user-stu-akkaracha';
      try {
        localStorage.setItem(`sgp_chat_history_${studentId}`, JSON.stringify(messages));
        localStorage.setItem(`sgp_chat_slots_${studentId}`, JSON.stringify(currentSlots));
      } catch (e) {
        console.warn('Failed to save chat to localStorage:', e);
      }
    }
  }, [messages, currentSlots, user]);

  const handleResetChat = () => {
    if (confirm('คุณต้องการเริ่มการสนทนาใหม่และล้างประวัติแชทใช่หรือไม่?')) {
      const studentId = user?.id || 'user-stu-akkaracha';
      localStorage.removeItem(`sgp_chat_history_${studentId}`);
      localStorage.removeItem(`sgp_chat_slots_${studentId}`);
      setCurrentSlots({});
      setMissingSlots([]);
      setAskAttachmentNow(false);
      setSelectedAttachmentUrl(null);
      const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages([
        {
          id: `welcome-greet-${Date.now()}`,
          sender: 'bot',
          text: `สวัสดีครับ คุณ ${user?.full_name || 'นักศึกษา'} 👋`,
          time: nowTime,
          timestamp: Date.now(),
          dateStr: new Date().toISOString().split('T')[0],
          poweredBy: 'Google Gemini AI',
        },
        {
          id: `welcome-options-${Date.now() + 1}`,
          sender: 'bot',
          text: 'ผมคือ "น้องเกต AI" ผู้ช่วยระบบขออนุญาตออกนอกวิทยาลัยครับ ต้องการยื่นคำร้องหรือสอบถามเรื่องใด แตะเลือกหัวข้อด้านล่าง หรือพิมพ์บอกผมได้เลยครับ 🏫',
          time: nowTime,
          timestamp: Date.now() + 1,
          dateStr: new Date().toISOString().split('T')[0],
          poweredBy: 'Google Gemini AI',
          quickPills: STANDARD_QUICK_PILLS,
        },
      ]);
    }
  };

  // Fetch requests based on role (Student vs Approver vs Guard) with live polling
  useEffect(() => {
    let isCancelled = false;

    async function loadRequests(isPolling = false) {
      try {
        const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (isGuard) {
          // Guard View
          const res = await fetch('/api/requests');
          const data = await res.json();
          if (data.success && data.requests && !isCancelled) {
            const allReqs: LeaveRequest[] = data.requests;
            const approvedReqs = allReqs.filter((r) => r.overall_status === 'approved' || r.synced_to_gate === 1);
            const latest = approvedReqs[0] || allReqs[0];

            if (latest && !isPolling) {
              setMessages([
                {
                  id: 'msg-guard-welcome',
                  sender: 'bot',
                  text: `สวัสดีครับ ${user?.full_name || 'เจ้าหน้าที่ รปภ.'} ประจำป้อมประตู 1 (วิทยาลัยการอาชีพองครักษ์)\n\nระบบ Smart Gate Pass AI เชื่อมโยงบัญชีรายชื่อที่ได้รับอนุมัติเรียบร้อยแล้ว ${approvedReqs.length} รายการครับ\nเมื่อนักศึกษามาถึงหน้ากล้อง AI จะสแกนใบหน้าและส่งสัญญาณเปิดไม้กั้นอัตโนมัติทันทีครับ`,
                  time: nowTime,
                  poweredBy: 'Google Gemini AI',
                  requestCard: latest,
                },
              ]);
            }
          }
          return;
        }

        if (isApprover) {
          // Approver view: fetch all requests waiting for this teacher's step
          const res = await fetch('/api/requests');
          const data = await res.json();

          if (data.success && data.requests && !isCancelled) {
            const allReqs: LeaveRequest[] = data.requests;
            const waitingForMe = allReqs.filter((r) => {
              if (r.overall_status !== 'pending') return false;
              if (user?.role === 'admin') return true;
              return r.current_step === userStep;
            });

            setPendingRequests(waitingForMe);

            // If we are polling and messages are already rendered, just update request cards in-place
            if (isPolling) {
              setMessages((prev) =>
                prev.map((m) => {
                  if (m.requestCard) {
                    const fresh = allReqs.find((r) => r.id === m.requestCard!.id);
                    if (fresh) return { ...m, requestCard: fresh };
                  }
                  return m;
                })
              );
              return;
            }

            const initialMsgs: ChatMessage[] = [];

            if (waitingForMe.length > 0) {
              initialMsgs.push({
                id: 'msg-approver-welcome',
                sender: 'bot',
                text: `สวัสดีครับ ${user?.full_name || 'คุณครู'} (${getRoleTitle(user?.role)})!\n\nระบบ Smart Gate AI มีคำร้องขออนุญาตออกนอกสถานศึกษาของนักศึกษารอดำเนินการในขั้นของท่าน (${waitingForMe.length} รายการ) ครับ:\nท่านสามารถกดปุ่ม [✓ ${userStep === 5 ? 'อนุมัติขั้นสุดท้าย' : 'อนุมัติส่งต่อ'}] บนการ์ดด้านล่าง หรือพิมพ์คำว่า "อนุมัติ" ในแชทได้ทันทีครับ`,
                time: nowTime,
                poweredBy: 'Google Gemini AI',
              });

              waitingForMe.forEach((req) => {
                initialMsgs.push({
                  id: `req-card-${req.id}`,
                  sender: 'bot',
                  time: req.allowed_start_time || nowTime,
                  requestCard: req,
                });
              });
            } else {
              // No request at my exact step, but show latest pending request so teacher can review/test
              const latestPending = allReqs.find((r) => r.overall_status === 'pending') || allReqs[0];

              if (latestPending) {
                const isFinalApproved = latestPending.overall_status === 'approved';
                const statusNotice = isFinalApproved
                  ? `คำร้อง #${latestPending.request_code} ของ ${latestPending.student_name} ได้รับการอนุมัติครบทั้ง 5 ขั้นตอนแล้ว (พร้อมสแกนใบหน้าเปิดไม้กั้น)`
                  : `ขณะนี้คำร้อง #${latestPending.request_code} ของ ${latestPending.student_name} อยู่ใน [ขั้นที่ ${latestPending.current_step}/5: ${getRoleTitleForStep(latestPending.current_step)}]`;

                initialMsgs.push({
                  id: 'msg-approver-info',
                  sender: 'bot',
                  text: `สวัสดีครับ ${user?.full_name || 'คุณครู'} (${getRoleTitle(user?.role)})!\n\n${statusNotice}\nท่านสามารถตรวจดูข้อมูลและกดอนุมัติได้ที่การ์ดคำร้องด้านล่างครับ:`,
                  time: nowTime,
                  poweredBy: 'Google Gemini AI',
                });

                initialMsgs.push({
                  id: `req-card-${latestPending.id}`,
                  sender: 'bot',
                  time: latestPending.allowed_start_time || nowTime,
                  requestCard: latestPending,
                });
              } else {
                initialMsgs.push({
                  id: 'msg-approver-empty',
                  sender: 'bot',
                  text: `สวัสดีครับ ${user?.full_name || 'คุณครู'} (${getRoleTitle(user?.role)})!\n\nขณะนี้ไม่มีคำร้องใหม่ที่ค้างรอการพิจารณาครับ ระบบจะส่งข้อความแจ้งเตือนทันทีเมื่อมีคำร้องยื่นเข้ามาครับ`,
                  time: nowTime,
                  poweredBy: 'Google Gemini AI',
                });
              }
            }

            setMessages(initialMsgs);
          }
        } else {
          // Student view (or not logged in -> default to demo student)
          const studentId = user?.id || 'user-stu-akkaracha';

          // Check if there is saved chat history in localStorage!
          const savedHistoryStr = typeof window !== 'undefined' ? localStorage.getItem(`sgp_chat_history_${studentId}`) : null;
          const savedSlotsStr = typeof window !== 'undefined' ? localStorage.getItem(`sgp_chat_slots_${studentId}`) : null;

          if (savedHistoryStr && !isPolling) {
            try {
              const parsed = JSON.parse(savedHistoryStr);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setMessages(parsed);
                if (savedSlotsStr) {
                  try { setCurrentSlots(JSON.parse(savedSlotsStr)); } catch {}
                }
                const res = await fetch(`/api/requests?student_id=${studentId}`);
                const data = await res.json();
                if (data.success && data.requests && data.requests.length > 0) {
                  const fresh = data.requests[0];
                  setLatestRequest(fresh);
                  setMessages((prev) =>
                    prev.map((m) => (m.requestCard && m.requestCard.id === fresh.id ? { ...m, requestCard: fresh } : m))
                  );
                }
                return;
              }
            } catch (err) {
              console.error('Failed to parse saved chat history:', err);
            }
          }

          const res = await fetch(`/api/requests?student_id=${studentId}`);
          const data = await res.json();

          if (isPolling) {
            if (data.success && data.requests && data.requests.length > 0) {
              const fresh = data.requests[0];
              setLatestRequest(fresh);
              setMessages((prev) =>
                prev.map((m) => (m.requestCard && m.requestCard.id === fresh.id ? { ...m, requestCard: fresh } : m))
              );
            }
            return;
          }

          if (data.success && data.requests && data.requests.length > 0 && !isCancelled) {
            const req: LeaveRequest = data.requests[0];
            setLatestRequest(req);

            const initialMsgs: ChatMessage[] = [
              {
                id: 'welcome-greet',
                sender: 'bot',
                text: `สวัสดีครับ คุณ ${user?.full_name || 'นักศึกษา'} 👋`,
                time: req.allowed_start_time || '12:20',
                poweredBy: 'Google Gemini AI',
              },
              {
                id: 'welcome-options',
                sender: 'bot',
                text: 'ผมคือ "น้องเกต AI" ผู้ช่วยระบบขออนุญาตออกนอกวิทยาลัยครับ ต้องการยื่นคำร้องหรือสอบถามเรื่องใด แตะเลือกหัวข้อด้านล่าง หรือพิมพ์บอกผมได้เลยครับ 🏫',
                time: req.allowed_start_time || '12:20',
                poweredBy: 'Google Gemini AI',
                quickPills: STANDARD_QUICK_PILLS,
              },
              {
                id: 'msg-1',
                sender: 'student',
                text: `${req.reason} (สถานที่: ${req.destination_name || 'นอกวิทยาลัย'}) วันที่ ${req.leave_date} เวลา ${req.allowed_start_time} - ${req.allowed_end_time} น. ครับ`,
                time: req.allowed_start_time || '12:25',
                attachmentUrl: req.attachment_path || undefined,
              },
              {
                id: 'msg-2',
                sender: 'bot',
                text: `รับเรื่องเรียบร้อยครับ! ระบบได้ผูกตารางสอนวิชา '${req.course_name || 'การวิเคราะห์ข้อมูล'}' พร้อมสร้างคำร้อง #${req.request_code} และส่งต่อให้ผู้อนุมัติทั้ง 5 ขั้นตอนแล้วครับ`,
                time: nowTime,
                poweredBy: 'Google Gemini AI',
                requestCard: req,
              },
            ];

            if (req.checkin_verified) {
              initialMsgs.push({
                id: 'msg-checkin',
                sender: 'bot',
                time: req.checkin_at || nowTime,
                checkinCard: {
                  destination: req.destination_name || 'โรงพยาบาลองครักษ์',
                  distance_m: req.checkin_distance_m || 28.4,
                  verified: true,
                  time: req.checkin_at || nowTime,
                  maps_url: `https://www.google.com/maps?q=${req.checkin_lat || 14.1348},${req.checkin_lng || 100.9922}`,
                },
              });
            }

            setMessages(initialMsgs);
          } else if (!isCancelled) {
            setMessages([
              {
                id: 'welcome-greet',
                sender: 'bot',
                text: `สวัสดีครับ คุณ ${user?.full_name || 'นักศึกษา'} 👋`,
                time: nowTime,
                timestamp: Date.now(),
                dateStr: new Date().toISOString().split('T')[0],
                poweredBy: 'Google Gemini AI',
              },
              {
                id: 'welcome-options',
                sender: 'bot',
                text: 'ผมคือ "น้องเกต AI" ผู้ช่วยระบบขออนุญาตออกนอกวิทยาลัยครับ ต้องการยื่นคำร้องหรือสอบถามเรื่องใด แตะเลือกหัวข้อด้านล่าง หรือพิมพ์บอกผมได้เลยครับ 🏫',
                time: nowTime,
                timestamp: Date.now() + 1,
                dateStr: new Date().toISOString().split('T')[0],
                poweredBy: 'Google Gemini AI',
                quickPills: STANDARD_QUICK_PILLS,
              },
            ]);
          }
        }
      } catch (err) {
        console.error(err);
        if (!isPolling && !isCancelled) {
          const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          setMessages([
            {
              id: 'welcome-greet-fallback',
              sender: 'bot',
              text: `สวัสดีครับ คุณ ${user?.full_name || 'นักศึกษา'} 👋`,
              time: nowTime,
              timestamp: Date.now(),
              dateStr: new Date().toISOString().split('T')[0],
              poweredBy: 'Google Gemini AI',
            },
            {
              id: 'welcome-options-fallback',
              sender: 'bot',
              text: 'ผมคือ "น้องเกต AI" ผู้ช่วยระบบขออนุญาตออกนอกวิทยาลัยครับ ต้องการยื่นคำร้องหรือสอบถามเรื่องใด แตะเลือกหัวข้อด้านล่าง หรือพิมพ์บอกผมได้เลยครับ 🏫',
              time: nowTime,
              timestamp: Date.now() + 1,
              dateStr: new Date().toISOString().split('T')[0],
              poweredBy: 'Google Gemini AI',
              quickPills: STANDARD_QUICK_PILLS,
            },
          ]);
        }
      }
    }

    loadRequests(false);
    const interval = setInterval(() => {
      loadRequests(true);
    }, 2500);

    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [user?.id, user?.role, isApprover, isGuard, userStep]);

  // Handle Teacher Direct Approval Action in Chat
  const handleTeacherAction = async (requestId: string, action: 'approve' | 'reject') => {
    try {
      setIsSubmitting(true);
      const remark = action === 'approve' ? 'อนุมัติผ่านแชท AI' : 'ไม่อนุมัติตามระเบียบผ่านแชท AI';
      const res = await fetch(`/api/requests/${requestId}/approve`, {
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
        playNotificationSound();
        const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        // Update local card state in messages
        setMessages((prev) =>
          prev.map((m) => {
            if (m.requestCard && m.requestCard.id === requestId) {
              const updated = { ...m.requestCard };
              if (action === 'approve') {
                if (userStep === 1) updated.step1_status = 'approved';
                if (userStep === 2) updated.step2_status = 'approved';
                if (userStep === 3) updated.step3_status = 'approved';
                if (userStep === 4) updated.step4_status = 'approved';
                if (userStep === 5) {
                  updated.step5_status = 'approved';
                  updated.overall_status = 'approved';
                } else {
                  updated.current_step = updated.current_step + 1;
                }
              } else {
                updated.overall_status = 'rejected';
                if (userStep === 1) updated.step1_status = 'rejected';
                if (userStep === 2) updated.step2_status = 'rejected';
                if (userStep === 3) updated.step3_status = 'rejected';
                if (userStep === 4) updated.step4_status = 'rejected';
                if (userStep === 5) updated.step5_status = 'rejected';
              }
              return { ...m, requestCard: updated };
            }
            return m;
          })
        );

        // Append bot action confirmation bubble
        setMessages((prev) => [
          ...prev,
          {
            id: `action-confirm-${Date.now()}`,
            sender: 'bot',
            text: action === 'approve'
              ? `✓ บันทึกการอนุมัติคำร้องเรียบร้อยครับ!\n${data.message || 'ระบบได้ส่งต่อคำร้องไปยังผู้อนุมัติขั้นถัดไปเรียบร้อยแล้วครับ'}`
              : `✕ บันทึกการปฏิเสธคำร้องเรียบร้อยแล้วครับ`,
            time: nowTime,
            poweredBy: 'Google Gemini AI',
          },
        ]);

        // Remove from pending
        setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sgp_request_updated'));
          localStorage.setItem('sgp_last_action', Date.now().toString());
        }
      } else {
        alert(data.error || 'เกิดข้อผิดพลาดในการอนุมัติ');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Quick Category selection from URL
  useEffect(() => {
    if (categoryParam) {
      if (categoryParam === 'medical') {
        setInput('ขอไปพบแพทย์ตามนัดที่ โรงพยาบาลองครักษ์ ตอนเที่ยงวันนี้ครับ');
      } else if (categoryParam === 'personal') {
        setInput('มีธุระส่วนตัวจำเป็นที่ ที่ว่าการอำเภอองครักษ์ ช่วงบ่ายนี้ครับ');
      } else if (categoryParam === 'department') {
        setInput('ไปจัดเตรียมสถานที่และอุปกรณ์นำเสนอโครงงานที่หอประชุมใหญ่');
      } else if (categoryParam === 'parent_pickup') {
        setInput('ผู้ปกครองเดินทางมารับกลับบ้านก่อนเวลาตอนเที่ยง');
      }
    }
  }, [categoryParam]);

  // Handle File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setIsUploading(true);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.fileUrl) {
        setSelectedAttachmentUrl(data.fileUrl);
        await handleSend(undefined, false, data.fileUrl);
      } else {
        alert(data.error || 'อัปโหลดไฟล์ไม่สำเร็จ');
      }
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการอัปโหลดไฟล์');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Send request via Gemini AI chat endpoint
  const handleSend = async (
    e?: React.FormEvent,
    skipAttachment: boolean = false,
    overrideAttachmentUrl?: string,
    presetText?: string
  ) => {
    if (e) e.preventDefault();

    const userText = presetText !== undefined ? presetText : input.trim();
    const attachUrl = overrideAttachmentUrl !== undefined ? overrideAttachmentUrl : selectedAttachmentUrl;

    if (!userText && !attachUrl && !skipAttachment) return;
    if (isSubmitting && !overrideAttachmentUrl) return;

    setInput('');
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 1. If user is an Approver and typed approval words ("อนุมัติ", "ผ่าน", "ไม่อนุมัติ")
    if (isApprover) {
      const isApproveCmd = /(อนุมัติ|อนุญาต|ผ่าน|ตกลง|ok|yes)/i.test(userText);
      const isRejectCmd = /(ไม่อนุมัติ|ปฏิเสธ|ไม่อนุญาต|ไม่ให้ไป|ตีกลับ)/i.test(userText);

      // Append teacher chat bubble
      setMessages((prev) => [
        ...prev,
        {
          id: `teacher-${Date.now()}`,
          sender: 'student',
          text: userText,
          time: nowTime,
        },
      ]);

      if (isApproveCmd || isRejectCmd) {
        const targetReq = pendingRequests[0];
        if (targetReq) {
          await handleTeacherAction(targetReq.id, isApproveCmd ? 'approve' : 'reject');
          return;
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: `bot-no-req-${Date.now()}`,
              sender: 'bot',
              text: 'ขณะนี้ไม่มีคำร้องที่ค้างรอการอนุมัติในขั้นของท่านแล้วครับ ขอบคุณครับ!',
              time: nowTime,
              poweredBy: 'Google Gemini AI',
            },
          ]);
          return;
        }
      }
    }

    // 2. Student Chat / General AI QA
    let bubbleText = userText;
    if (skipAttachment && !bubbleText) {
      bubbleText = 'ไม่มีเอกสารแนบครับ (ข้ามขั้นตอนแนบ)';
    } else if (attachUrl && !bubbleText) {
      bubbleText = 'แนบเอกสารหลักฐาน / รูปถ่ายแชทผู้ปกครองเรียบร้อยครับ';
    }

    const newStudentMsg: ChatMessage = {
      id: `stu-${Date.now()}`,
      sender: 'student',
      text: bubbleText,
      time: nowTime,
      timestamp: Date.now(),
      dateStr: new Date().toISOString().split('T')[0],
      attachmentUrl: attachUrl || undefined,
    };
    setMessages((prev) => [...prev, newStudentMsg]);
    setIsSubmitting(true);
    setAskAttachmentNow(false);

    const abortCtrl = new AbortController();
    const timeoutId = setTimeout(() => abortCtrl.abort(), 28000);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortCtrl.signal,
        body: JSON.stringify({
          message: bubbleText,
          currentSlots,
          attachment_url: attachUrl,
          skip_attachment: skipAttachment,
          apiKey: geminiApiKey,
          student_id: user?.id || 'user-stu-akkaracha',
          history: messages.slice(-4).map((m) => ({
            role: m.sender === 'student' ? 'user' : 'model',
            text: m.text || '',
          })).filter((h) => h.text.trim().length > 0),
        }),
      });

      clearTimeout(timeoutId);

      const data = await res.json();
      if (data.success) {
        if (data.slots) {
          setCurrentSlots(data.slots);
        }

        setMissingSlots(data.missing_slots || []);

        if (data.ask_attachment_now) {
          setAskAttachmentNow(true);
        }

        if (data.request) {
          setLatestRequest(data.request);
          setCurrentSlots({});
          setMissingSlots([]);
          setSelectedAttachmentUrl(null);
          playNotificationSound();
          sendSystemNotification({
            title: `🔔 ยื่นคำร้องสำเร็จ: ${data.request.request_code}`,
            body: `คำร้องของท่านถูกส่งต่อให้ ${data.request.step1_teacher_id || 'ครูผู้สอน'} เรียบร้อยแล้ว`,
            url: '/chat',
            tag: `student-sent-${data.request.id}`,
          });
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('sgp_request_updated'));
            localStorage.setItem('sgp_last_action', Date.now().toString());
          }
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            sender: 'bot',
            text: data.reply,
            time: nowTime,
            timestamp: Date.now(),
            dateStr: new Date().toISOString().split('T')[0],
            poweredBy: data.poweredBy,
            attachmentUrl: data.slots?.attachment_path || undefined,
            requestCard: data.request || undefined,
          },
        ]);
      } else {
        alert(data.error || 'เกิดข้อผิดพลาดในการสนทนากับ AI');
      }
    } catch (err: any) {
      console.error(err);
      if (err.name === 'AbortError') {
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-timeout-${Date.now()}`,
            sender: 'bot',
            text: 'ระบบ AI ใช้เวลาตอบสนองนานเกินกำหนด กรุณาลองส่งข้อความใหม่อีกครั้งครับ',
            time: nowTime,
          },
        ]);
      }
    } finally {
      clearTimeout(timeoutId);
      setIsSubmitting(false);
    }
  };

  // Perform GPS Check-in
  const handleGpsCheckin = async () => {
    if (!latestRequest) {
      alert('ยังไม่มีคำร้องที่เปิดใช้งานในขณะนี้');
      return;
    }

    const checkinLat = 14.1348;
    const checkinLng = 100.9922;

    try {
      const res = await fetch(`/api/requests/${latestRequest.id}/checkin-gps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat: checkinLat, lng: checkinLng }),
      });
      const data = await res.json();
      if (data.success && data.checkin) {
        const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setMessages((prev) => [
          ...prev,
          {
            id: `checkin-${Date.now()}`,
            sender: 'bot',
            time: nowTime,
            checkinCard: {
              destination: latestRequest.destination_name || 'โรงพยาบาลองครักษ์',
              distance_m: data.checkin.distance_m,
              verified: data.checkin.verified,
              time: nowTime,
              maps_url: data.checkin.maps_url,
            },
          },
        ]);
      } else {
        alert(data.error || 'ไม่สามารถเช็คอินได้');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Report Return to College
  const handleReturnReport = () => {
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [
      ...prev,
      {
        id: `return-stu-${Date.now()}`,
        sender: 'student',
        text: 'เดินทางกลับมาถึงวิทยาลัยการอาชีพองครักษ์แล้วครับ ขอยืนยันรายงานตัวกลับเข้า',
        time: nowTime,
      },
      {
        id: `return-bot-${Date.now()}`,
        sender: 'bot',
        text: 'ระบบตรวจสอบพิกัด GPS: คุณอยู่ในรัศมีวิทยาลัยการอาชีพองครักษ์เรียบร้อยแล้วครับ กรุณาสแกนใบหน้าที่กล้องประตู 1 เพื่อบันทึกเวลากลับเข้าวิทยาลัยและปิดรอบคำร้องครับ',
        time: nowTime,
        poweredBy: 'Google Gemini AI',
      },
    ]);
  };

  // One-Click Instant Request Demo Trigger (No typing needed)
  const handleQuickInstantRequest = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // 1. Add student simulated prompt in chat
    setMessages((prev) => [
      ...prev,
      {
        id: `stu-instant-${Date.now()}`,
        sender: 'student',
        text: '⚡ [ยื่นคำร้องด่วน 1 คลิก]: ขออนุญาตไปพบแพทย์ตามนัดที่ โรงพยาบาลองครักษ์ วันนี้ เวลา 12:00 - ไม่กลับ น. ครับ',
        time: nowTime,
      },
    ]);

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: user?.id || 'user-stu-akkaracha',
          category: 'medical',
          reason: 'พบแพทย์ตามนัดที่โรงพยาบาลองครักษ์',
          destination_name: 'โรงพยาบาลองครักษ์',
          destination_lat: 14.135,
          destination_lng: 100.992,
          leave_date: todayStr,
          allowed_start_time: '12:00',
          allowed_end_time: 'ไม่กลับ',
          course_id: 'cs-hvc2-wed-am',
        }),
      });

      const data = await res.json();
      if (data.success && data.request) {
        setLatestRequest(data.request);
        setCurrentSlots({});
        setMissingSlots([]);
        setAskAttachmentNow(false);

        // Sound chime and notify
        playNotificationSound();
        sendSystemNotification({
          title: `🔔 ยื่นคำร้องด่วนสำเร็จ: ${data.request.request_code}`,
          body: `คำร้องส่งต่อไปยังครูผู้สอน (ขั้นที่ 1) เรียบร้อยแล้ว`,
          url: '/chat',
          tag: `instant-${data.request.id}`,
        });

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sgp_request_updated'));
          localStorage.setItem('sgp_last_action', Date.now().toString());
        }

        // 2. Append bot confirmation bubble with active request card
        setMessages((prev) => [
          ...prev,
          {
            id: `bot-instant-${Date.now()}`,
            sender: 'bot',
            text: `⚡ ดำเนินการยื่นคำร้องด่วน (โหมดสาธิต 1 คลิก) สำเร็จเรียบร้อยครับ!\n📅 วันที่: วันนี้ (เวลา 12:00 - ไม่กลับ น.)\n📍 สถานที่: โรงพยาบาลองครักษ์\nระบบได้ส่งคำร้องเข้าสู่สายพานการพิจารณา 5 ขั้นตอน และแจ้งเตือนครูประจำวิชาเรียบร้อยครับ`,
            time: nowTime,
            poweredBy: 'Google Gemini AI',
            requestCard: data.request,
          },
        ]);
      } else {
        alert(data.error || 'เกิดข้อผิดพลาดในการสร้างคำร้องด่วน');
      }
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-[#F4F7FB] relative">
      {/* Lightbox Image Preview Modal */}
      {previewModalUrl && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="relative max-w-lg w-full bg-white rounded-3xl p-4 shadow-2xl">
            <button
              onClick={() => setPreviewModalUrl(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-slate-700 shadow-md"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="rounded-2xl overflow-hidden border border-slate-200">
              <img
                src={previewModalUrl}
                alt="เอกสารหลักฐานแนบ"
                className="w-full h-auto max-h-[75vh] object-contain bg-slate-100"
              />
            </div>
            <div className="mt-2.5 text-center">
              <span className="text-xs font-bold text-slate-800">เอกสารหลักฐาน / รูปภาพแชทผู้ปกครอง</span>
              <p className="text-[11px] text-slate-500">บันทึกลงในระบบ Smart Gate Pass AI เรียบร้อย</p>
            </div>
          </div>
        </div>
      )}

      {/* Top Header */}
      <header className="px-4 py-3 bg-[#03152B] text-white sticky top-0 z-30 shadow-sm">
        <div className="w-full max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
            >
              <ChevronLeft className="w-5 h-5" />
            </Link>

            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="font-bold text-sm tracking-wide">AI Messaging</h1>
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span className="text-[10px] text-emerald-400 font-medium">Online</span>
              </div>
              <p className="text-[10px] text-slate-300">
                {isApprover ? `${user?.full_name} (${getRoleTitle(user?.role)})` : 'ระบบขออนุญาต & ไม้กั้น AI (OICEC)'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!isApprover && (
              <button
                type="button"
                onClick={handleResetChat}
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-slate-200 hover:text-white transition-all flex items-center gap-1 text-[11px] font-medium px-2.5"
                title="เริ่มการสนทนาใหม่ (ล้างประวัติแชท)"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">เริ่มคุยใหม่</span>
              </button>
            )}

            {isApprover ? (
              <Link
                href="/approver"
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white text-xs font-semibold rounded-full flex items-center gap-1.5 shadow-sm transition-all"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>คิวอนุมัติ</span>
              </Link>
            ) : (
              <Link
                href="/gate"
                className="px-3 py-1.5 bg-[#0077D7] hover:bg-[#0066CC] active:scale-95 text-white text-xs font-semibold rounded-full flex items-center gap-1.5 shadow-sm transition-all"
              >
                <ScanFace className="w-3.5 h-3.5" />
                <span>เปิดไม้กั้น</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Active Slot-Filling Tracker Banner (For student role) */}
      {!isApprover && (currentSlots.destination_name || currentSlots.reason || currentSlots.allowed_start_time || currentSlots.leave_date) && !latestRequest?.id && (
        <div className="bg-blue-50 border-b border-blue-200/80 px-4 py-2 animate-fadeIn">
          <div className="w-full max-w-4xl mx-auto flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-2 text-blue-900 font-medium truncate">
              <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse"></span>
              <span className="font-bold">ข้อมูลที่ AI กำลังจำ:</span>
              <span>📅 {currentSlots.leave_date_text || currentSlots.leave_date || 'รอระบุวัน'}</span>
              <span>• 📍 {currentSlots.destination_name || 'รอระบุสถานที่'}</span>
              <span>• ⏰ {currentSlots.allowed_start_time ? `${currentSlots.allowed_start_time}-${currentSlots.allowed_end_time} น.` : 'รอระบุเวลา'}</span>
            </div>
            <button
              onClick={() => {
                setCurrentSlots({});
                setMissingSlots([]);
                setAskAttachmentNow(false);
              }}
              className="text-[10px] text-blue-600 hover:underline font-semibold shrink-0"
            >
              เริ่มใหม่
            </button>
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        <div className="w-full max-w-4xl mx-auto space-y-4">
        {messages.map((m, index) => {
          const prev = index > 0 ? messages[index - 1] : undefined;
          const divider = getMessengerDivider(m, prev);
          if (m.sender === 'student') {
            return (
              <React.Fragment key={m.id}>
                {divider.show && (
                  <div className="flex justify-center my-3.5 select-none">
                    <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 tracking-wider uppercase">
                      {divider.label}
                    </span>
                  </div>
                )}
                <div className="flex flex-col items-end">
                <div className="max-w-[85%] bg-[#DCE6F2] text-slate-800 text-xs rounded-2xl rounded-tr-xs px-4 py-3 shadow-2xs leading-relaxed space-y-2">
                  <div>{m.text}</div>
                  
                  {/* Attached Image Bubble */}
                  {m.attachmentUrl && (
                    <div
                      onClick={() => setPreviewModalUrl(m.attachmentUrl!)}
                      className="cursor-pointer group relative rounded-xl overflow-hidden border border-slate-300 bg-white/70 p-1.5 transition-all hover:shadow-md"
                    >
                      <div className="flex items-center gap-1.5 mb-1 text-[10px] text-blue-700 font-semibold">
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>หลักฐานที่แนบ (คลิกเพื่อดูรูปเต็ม)</span>
                      </div>
                      <img
                        src={m.attachmentUrl}
                        alt="ไฟล์แนบ"
                        className="w-full max-h-36 object-contain rounded-lg bg-slate-50"
                      />
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 mr-1">{m.time} • ส่งแล้ว</span>
              </div>
            </React.Fragment>
          );
        }

        return (
          <React.Fragment key={m.id}>
            {divider.show && (
              <div className="flex justify-center my-3.5 select-none">
                <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 tracking-wider uppercase">
                  {divider.label}
                </span>
              </div>
            )}
            <div className="flex flex-col items-start max-w-[95%] space-y-2">
              <div className="flex items-start gap-2">
                <div className="w-7 h-7 rounded-full bg-[#03152B] flex items-center justify-center shrink-0 mt-1 text-cyan-400">
                  <Sparkles className="w-4 h-4" />
                </div>

                <div className="space-y-2 flex-1">
                  {/* Natural Chat Bubble */}
                  {m.text && (
                    <div className="bg-white text-slate-800 text-xs rounded-2xl rounded-tl-xs px-4 py-3 shadow-2xs border border-slate-100 leading-relaxed whitespace-pre-line">
                      {m.text}
                      {m.poweredBy && (
                        <span className="block mt-1 text-[9px] text-[#0066CC] font-semibold opacity-75">
                          ✦ {m.poweredBy}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Quick Action Pills (Grab Help Centre Style) */}
                  {m.quickPills && m.quickPills.length > 0 && (
                    <div className="flex flex-col items-end gap-2 mt-2 w-full select-none pl-2">
                      {m.quickPills.map((pill, pIdx) => (
                        <button
                          key={pIdx}
                          onClick={() => handleSend(undefined, false, undefined, pill)}
                          disabled={isSubmitting}
                          className="bg-[#EAF7F6] hover:bg-[#D5EFEA] active:scale-95 text-[#0A695E] dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800 font-semibold text-xs px-4 py-2.5 rounded-2xl shadow-2xs border border-[#BCE8E0] transition-all cursor-pointer text-right flex items-center justify-end self-end max-w-[90%]"
                        >
                          <span>{pill}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 5-Tier Request Card (Interactive for both Student & Approver) */}
                  {m.requestCard && (
                    <div className="bg-[#0066CC] text-white rounded-3xl p-4 shadow-md w-full space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="bg-white/20 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
                          {m.requestCard.overall_status === 'approved'
                            ? 'อนุมัติคำขอครบ 5 ขั้นแล้ว ✓'
                            : m.requestCard.overall_status === 'rejected'
                            ? 'ไม่อนุมัติ ✕'
                            : `กำลังพิจารณา (ขั้นที่ ${m.requestCard.current_step}/5)`}
                        </span>
                        <span className="font-mono text-white/80 text-[11px]">{m.requestCard.request_code}</span>
                      </div>

                      {/* Student Info Box (Important for Approver) */}
                      <div className="bg-white/10 rounded-2xl p-2.5 border border-white/15">
                        <div className="flex items-center justify-between text-xs font-bold text-white mb-0.5">
                          <span>👤 {m.requestCard.student_name || 'นายอัครชา เปมะวิภาต'}</span>
                          <span className="text-[10px] text-blue-100 font-normal">ชั้น {m.requestCard.group_code || 'ปวส.2/1'}</span>
                        </div>
                        <p className="text-[11px] text-blue-50 mt-1">
                          <span className="font-bold">เหตุผล: </span>{m.requestCard.reason}
                        </p>
                        {m.requestCard.destination_name && (
                          <p className="text-[11px] text-blue-100 mt-0.5">
                            <span className="font-bold">สถานที่: </span>{m.requestCard.destination_name}
                          </p>
                        )}
                      </div>

                      {/* Display attached image thumbnail in Card if exists */}
                      {m.requestCard.attachment_path && (
                        <div
                          onClick={() => setPreviewModalUrl(m.requestCard!.attachment_path!)}
                          className="bg-white/10 hover:bg-white/15 cursor-pointer rounded-2xl p-2.5 border border-white/20 transition-all flex items-center gap-3"
                        >
                          <img
                            src={m.requestCard.attachment_path}
                            alt="รูปหลักฐานที่แนบ"
                            className="w-12 h-12 object-cover rounded-xl bg-white shrink-0 border border-white/30"
                          />
                          <div className="text-[11px] text-white leading-tight">
                            <span className="font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                              <span>แนบหลักฐานเรียบร้อย</span>
                            </span>
                            <span className="text-[10px] text-white/80 block mt-0.5">
                              คลิกเพื่อเปิดดูภาพเต็มที่ส่งให้ครูผู้ตรวจ
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="bg-white/10 rounded-2xl p-3 border border-white/15 space-y-2">
                        <div className="flex items-center justify-between text-xs text-white/90">
                          <span className="text-[11px]">วันที่ขอออก:</span>
                          <span className="font-bold">{m.requestCard.leave_date}</span>
                        </div>

                        <div className="flex items-center justify-between text-xs text-white/90">
                          <span className="text-[11px]">ช่วงเวลาที่ขอออก-กลับ:</span>
                          <span className="font-bold">
                            {m.requestCard.allowed_start_time} - {m.requestCard.allowed_end_time} น.
                          </span>
                        </div>

                        {m.requestCard.course_name && (
                          <div className="text-[10px] text-blue-100 flex items-center gap-1">
                            <span>📚 คาบเรียน:</span>
                            <span className="font-semibold">{m.requestCard.course_name}</span>
                          </div>
                        )}

                        {/* Approver Action Buttons vs Guard View vs Student Gate Button */}
                        {isGuard ? (
                          <div className="pt-2 border-t border-white/20 space-y-2">
                            <div className="bg-emerald-500/20 border border-emerald-400/30 rounded-xl p-2 text-center text-xs text-white font-bold flex items-center justify-center gap-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                              <span>
                                {m.requestCard.overall_status === 'approved' || m.requestCard.synced_to_gate === 1
                                  ? 'สิทธิ์ผ่านไม้กั้น: อนุมัติแล้ว พร้อมสแกนใบหน้า'
                                  : `อยู่ระหว่างพิจารณา (ขั้นที่ ${m.requestCard.current_step}/5)`}
                              </span>
                            </div>
                            <Link
                              href="/gate"
                              className="w-full py-2.5 bg-white hover:bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all"
                            >
                              <ScanFace className="w-4 h-4 text-emerald-600" />
                              <span>📷 ไปที่หน้าจอสแกนไม้กั้นประตู 1 (Smart Gate)</span>
                            </Link>
                          </div>
                        ) : isApprover ? (
                          <div className="pt-2 border-t border-white/20 space-y-1.5">
                            {m.requestCard.overall_status === 'pending' ? (
                              user?.role === 'admin' || m.requestCard.current_step === userStep ? (
                                <div className="space-y-1.5">
                                  <div className="text-[11px] text-blue-100 font-medium text-center">
                                    รอดำเนินการในขั้นของท่าน ({getRoleTitle(user?.role)}):
                                  </div>
                                  <div className="grid grid-cols-2 gap-2">
                                    <button
                                      onClick={() => handleTeacherAction(m.requestCard!.id, 'approve')}
                                      disabled={isSubmitting}
                                      className="py-2.5 px-3 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
                                    >
                                      <CheckCircle2 className="w-4 h-4" />
                                      <span>{userStep === 5 ? '✓ อนุมัติขั้นสุดท้าย' : '✓ อนุมัติส่งต่อ'}</span>
                                    </button>
                                    <button
                                      onClick={() => handleTeacherAction(m.requestCard!.id, 'reject')}
                                      disabled={isSubmitting}
                                      className="py-2.5 px-3 bg-rose-500/80 hover:bg-rose-600 active:scale-95 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                                    >
                                      <X className="w-4 h-4" />
                                      <span>✕ ไม่อนุมัติ</span>
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <div className="bg-amber-500/20 border border-amber-400/40 rounded-xl p-2.5 text-center text-xs text-amber-100 font-medium">
                                    <div className="font-bold flex items-center justify-center gap-1.5 text-white">
                                      <Clock className="w-4 h-4 text-amber-300" />
                                      <span>กำลังรอการพิจารณาในขั้นที่ {m.requestCard.current_step}/5:</span>
                                    </div>
                                    <p className="text-[11px] text-amber-200 mt-0.5 font-bold">
                                      {getRoleTitleForStep(m.requestCard.current_step)}
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => handleTeacherAction(m.requestCard!.id, 'approve')}
                                    disabled={isSubmitting}
                                    className="w-full py-2 px-3 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 active:scale-95 text-white text-[11px] font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-md transition-all cursor-pointer"
                                    title="อนุมัติข้ามขั้นตอนเพื่อการสาธิตอย่างรวดเร็ว"
                                  >
                                    <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                                    <span>⚡ อนุมัติในขั้นนี้ทันที (โหมดสาธิต)</span>
                                  </button>
                                </div>
                              )
                            ) : m.requestCard.overall_status === 'approved' ? (
                              <div className="space-y-2">
                                <div className="bg-emerald-500/25 border border-emerald-400/40 rounded-xl p-2.5 text-center text-xs text-white font-bold flex items-center justify-center gap-1.5">
                                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                                  <span>อนุมัติครบ 5 ขั้นแล้ว (ส่งข้อมูลเข้าป้อมยามเรียบร้อย)</span>
                                </div>
                                <Link
                                  href="/gate"
                                  className="w-full py-2.5 bg-white hover:bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all"
                                >
                                  <ScanFace className="w-4 h-4 text-emerald-700" />
                                  <span>📷 ไปที่หน้าสแกนไม้กั้นประตู 1 (ทดสอบเปิดไม้กั้น)</span>
                                </Link>
                              </div>
                            ) : (
                              <div className="bg-rose-500/20 border border-rose-400/30 rounded-xl p-2 text-center text-xs text-white font-bold flex items-center justify-center gap-1.5">
                                <XCircle className="w-4 h-4 text-rose-300" />
                                <span>คำร้องถูกปฏิเสธแล้ว</span>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="pt-2 border-t border-white/20">
                            {m.requestCard.overall_status === 'approved' ? (
                              <Link
                                href="/gate"
                                className="w-full py-2.5 bg-white hover:bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all"
                              >
                                <ScanFace className="w-4 h-4 text-emerald-600" />
                                <span>สแกนใบหน้าเพื่อเปิดไม้กั้นอัตโนมัติ (อนุมัติแล้ว ✓)</span>
                              </Link>
                            ) : (
                              <div className="bg-white/10 rounded-xl p-2.5 text-center text-xs text-blue-100">
                                <span>กำลังรอการพิจารณา (ขั้นที่ {m.requestCard.current_step}/5: {getRoleTitleForStep(m.requestCard.current_step)})</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* GPS Destination Check-in Card */}
                  {m.checkinCard && (
                    <div className="bg-white border border-emerald-200 rounded-3xl p-4 shadow-sm w-full text-xs">
                      <div className="flex items-center gap-1.5 text-emerald-700 font-bold mb-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>เช็คอินพิกัด GPS ถึงจุดหมายสำเร็จ</span>
                      </div>
                      <p className="text-slate-700 font-medium">สถานที่: {m.checkinCard.destination}</p>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        ระยะห่างจากพิกัดปลายทาง: {m.checkinCard.distance_m} เมตร ({m.checkinCard.time})
                      </p>
                      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                        <span className="text-[10px] text-slate-400">ตรวจสอบตำแหน่งเฉพาะจุดเช็คอิน</span>
                        <a
                          href={m.checkinCard.maps_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#0066CC] font-semibold text-[11px] flex items-center gap-1 hover:underline"
                        >
                          <span>ดูบน Google Maps</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </React.Fragment>
        );
      })}

        {/* Home Pin Picker Card in Chat */}
        {!isApprover && (missingSlots.includes('home_pin') || (currentSlots.destination_name === 'บ้านพักอาศัย' && !currentSlots.destination_lat)) && (
          <div className="my-2 px-1 animate-fadeIn">
            <ChatMapPicker
              onSelect={(loc) => {
                const updated = {
                  ...currentSlots,
                  destination_name: 'บ้านพักอาศัย',
                  destination_lat: loc.lat,
                  destination_lng: loc.lng,
                  is_return_required: 0,
                };
                setCurrentSlots(updated);
                setMissingSlots((prev) => prev.filter((s) => s !== 'home_pin'));
                handleSend(undefined, false, undefined, `ปักหมุดบ้านพักอาศัยเรียบร้อยครับ (พิกัด ${loc.lat}, ${loc.lng})`);
              }}
            />
          </div>
        )}

        {/* AI Typing Indicator */}
        {(isSubmitting || isUploading) && (
          <div className="flex items-start gap-2 max-w-[85%] animate-fadeIn">
            <div className="w-7 h-7 rounded-full bg-[#03152B] flex items-center justify-center shrink-0 mt-1 text-cyan-400">
              <Sparkles className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-white text-slate-600 text-xs rounded-2xl rounded-tl-xs px-4 py-3 shadow-2xs border border-slate-100 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping"></span>
              <span>
                {isUploading
                  ? 'กำลังอัปโหลดไฟล์ภาพหลักฐาน...'
                  : selectedAttachmentUrl
                  ? 'น้องเกต AI กำลังอ่านและตรวจสอบเอกสารหลักฐาน... 🔍'
                  : 'น้องเกต AI กำลังประมวลผลคำสั่ง...'}
              </span>
            </div>
          </div>
        )}

        </div>
        <div ref={messagesEndRef} />
      </div>

      {/* Approver Quick Action Bar */}
      {isApprover ? (
        <div className="px-3 py-1.5 bg-slate-900 text-white">
          <div className="w-full max-w-4xl mx-auto flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <span className="text-[10px] font-bold text-emerald-400 shrink-0">คำสั่งครูด่วน:</span>

            {pendingRequests.length > 0 && (
              <button
                onClick={() => handleSend(undefined, false, undefined, 'อนุมัติครับ')}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white rounded-full text-[11px] font-bold shrink-0 shadow-sm flex items-center gap-1 transition-all"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>✓ อนุมัติคำร้องล่าสุด</span>
              </button>
            )}

            <Link
              href="/approver"
              className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-full text-[11px] font-medium shrink-0 flex items-center gap-1 transition-all"
            >
              <UserCheck className="w-3.5 h-3.5 text-blue-300" />
              <span>ดูรายการทั้งหมด ({pendingRequests.length})</span>
            </Link>

            <button
              onClick={() => handleSend(undefined, false, undefined, 'สรุปคำร้องที่รอการอนุมัติวันนี้')}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-full text-[11px] font-medium shrink-0 transition-all"
            >
              📊 สรุปยอดคำร้อง
            </button>
          </div>
        </div>
      ) : (
        /* Student Quick Action Bar */
        <div className="px-3 py-1.5 bg-[#F4F7FB]">
          <div className="w-full max-w-4xl mx-auto flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            {/* 1-Click Instant Request Demo Button */}
            <button
              onClick={handleQuickInstantRequest}
              disabled={isSubmitting}
              className="px-3 py-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-600 hover:to-orange-600 text-white font-bold rounded-full text-[11px] whitespace-nowrap shadow-sm flex items-center gap-1 active:scale-95 transition-all shrink-0 border border-amber-300/40"
              title="กดปุ่มนี้เพื่อยื่นคำร้องตัวอย่างทันทีโดยไม่ต้องพิมพ์ข้อมูล (โหมดสาธิต 1 คลิก)"
            >
              <span>⚡ ยื่นคำร้องด่วน (1 คลิก)</span>
            </button>

            <button
              onClick={() => handleSend(undefined, false, undefined, 'ขอออก')}
              disabled={isSubmitting}
              className="px-3 py-1.5 bg-[#EAF7F6] border border-[#BCE8E0] text-[#0A695E] rounded-full text-[11px] font-semibold whitespace-nowrap shadow-2xs hover:bg-[#D5EFEA] flex items-center gap-1 active:scale-95 transition-all shrink-0 cursor-pointer"
            >
              <span>🚪 ขอออก</span>
            </button>

            <button
              onClick={() => handleSend(undefined, false, undefined, 'ขอไปพบแพทย์ตามนัด')}
              disabled={isSubmitting}
              className="px-3 py-1.5 bg-[#EAF7F6] border border-[#BCE8E0] text-[#0A695E] rounded-full text-[11px] font-semibold whitespace-nowrap shadow-2xs hover:bg-[#D5EFEA] flex items-center gap-1 active:scale-95 transition-all shrink-0 cursor-pointer"
            >
              <span>🏥 ขอไปพบแพทย์ตามนัด</span>
            </button>

            <button
              onClick={() => handleSend(undefined, false, undefined, 'ผู้ปกครองมารับกลับบ้านก่อนเวลา')}
              disabled={isSubmitting}
              className="px-3 py-1.5 bg-[#EAF7F6] border border-[#BCE8E0] text-[#0A695E] rounded-full text-[11px] font-semibold whitespace-nowrap shadow-2xs hover:bg-[#D5EFEA] flex items-center gap-1 active:scale-95 transition-all shrink-0 cursor-pointer"
            >
              <span>🚗 ผู้ปกครองมารับ</span>
            </button>

            <button
              onClick={() => handleSend(undefined, false, undefined, 'เช็คสถานะคำร้องล่าสุดของฉัน')}
              disabled={isSubmitting}
              className="px-3 py-1.5 bg-[#EAF7F6] border border-[#BCE8E0] text-[#0A695E] rounded-full text-[11px] font-semibold whitespace-nowrap shadow-2xs hover:bg-[#D5EFEA] flex items-center gap-1 active:scale-95 transition-all shrink-0 cursor-pointer"
            >
              <span>📊 เช็คสถานะคำร้อง</span>
            </button>

            <button
              onClick={() => handleSend(undefined, false, undefined, 'วิธีสแกนใบหน้าเปิดไม้กั้นประตู')}
              disabled={isSubmitting}
              className="px-3 py-1.5 bg-[#EAF7F6] border border-[#BCE8E0] text-[#0A695E] rounded-full text-[11px] font-semibold whitespace-nowrap shadow-2xs hover:bg-[#D5EFEA] flex items-center gap-1 active:scale-95 transition-all shrink-0 cursor-pointer"
            >
              <span>🔒 วิธีสแกนไม้กั้น</span>
            </button>

            <button
              onClick={handleGpsCheckin}
              className="px-3 py-1.5 bg-white border border-emerald-200 rounded-full text-[11px] font-medium text-emerald-800 whitespace-nowrap shadow-2xs hover:bg-emerald-50 flex items-center gap-1 shrink-0"
            >
              <span>📍 เช็คอินจุดหมาย</span>
            </button>

            <button
              onClick={handleReturnReport}
              className="px-3 py-1.5 bg-white border border-blue-200 rounded-full text-[11px] font-medium text-[#0066CC] whitespace-nowrap shadow-2xs hover:bg-blue-50 flex items-center gap-1"
            >
              <span>✅ รายงานตัวกลับเข้าวิทยาลัย</span>
            </button>
          </div>
        </div>
      )}

      {/* Hidden File Input for Real File Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Bottom Input Field Bar */}
      <div className="p-3 bg-white border-t border-slate-200/80 sticky bottom-16 z-30">
        <div className="w-full max-w-4xl mx-auto">
          <form onSubmit={(e) => handleSend(e, false)} className="flex items-center gap-2">
          {!isApprover && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-slate-500 hover:text-[#0066CC] transition-colors relative"
              title="แนบรูปถ่ายใบนัดแพทย์หรือแชทผู้ปกครองจากเครื่อง"
            >
              <Paperclip className="w-5 h-5 -rotate-45" />
            </button>
          )}

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              isApprover
                ? 'พิมพ์ "อนุมัติ", "ไม่อนุมัติ" หรือสอบถามระบบได้เลย...'
                : 'พิมพ์คุยกับน้องเกต AI หรือแตะเลือกหัวข้อด้านบน...'
            }
            className="flex-1 py-2.5 px-4 bg-slate-100 border border-slate-200/60 rounded-2xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] transition-all"
          />

          <button
            type="submit"
            disabled={!input.trim() || isSubmitting}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
              input.trim()
                ? 'bg-[#0077D7] hover:bg-[#0066CC] text-white shadow-sm'
                : 'bg-slate-100 text-slate-400'
            }`}
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </form>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-xs text-slate-400">กำลังโหลดระบบแชท AI...</div>}>
      <ChatContent />
    </Suspense>
  );
}
