'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Send,
  Paperclip,
  CheckCircle2,
  ExternalLink,
  ScanFace,
  Image as ImageIcon,
  X,
  Clock,
  UserCheck,
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

export interface ChatOption {
  label: string;
  actionValue: string;
  variant?: 'default' | 'primary' | 'success' | 'home';
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
  options?: ChatOption[];
  checkinCard?: {
    destination: string;
    distance_m: number;
    verified: boolean;
    time: string;
    maps_url: string;
  };
}

// Preset In-Chat Capsule Option Sets
const MAIN_MENU_OPTIONS: ChatOption[] = [
  { label: '🚪 ขออนุญาตออกนอกวิทยาลัย', actionValue: 'act_leave', variant: 'primary' },
  { label: '📋 ติดตามสถานะคำร้องของฉัน', actionValue: 'act_status', variant: 'default' },
  { label: '❓ คำถามที่พบบ่อย (FAQ)', actionValue: 'act_faq', variant: 'default' },
];

const CATEGORY_OPTIONS: ChatOption[] = [
  { label: '🏥 พบแพทย์ / ป่วย', actionValue: 'cat_medical', variant: 'default' },
  { label: '🧳 ธุระส่วนตัว', actionValue: 'cat_personal', variant: 'default' },
  { label: '📁 ธุระแผนกวิชา', actionValue: 'cat_department', variant: 'default' },
  { label: '🚗 ผู้ปกครองมารับ', actionValue: 'cat_parent_pickup', variant: 'default' },
  { label: '🏠 กลับสู่เมนูหลัก', actionValue: 'act_main_menu', variant: 'home' },
];

const DESTINATION_OPTIONS: ChatOption[] = [
  { label: '📍 เลือกบนแผนที่ GPS', actionValue: 'dest_map', variant: 'primary' },
  { label: '🏥 รพ.องครักษ์', actionValue: 'dest_hospital', variant: 'default' },
  { label: '🛍️ ตลาดองครักษ์', actionValue: 'dest_market', variant: 'default' },
  { label: '🏠 คลอง 15', actionValue: 'dest_klong15', variant: 'default' },
  { label: '🏠 คลอง 16', actionValue: 'dest_klong16', variant: 'default' },
  { label: '🏠 กลับสู่เมนูหลัก', actionValue: 'act_main_menu', variant: 'home' },
];

const TIME_OPTIONS: ChatOption[] = [
  { label: '⏰ 12:00 - ไม่กลับ', actionValue: 'time_noon_noreturn', variant: 'default' },
  { label: '⏰ 12:00 - 13:00 น.', actionValue: 'time_lunch', variant: 'default' },
  { label: '⏰ 13:00 - 16:30 น.', actionValue: 'time_afternoon', variant: 'default' },
  { label: '🏠 กลับสู่เมนูหลัก', actionValue: 'act_main_menu', variant: 'home' },
];

const ATTACHMENT_OPTIONS: ChatOption[] = [
  { label: '📎 อัปโหลดรูปใบนัด / แชท', actionValue: 'attach_upload', variant: 'primary' },
  { label: '⏩ ไม่มีเอกสารแนบ (ข้าม)', actionValue: 'attach_skip', variant: 'default' },
  { label: '🏠 กลับสู่เมนูหลัก', actionValue: 'act_main_menu', variant: 'home' },
];

const CONFIRM_OPTIONS: ChatOption[] = [
  { label: '✓ ยืนยันยื่นคำร้อง', actionValue: 'confirm_send', variant: 'success' },
  { label: '🏠 กลับสู่เมนูหลัก', actionValue: 'act_main_menu', variant: 'home' },
];

const FAQ_OPTIONS: ChatOption[] = [
  { label: '🔒 วิธีสแกนใบหน้าเปิดไม้กั้น', actionValue: 'faq_scan', variant: 'default' },
  { label: '⏰ ตารางเวลาอนุญาตให้ออก-เข้า', actionValue: 'faq_time', variant: 'default' },
  { label: '🛡️ กฎการอนุมัติ 5 ขั้นตอน', actionValue: 'faq_rules', variant: 'default' },
  { label: '🏠 กลับสู่เมนูหลัก', actionValue: 'act_main_menu', variant: 'home' },
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

  if (!prev) {
    return { show: true, label: formatFullDateTime(currD) };
  }

  const prevTs = prev.timestamp || currTs;
  const prevD = new Date(prevTs);

  if (currD.toDateString() !== prevD.toDateString() || (curr.dateStr && prev.dateStr && curr.dateStr !== prev.dateStr)) {
    return { show: true, label: formatFullDateTime(currD) };
  }

  if (Math.abs(currTs - prevTs) > 15 * 60 * 1000) {
    return { show: true, label: formatTimeOnly(currD) };
  }

  return { show: false, label: '' };
}

function ChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [currentSlots, setCurrentSlots] = useState<ChatSlots>({});
  const [missingSlots, setMissingSlots] = useState<string[]>([]);
  const [askAttachmentNow, setAskAttachmentNow] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [selectedAttachmentUrl, setSelectedAttachmentUrl] = useState<string | null>(null);
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState<string>('');
  const [showMapPicker, setShowMapPicker] = useState<boolean>(false);
  const [chatMode, setChatMode] = useState<'menu' | 'leave' | 'faq'>('menu');

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const getApproverStep = (role?: string): number => {
    switch (role) {
      case 'subject_teacher': return 1;
      case 'advisor': return 2;
      case 'department_head': return 3;
      case 'discipline': return 4;
      case 'deputy_director': return 5;
      default: return 0;
    }
  };

  const getRoleTitle = (role?: string) => {
    switch (role) {
      case 'subject_teacher': return 'ครูผู้สอน (ขั้นที่ 1)';
      case 'advisor': return 'ครูที่ปรึกษา (ขั้นที่ 2)';
      case 'department_head': return 'หัวหน้าแผนกวิชา (ขั้นที่ 3)';
      case 'discipline': return 'งานปกครอง (ขั้นที่ 4)';
      case 'deputy_director': return 'รองผู้อำนวยการ (ขั้นที่ 5)';
      case 'admin': return 'ผู้ดูแลระบบ (Admin)';
      case 'guard': return 'รปภ. ประตู 1';
      default: return 'นักศึกษา';
    }
  };

  const getRoleTitleForStep = (step: number) => {
    switch (step) {
      case 1: return 'ครูผู้สอนประจำวิชา';
      case 2: return 'ครูที่ปรึกษา';
      case 3: return 'หัวหน้าแผนกวิชา';
      case 4: return 'เจ้าหน้าที่งานปกครอง';
      case 5: return 'รองผู้อำนวยการฝ่ายพัฒนากิจการฯ';
      default: return 'รอดำเนินการ';
    }
  };

  const userStep = getApproverStep(user?.role);
  const isApprover = userStep > 0 || user?.role === 'admin';
  const isGuard = user?.role === 'guard';

  // Smart User Scrolling State
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isUserNearBottomRef = useRef(true);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);
  const prevMessagesCountRef = useRef(messages.length);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const threshold = 120;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= threshold;
    isUserNearBottomRef.current = nearBottom;
    setShowScrollBottomBtn(!nearBottom);
  };

  const scrollToBottom = (force = false, behavior: ScrollBehavior = 'smooth') => {
    if (force || isUserNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior });
      isUserNearBottomRef.current = true;
      setShowScrollBottomBtn(false);
    }
  };

  useEffect(() => {
    if (messages.length > prevMessagesCountRef.current) {
      if (isUserNearBottomRef.current) {
        scrollToBottom(false);
      }
    }
    prevMessagesCountRef.current = messages.length;
  }, [messages.length]);

  // Load API key from localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem('sgp_gemini_api_key');
    if (savedKey) setGeminiApiKey(savedKey);
  }, []);

  // Filter out any legacy mock messages, hardcoded dummy requests, or cross-role leaks
  const cleanLegacyMsgs = (list: ChatMessage[]): ChatMessage[] => {
    return list.filter((m) => {
      if (!m || !m.id) return false;
      const idStr = String(m.id);
      if (idStr.startsWith('req-card-')) return false;
      if (idStr.startsWith('msg-approver-')) return false;
      if (idStr.startsWith('msg-guard-')) return false;
      if (idStr === 'msg-1' || idStr === 'msg-2' || idStr === 'msg-checkin') return false;
      if (idStr === 'welcome-greet' || idStr === 'welcome-options' || idStr === 'welcome-greet-fallback') return false;
      if (idStr.startsWith('welcome-greet-') || idStr.startsWith('welcome-options-')) return false;

      // Filter out teacher greeting/cards from student view
      if (!isApprover && !isGuard) {
        if (m.sender === 'teacher') return false;
        if (m.text && (m.text.includes('ครูประจำวิชา') || m.text.includes('คุณอรรถเดช') || m.text.includes('รอดำเนินการในขั้นของท่าน'))) {
          return false;
        }
      }

      // Filter out student greetings from teacher view
      if (isApprover) {
        if (m.text && m.text.includes('ผมคือน้องเกต AI ผู้ช่วยระบบขออนุญาตออกนอกวิทยาลัย')) {
          return false;
        }
      }

      return true;
    });
  };

  // Helper to ensure only 1 greeting per day exists in history
  const deduplicateDailyGreetings = (list: ChatMessage[], todayStr: string): ChatMessage[] => {
    const seenGreetingDates = new Set<string>();
    const result: ChatMessage[] = [];
    for (let i = list.length - 1; i >= 0; i--) {
      const m = list[i];
      if (typeof m.id === 'string' && m.id.startsWith('greet-')) {
        const dKey = m.dateStr || todayStr;
        if (seenGreetingDates.has(dKey)) {
          continue;
        }
        seenGreetingDates.add(dKey);
      }
      result.unshift(m);
    }
    return result;
  };

  const currentUserId = user?.id || (isApprover ? 'user-teacher-demo' : isGuard ? 'user-guard-demo' : 'user-stu-akkaracha');
  const messagesUserIdRef = useRef<string>(currentUserId);

  // When switching user/role: immediately isolate state so messages don't cross-contaminate
  useEffect(() => {
    if (messagesUserIdRef.current !== currentUserId) {
      messagesUserIdRef.current = currentUserId;
      setMessages([]);
      setCurrentSlots({});
      setMissingSlots([]);
      setShowMapPicker(false);
      setChatMode('menu');
    }
  }, [currentUserId]);

  // One-time client-side purge of legacy mock messages in browser's localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (localStorage.getItem('sgp_chat_clean_v10') !== 'true') {
        Object.keys(localStorage).forEach((key) => {
          if (key.startsWith('sgp_chat_history_')) {
            try {
              const raw = localStorage.getItem(key);
              if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                  const cleaned = cleanLegacyMsgs(parsed);
                  localStorage.setItem(key, JSON.stringify(cleaned));
                }
              }
            } catch {}
          }
        });
        localStorage.setItem('sgp_chat_clean_v10', 'true');
      }
    } catch {}
  }, []);

  // Save chat messages and slots to localStorage when updated
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (messagesUserIdRef.current === currentUserId && messages.length > 0) {
      try {
        localStorage.setItem(`sgp_chat_history_${currentUserId}`, JSON.stringify(messages));
        localStorage.setItem(`sgp_chat_slots_${currentUserId}`, JSON.stringify(currentSlots));
      } catch (e) {
        console.warn('Failed to save chat to localStorage:', e);
      }
    }
  }, [messages, currentSlots, currentUserId]);

  // Create clean daily greeting message based on role
  const createDailyGreeting = (
    targetUser: any,
    targetRole: string | undefined,
    pendingCount: number,
    timeStr: string,
    todayStr: string
  ): ChatMessage => {
    const isTargetGuard = targetRole === 'guard';
    const isTargetApprover = (targetRole && targetRole !== 'student' && targetRole !== 'guard') || targetRole === 'admin';

    if (isTargetApprover) {
      let greetText = `สวัสดีครับ ${targetUser?.full_name || 'คุณครู'} (${getRoleTitle(targetRole)}) 👋`;
      if (pendingCount > 0) {
        greetText += `\n\nวันนี้มีคำร้องขออนุญาตออกนอกสถานศึกษาของนักศึกษารอดำเนินการในขั้นของท่าน (${pendingCount} รายการ) ครับ\nท่านสามารถพิมพ์ "อนุมัติ" หรือสอบถามระบบได้เลยครับ`;
      } else {
        greetText += `\n\nขณะนี้ไม่มีคำร้องค้างรอการพิจารณาครับ มีอะไรให้ผมช่วยประสานงาน พิมพ์แจ้งได้เลยครับ`;
      }
      return {
        id: `greet-${Date.now()}`,
        sender: 'bot',
        text: greetText,
        time: timeStr,
        timestamp: Date.now(),
        dateStr: todayStr,
        poweredBy: 'Google Gemini AI',
      };
    }

    if (isTargetGuard) {
      return {
        id: `greet-${Date.now()}`,
        sender: 'bot',
        text: `สวัสดีครับ ${targetUser?.full_name || 'เจ้าหน้าที่ รปภ.'} ประจำป้อมประตู 1 (วิทยาลัยการอาชีพองครักษ์) 👋\nระบบเชื่อมโยงข้อมูลคำร้องและกล้อง AI สแกนใบหน้าพร้อมทำงานครับ`,
        time: timeStr,
        timestamp: Date.now(),
        dateStr: todayStr,
        poweredBy: 'Google Gemini AI',
      };
    }

    // Default / Student View
    return {
      id: `greet-${Date.now()}`,
      sender: 'bot',
      text: `สวัสดีครับ คุณ ${targetUser?.full_name || 'นักศึกษา'} 👋\nผมคือน้องเกต AI ผู้ช่วยระบบขออนุญาตออกนอกวิทยาลัยและควบคุมไม้กั้นอัตโนมัติ ยินดีให้บริการครับ\nแตะเลือกเมนูด้านล่างหรือพิมพ์ข้อความคุยกับผมได้เลยครับ 🏫`,
      time: timeStr,
      timestamp: Date.now(),
      dateStr: todayStr,
      poweredBy: 'Google Gemini AI',
      options: MAIN_MENU_OPTIONS,
    };
  };

  const handleResetChat = () => {
    if (confirm('คุณต้องการเริ่มการสนทนาใหม่และล้างประวัติแชทใช่หรือไม่?')) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`sgp_chat_history_${currentUserId}`);
        localStorage.removeItem(`sgp_chat_slots_${currentUserId}`);
      }
      setCurrentSlots({});
      setMissingSlots([]);
      setAskAttachmentNow(false);
      setSelectedAttachmentUrl(null);
      setShowMapPicker(false);
      setChatMode('menu');
      const now = new Date();
      const nowTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const freshGreet = createDailyGreeting(user, user?.role, pendingRequests.length, nowTime, todayStr);
      messagesUserIdRef.current = currentUserId;
      setMessages([freshGreet]);
    }
  };

  // Helper: Return to Main Menu
  const handleReturnToMainMenu = () => {
    const now = new Date();
    const nowTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    setShowMapPicker(false);
    setCurrentSlots({});
    setMissingSlots([]);
    setAskAttachmentNow(false);
    setChatMode('menu');

    setMessages((prev) => [
      ...prev,
      {
        id: `stu-menu-${Date.now()}`,
        sender: 'student',
        text: '🏠 กลับสู่เมนูหลัก',
        time: nowTime,
        timestamp: Date.now(),
        dateStr: todayStr,
      },
      {
        id: `bot-menu-${Date.now()}`,
        sender: 'bot',
        text: 'กลับสู่เมนูหลักเรียบร้อยครับ กรุณาเลือกรายการที่ต้องการทำรายการครับ:',
        time: nowTime,
        timestamp: Date.now() + 50,
        dateStr: todayStr,
        poweredBy: 'Google Gemini AI',
        options: MAIN_MENU_OPTIONS,
      },
    ]);
  };

  // Handle In-Chat Capsule Option Click (Self-Disappearing on Select)
  const handleOptionClick = async (messageId: string, opt: ChatOption) => {
    // 1. Immediately remove buttons from previous messages so it leaves pure chat history
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, options: undefined } : m))
    );

    const now = new Date();
    const nowTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // A. Main Menu Action: Return to main menu
    if (opt.actionValue === 'act_main_menu') {
      handleReturnToMainMenu();
      return;
    }

    // B. Main Menu Action: Request Leave
    if (opt.actionValue === 'act_leave') {
      setChatMode('leave');
      setMessages((prev) => [
        ...prev,
        {
          id: `stu-leave-${Date.now()}`,
          sender: 'student',
          text: '🚪 ขออนุญาตออกนอกวิทยาลัย',
          time: nowTime,
          timestamp: Date.now(),
          dateStr: todayStr,
        },
        {
          id: `bot-cat-${Date.now()}`,
          sender: 'bot',
          text: 'รับทราบครับ กรุณาเลือกหมวดหมู่และระบุเหตุผลความจำเป็นในการขอออกนอกวิทยาลัย หรือพิมพ์บอกผมได้เลยครับ:',
          time: nowTime,
          timestamp: Date.now() + 50,
          dateStr: todayStr,
          poweredBy: 'Google Gemini AI',
          options: CATEGORY_OPTIONS,
        },
      ]);
      return;
    }

    // C. Main Menu Action: Check Status
    if (opt.actionValue === 'act_status') {
      setChatMode('menu');
      setMessages((prev) => [
        ...prev,
        {
          id: `stu-status-${Date.now()}`,
          sender: 'student',
          text: '📋 ติดตามสถานะคำร้องของฉัน',
          time: nowTime,
          timestamp: Date.now(),
          dateStr: todayStr,
        },
      ]);

      const studentId = user?.id || 'user-stu-akkaracha';
      try {
        const res = await fetch(`/api/requests?student_id=${studentId}`);
        const data = await res.json();
        if (data.success && data.requests && data.requests.length > 0) {
          const fresh = data.requests[0];
          setLatestRequest(fresh);
          setMessages((prev) => [
            ...prev,
            {
              id: `bot-status-${Date.now()}`,
              sender: 'bot',
              text: `นี่คือข้อมูลสถานะคำร้องล่าสุดของคุณครับ (รหัสคำร้อง #${fresh.request_code}):`,
              time: nowTime,
              timestamp: Date.now(),
              dateStr: todayStr,
              poweredBy: 'Google Gemini AI',
              requestCard: fresh,
              options: [{ label: '🏠 กลับสู่เมนูหลัก', actionValue: 'act_main_menu', variant: 'home' }],
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: `bot-status-empty-${Date.now()}`,
              sender: 'bot',
              text: 'ขณะนี้ยังไม่พบประวัติการยื่นคำร้องของคุณในระบบครับ คุณสามารถแตะเลือก [🚪 ขออนุญาตออกนอกวิทยาลัย] เพื่อเริ่มต้นยื่นคำร้องได้เลยครับ',
              time: nowTime,
              timestamp: Date.now(),
              dateStr: todayStr,
              poweredBy: 'Google Gemini AI',
              options: MAIN_MENU_OPTIONS,
            },
          ]);
        }
      } catch (err) {
        console.error(err);
      }
      return;
    }

    // D. Main Menu Action: FAQ List
    if (opt.actionValue === 'act_faq') {
      setChatMode('faq');
      setMessages((prev) => [
        ...prev,
        {
          id: `stu-faq-${Date.now()}`,
          sender: 'student',
          text: '❓ คำถามที่พบบ่อย (FAQ)',
          time: nowTime,
          timestamp: Date.now(),
          dateStr: todayStr,
        },
        {
          id: `bot-faq-${Date.now()}`,
          sender: 'bot',
          text: 'หัวข้อคำถามที่พบบ่อยและข้อมูลแนะนำการใช้งานระบบ: สามารถแตะเลือกหัวข้อที่ต้องการทราบได้เลยครับ',
          time: nowTime,
          timestamp: Date.now() + 50,
          dateStr: todayStr,
          poweredBy: 'Google Gemini AI',
          options: FAQ_OPTIONS,
        },
      ]);
      return;
    }

    // E. Category Selection
    if (opt.actionValue.startsWith('cat_')) {
      setChatMode('leave');
      let cat: 'medical' | 'personal' | 'department' | 'parent_pickup' = 'personal';
      let catName = 'ธุระส่วนตัว';
      if (opt.actionValue === 'cat_medical') { cat = 'medical'; catName = 'พบแพทย์ / ป่วย'; }
      if (opt.actionValue === 'cat_department') { cat = 'department'; catName = 'ธุระแผนกวิชา'; }
      if (opt.actionValue === 'cat_parent_pickup') { cat = 'parent_pickup'; catName = 'ผู้ปกครองมารับกลับบ้านก่อนเวลา'; }

      const updated = { ...currentSlots, category: cat, reason: catName };
      setCurrentSlots(updated);
      setShowMapPicker(true);

      setMessages((prev) => [
        ...prev,
        {
          id: `stu-cat-choice-${Date.now()}`,
          sender: 'student',
          text: `หมวดหมู่: ${catName}`,
          time: nowTime,
          timestamp: Date.now(),
          dateStr: todayStr,
        },
        {
          id: `bot-dest-${Date.now()}`,
          sender: 'bot',
          text: 'รับทราบหมวดหมู่เรียบร้อยครับ กรุณาระบุพิกัดสถานที่ปลายทางและช่วงเวลาเดินทางในแผนที่ GPS ด้านล่างได้เลยครับ (สามารถพิมพ์ค้นหาหรือลากหมุดได้อย่างอิสระ):',
          time: nowTime,
          timestamp: Date.now() + 50,
          dateStr: todayStr,
          poweredBy: 'Google Gemini AI',
          options: [{ label: '🏠 กลับสู่เมนูหลัก', actionValue: 'act_main_menu', variant: 'home' }],
        },
      ]);
      return;
    }

    // F. Destination Selection: GPS Map Trigger
    if (opt.actionValue === 'dest_map') {
      setShowMapPicker(true);
      setMessages((prev) => [
        ...prev,
        {
          id: `stu-map-${Date.now()}`,
          sender: 'student',
          text: '📍 ปักหมุดบนแผนที่ GPS',
          time: nowTime,
          timestamp: Date.now(),
          dateStr: todayStr,
        },
        {
          id: `bot-map-open-${Date.now()}`,
          sender: 'bot',
          text: 'กำลังเปิดแผนที่ GPS ในห้องแชท กรุณาพิมพ์ค้นหาสถานที่หรือเลื่อนหมุดตามต้องการ แล้วกด [ยืนยันพิกัดจุดหมาย & ช่วงเวลา] ด้านล่างได้เลยครับ',
          time: nowTime,
          timestamp: Date.now() + 50,
          dateStr: todayStr,
          poweredBy: 'Google Gemini AI',
          options: [{ label: '🏠 กลับสู่เมนูหลัก', actionValue: 'act_main_menu', variant: 'home' }],
        },
      ]);
      return;
    }

    // G. Destination Selection: Preset places
    if (opt.actionValue.startsWith('dest_')) {
      let destName = 'โรงพยาบาลองครักษ์';
      let lat = 14.1205;
      let lng = 101.0020;
      let isReturn = 1;

      if (opt.actionValue === 'dest_market') { destName = 'ตลาดองครักษ์'; lat = 14.1220; lng = 101.0050; isReturn = 1; }
      if (opt.actionValue === 'dest_klong15') { destName = 'บ้านพักอาศัย (คลอง 15)'; lat = 14.1120; lng = 100.9450; isReturn = 0; }
      if (opt.actionValue === 'dest_klong16') { destName = 'บ้านพักอาศัย (คลอง 16)'; lat = 14.1350; lng = 100.9200; isReturn = 0; }

      const updated = {
        ...currentSlots,
        destination_name: destName,
        destination_lat: lat,
        destination_lng: lng,
        is_return_required: isReturn,
      };
      setCurrentSlots(updated);

      setMessages((prev) => [
        ...prev,
        {
          id: `stu-dest-choice-${Date.now()}`,
          sender: 'student',
          text: `สถานที่ปลายทาง: ${destName}`,
          time: nowTime,
          timestamp: Date.now(),
          dateStr: todayStr,
        },
        {
          id: `bot-time-${Date.now()}`,
          sender: 'bot',
          text: `บันทึกสถานที่ "${destName}" เรียบร้อยครับ กรุณาระบุช่วงเวลาที่ขอออกและกลับเข้าวิทยาลัย:`,
          time: nowTime,
          timestamp: Date.now() + 50,
          dateStr: todayStr,
          poweredBy: 'Google Gemini AI',
          options: TIME_OPTIONS,
        },
      ]);
      return;
    }

    // H. Time Selection
    if (opt.actionValue.startsWith('time_')) {
      let start = '12:00';
      let end = 'ไม่กลับ';
      let timeText = 'ช่วงพักเที่ยง 12:00 - ไม่กลับเข้าวิทยาลัย';

      if (opt.actionValue === 'time_lunch') {
        start = '12:00'; end = '13:00'; timeText = 'ช่วงพักเที่ยง 12:00 - 13:00 น.';
      }
      if (opt.actionValue === 'time_afternoon') {
        start = '13:00'; end = '16:30'; timeText = 'ช่วงบ่าย 13:00 - 16:30 น.';
      }

      const updated = {
        ...currentSlots,
        allowed_start_time: start,
        allowed_end_time: end,
      };
      setCurrentSlots(updated);
      setAskAttachmentNow(true);

      setMessages((prev) => [
        ...prev,
        {
          id: `stu-time-choice-${Date.now()}`,
          sender: 'student',
          text: `เวลา: ${timeText}`,
          time: nowTime,
          timestamp: Date.now(),
          dateStr: todayStr,
        },
        {
          id: `bot-attach-${Date.now()}`,
          sender: 'bot',
          text: 'บันทึกเวลาเรียบร้อยครับ ท่านมีเอกสารหลักฐานหรือรูปถ่ายใบนัดแพทย์ / แชทผู้ปกครองที่ต้องการแนบเพิ่มเติมหรือไม่ครับ?',
          time: nowTime,
          timestamp: Date.now() + 50,
          dateStr: todayStr,
          poweredBy: 'Google Gemini AI',
          options: ATTACHMENT_OPTIONS,
        },
      ]);
      return;
    }

    // I. Attachment Selection
    if (opt.actionValue === 'attach_upload') {
      fileInputRef.current?.click();
      return;
    }

    if (opt.actionValue === 'attach_skip') {
      setAskAttachmentNow(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `stu-skip-attach-${Date.now()}`,
          sender: 'student',
          text: 'ไม่มีเอกสารแนบครับ (ข้าม)',
          time: nowTime,
          timestamp: Date.now(),
          dateStr: todayStr,
        },
        {
          id: `bot-confirm-${Date.now()}`,
          sender: 'bot',
          text: `สรุปข้อมูลคำร้องขอออกนอกวิทยาลัย:\n• หมวดหมู่: ${currentSlots.reason || 'ธุระจำเป็น'}\n• สถานที่: ${currentSlots.destination_name || 'รพ.องครักษ์'}\n• เวลา: ${currentSlots.allowed_start_time || '12:00'} - ${currentSlots.allowed_end_time || 'ไม่กลับ'} น.\n\nยืนยันส่งคำร้องเข้าสู่สายพานการพิจารณา 5 ขั้นตอนหรือไม่ครับ?`,
          time: nowTime,
          timestamp: Date.now() + 50,
          dateStr: todayStr,
          poweredBy: 'Google Gemini AI',
          options: CONFIRM_OPTIONS,
        },
      ]);
      return;
    }

    // J. Confirm & Submit Request
    if (opt.actionValue === 'confirm_send') {
      await handleSend(undefined, false, undefined, 'ยืนยันยื่นคำร้องครับ');
      return;
    }

    // K. FAQ Topics
    if (opt.actionValue === 'faq_scan') {
      setMessages((prev) => [
        ...prev,
        {
          id: `stu-faq-scan-${Date.now()}`,
          sender: 'student',
          text: 'วิธีสแกนใบหน้าเปิดไม้กั้นประตู 1',
          time: nowTime,
          timestamp: Date.now(),
          dateStr: todayStr,
        },
        {
          id: `bot-faq-ans-scan-${Date.now()}`,
          sender: 'bot',
          text: 'การสแกนใบหน้าเปิดไม้กั้น AI ใช้เทคโนโลยี MediaPipe FaceMesh ตรวจจับ 468 จุดใบหน้า โดยเมื่อคำร้องผ่านการอนุมัติครบ 5 ขั้นแล้ว สามารถเดินมาสแกนที่หน้ากล้อง ณ ป้อม รปภ. ประตู 1 ไม้กั้นจะเปิดอัตโนมัติครับ (มีระบบ Live Trip Mode และกล้องสดตรวจสอบพิกัด GPS ตลอดการเดินทาง)',
          time: nowTime,
          timestamp: Date.now() + 50,
          dateStr: todayStr,
          poweredBy: 'Google Gemini AI',
          options: [{ label: '🏠 กลับสู่เมนูหลัก', actionValue: 'act_main_menu', variant: 'home' }],
        },
      ]);
      return;
    }

    if (opt.actionValue === 'faq_time') {
      setMessages((prev) => [
        ...prev,
        {
          id: `stu-faq-time-${Date.now()}`,
          sender: 'student',
          text: 'ตารางเวลาอนุญาตให้ออก-เข้าวิทยาลัย',
          time: nowTime,
          timestamp: Date.now(),
          dateStr: todayStr,
        },
        {
          id: `bot-faq-ans-time-${Date.now()}`,
          sender: 'bot',
          text: 'ช่วงเวลาที่ได้รับอนุญาตให้ออกนอกสถานศึกษา:\n• ช่วงพักเที่ยง: 12:00 - 13:00 น.\n• ช่วงบ่าย (กรณีมีธุระจำเป็นหรือพบแพทย์ตามนัด): 13:00 - 16:30 น.\nทั้งนี้ต้องผ่านการเห็นชอบจากครูผู้สอนประจำวิชา ครูที่ปรึกษา และงานปกครองครับ',
          time: nowTime,
          timestamp: Date.now() + 50,
          dateStr: todayStr,
          poweredBy: 'Google Gemini AI',
          options: [{ label: '🏠 กลับสู่เมนูหลัก', actionValue: 'act_main_menu', variant: 'home' }],
        },
      ]);
      return;
    }

    if (opt.actionValue === 'faq_rules') {
      setMessages((prev) => [
        ...prev,
        {
          id: `stu-faq-rules-${Date.now()}`,
          sender: 'student',
          text: 'กฎและขั้นตอนการอนุมัติ 5 ระดับ',
          time: nowTime,
          timestamp: Date.now(),
          dateStr: todayStr,
        },
        {
          id: `bot-faq-ans-rules-${Date.now()}`,
          sender: 'bot',
          text: 'สายพานการพิจารณาคำร้อง 5 ระดับ:\n1. ครูประจำวิชา (ตรวจสอบเวลาเรียน)\n2. ครูที่ปรึกษา (รับทราบและยืนยัน)\n3. หัวหน้าแผนกวิชา (พิจารณาความเหมาะสม)\n4. เจ้าหน้าที่งานปกครอง (ตรวจสอบระเบียบวินัย)\n5. รองผู้อำนวยการฯ (อนุมัติขั้นสุดท้าย)\nเมื่ออนุมัติครบ ระบบจะส่งสิทธิ์ไปยังไม้กั้น AI ป้อม รปภ. ทันทีครับ',
          time: nowTime,
          timestamp: Date.now() + 50,
          dateStr: todayStr,
          poweredBy: 'Google Gemini AI',
          options: [{ label: '🏠 กลับสู่เมนูหลัก', actionValue: 'act_main_menu', variant: 'home' }],
        },
      ]);
      return;
    }
  };

  // Helper: Get active options for a message bubble
  // Rule: ONLY the latest message in the conversation displays buttons! Old messages are clean.
  const getOptionsForMessage = (m: ChatMessage, index: number): ChatOption[] | null => {
    if (isApprover || isGuard || m.sender !== 'bot') return null;

    // Only render options on the very latest message
    const isLatest = index === messages.length - 1;
    if (!isLatest) return null;

    // 1. If explicit options are attached
    if (m.options && m.options.length > 0) {
      return m.options;
    }

    // 2. If at FAQ mode
    if (chatMode === 'faq') {
      return FAQ_OPTIONS;
    }

    // 3. If at Leave mode
    if (chatMode === 'leave') {
      if (!currentSlots.category) {
        return CATEGORY_OPTIONS;
      }
      if (!currentSlots.destination_name || !currentSlots.allowed_start_time) {
        return [{ label: '🏠 กลับสู่เมนูหลัก', actionValue: 'act_main_menu', variant: 'home' }];
      }
      if (askAttachmentNow || !currentSlots.attachment_path) {
        return ATTACHMENT_OPTIONS;
      }
      return CONFIRM_OPTIONS;
    }

    // 4. Default: Main Menu Options
    return MAIN_MENU_OPTIONS;
  };

  // Fetch requests based on role with live polling & persistent clean chat history
  useEffect(() => {
    let isCancelled = false;

    async function loadRequests(isPolling = false) {
      try {
        const now = new Date();
        const nowTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

        if (isGuard) {
          const res = await fetch('/api/requests');
          const data = await res.json();
          if (data.success && data.requests && !isCancelled) {
            const allReqs: LeaveRequest[] = data.requests;
            const approvedReqs = allReqs.filter((r) => r.overall_status === 'approved' || r.synced_to_gate === 1);
            const latest = approvedReqs[0] || allReqs[0];
            if (latest) setLatestRequest(latest);

            if (isPolling) {
              setMessages((prev) => {
                const hasChange = prev.some((m) => {
                  if (m.requestCard) {
                    const fresh = allReqs.find((r) => r.id === m.requestCard!.id);
                    return fresh && (fresh.overall_status !== m.requestCard.overall_status || fresh.current_step !== m.requestCard.current_step);
                  }
                  return false;
                });
                if (!hasChange) return prev;
                return prev.map((m) => {
                  if (m.requestCard) {
                    const fresh = allReqs.find((r) => r.id === m.requestCard!.id);
                    if (fresh) return { ...m, requestCard: fresh };
                  }
                  return m;
                });
              });
              return;
            }

            let savedHistory: ChatMessage[] = [];
            const savedHistoryStr = typeof window !== 'undefined' ? localStorage.getItem(`sgp_chat_history_${currentUserId}`) : null;
            const lastGreetDate = typeof window !== 'undefined' ? localStorage.getItem(`sgp_last_greet_date_${currentUserId}`) : null;

            if (savedHistoryStr) {
              try {
                const parsed = JSON.parse(savedHistoryStr);
                if (Array.isArray(parsed)) savedHistory = cleanLegacyMsgs(parsed);
              } catch (e) {
                console.warn('Failed to parse history:', e);
              }
            }

            if (lastGreetDate !== todayStr || savedHistory.length === 0) {
              const dailyGreet = createDailyGreeting(user, user?.role, 0, nowTime, todayStr);
              savedHistory.push(dailyGreet);
              if (typeof window !== 'undefined') {
                localStorage.setItem(`sgp_last_greet_date_${currentUserId}`, todayStr);
              }
            }

            savedHistory = deduplicateDailyGreetings(savedHistory, todayStr);
            messagesUserIdRef.current = currentUserId;
            setMessages(savedHistory);
          }
          return;
        }

        if (isApprover) {
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

            if (isPolling) {
              setMessages((prev) => {
                const hasChange = prev.some((m) => {
                  if (m.requestCard) {
                    const fresh = allReqs.find((r) => r.id === m.requestCard!.id);
                    return fresh && (fresh.overall_status !== m.requestCard.overall_status || fresh.current_step !== m.requestCard.current_step);
                  }
                  return false;
                });
                if (!hasChange) return prev;
                return prev.map((m) => {
                  if (m.requestCard) {
                    const fresh = allReqs.find((r) => r.id === m.requestCard!.id);
                    if (fresh) return { ...m, requestCard: fresh };
                  }
                  return m;
                });
              });
              return;
            }

            let savedHistory: ChatMessage[] = [];
            const savedHistoryStr = typeof window !== 'undefined' ? localStorage.getItem(`sgp_chat_history_${currentUserId}`) : null;
            const lastGreetDate = typeof window !== 'undefined' ? localStorage.getItem(`sgp_last_greet_date_${currentUserId}`) : null;

            if (savedHistoryStr) {
              try {
                const parsed = JSON.parse(savedHistoryStr);
                if (Array.isArray(parsed)) savedHistory = cleanLegacyMsgs(parsed);
              } catch (e) {
                console.warn('Failed to parse history:', e);
              }
            }

            if (lastGreetDate !== todayStr || savedHistory.length === 0) {
              const dailyGreet = createDailyGreeting(user, user?.role, waitingForMe.length, nowTime, todayStr);
              savedHistory.push(dailyGreet);
              if (typeof window !== 'undefined') {
                localStorage.setItem(`sgp_last_greet_date_${currentUserId}`, todayStr);
              }
            }

            savedHistory = savedHistory.map((m) => {
              if (m.requestCard) {
                const fresh = allReqs.find((r) => r.id === m.requestCard!.id);
                if (fresh) return { ...m, requestCard: fresh };
              }
              return m;
            });

            savedHistory = deduplicateDailyGreetings(savedHistory, todayStr);
            messagesUserIdRef.current = currentUserId;
            setMessages(savedHistory);
          }
          return;
        }

        // Student view
        const studentId = user?.id || 'user-stu-akkaracha';
        const res = await fetch(`/api/requests?student_id=${studentId}`);
        const data = await res.json();

        if (data.success && data.requests && data.requests.length > 0) {
          const fresh = data.requests[0];
          setLatestRequest(fresh);
        }

        if (isPolling) {
          if (data.success && data.requests && data.requests.length > 0) {
            const fresh = data.requests[0];
            setMessages((prev) => {
              const hasChange = prev.some(
                (m) =>
                  m.requestCard &&
                  m.requestCard.id === fresh.id &&
                  (m.requestCard.overall_status !== fresh.overall_status ||
                    m.requestCard.current_step !== fresh.current_step)
              );
              if (!hasChange) return prev;
              return prev.map((m) => (m.requestCard && m.requestCard.id === fresh.id ? { ...m, requestCard: fresh } : m));
            });
          }
          return;
        }

        let savedHistory: ChatMessage[] = [];
        const savedHistoryStr = typeof window !== 'undefined' ? localStorage.getItem(`sgp_chat_history_${currentUserId}`) : null;
        const savedSlotsStr = typeof window !== 'undefined' ? localStorage.getItem(`sgp_chat_slots_${currentUserId}`) : null;
        const lastGreetDate = typeof window !== 'undefined' ? localStorage.getItem(`sgp_last_greet_date_${currentUserId}`) : null;

        if (savedHistoryStr) {
          try {
            const parsed = JSON.parse(savedHistoryStr);
            if (Array.isArray(parsed)) savedHistory = cleanLegacyMsgs(parsed);
          } catch (e) {
            console.warn('Failed to parse history:', e);
          }
        }

        if (savedSlotsStr) {
          try { setCurrentSlots(JSON.parse(savedSlotsStr)); } catch {}
        }

        if (lastGreetDate !== todayStr || savedHistory.length === 0) {
          const dailyGreet = createDailyGreeting(user, user?.role, 0, nowTime, todayStr);
          savedHistory.push(dailyGreet);
          if (typeof window !== 'undefined') {
            localStorage.setItem(`sgp_last_greet_date_${currentUserId}`, todayStr);
          }
        }

        if (data.success && data.requests && data.requests.length > 0) {
          const fresh = data.requests[0];
          savedHistory = savedHistory.map((m) =>
            m.requestCard && m.requestCard.id === fresh.id ? { ...m, requestCard: fresh } : m
          );
        }

        savedHistory = deduplicateDailyGreetings(savedHistory, todayStr);
        messagesUserIdRef.current = currentUserId;
        setMessages(savedHistory);
      } catch (err) {
        console.error(err);
        if (!isPolling && !isCancelled) {
          const now = new Date();
          const nowTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
          messagesUserIdRef.current = currentUserId;
          setMessages([createDailyGreeting(user, user?.role, 0, nowTime, todayStr)]);
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
  }, [currentUserId, isApprover, isGuard, userStep]);

  // Teacher Action: Approve or Reject
  const handleTeacherAction = async (requestId: string, action: 'approve' | 'reject') => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await fetch(`/api/requests/${requestId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          approver_id: user?.id || 'demo-teacher',
          step: userStep > 0 ? userStep : 1,
        }),
      });

      const data = await res.json();
      if (data.success && data.request) {
        const updated = data.request;

        playNotificationSound();
        sendSystemNotification({
          title: action === 'approve' ? `✅ อนุมัติสำเร็จ: ${updated.request_code}` : `❌ ปฏิเสธคำร้อง: ${updated.request_code}`,
          body: action === 'approve'
            ? `ส่งต่อให้ขั้นที่ ${updated.current_step} เรียบร้อยแล้ว`
            : `คำร้องถูกยกเลิกแล้ว`,
          url: '/approver',
          tag: `approver-${updated.id}`,
        });

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('sgp_request_updated'));
          localStorage.setItem('sgp_last_action', Date.now().toString());
        }

        setPendingRequests((prev) => prev.filter((r) => r.id !== requestId));

        setMessages((prev) =>
          prev.map((m) => {
            if (m.requestCard && m.requestCard.id === requestId) {
              return { ...m, requestCard: updated };
            }
            return m;
          })
        );

        const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setMessages((prev) => [
          ...prev,
          {
            id: `action-confirm-${Date.now()}`,
            sender: 'bot',
            text: action === 'approve'
              ? `✓ บันทึกการอนุมัติคำร้อง #${updated.request_code} เรียบร้อยแล้วครับ\nระบบได้ส่งคำร้องไปยังขั้นตอนถัดไปอัตโนมัติแล้วครับ`
              : `✕ บันทึกการไม่อนุมัติคำร้อง #${updated.request_code} เรียบร้อยแล้วครับ`,
            time: nowTime,
            poweredBy: 'Google Gemini AI',
          },
        ]);
      } else {
        alert(data.error || 'เกิดข้อผิดพลาดในการบันทึกผลการพิจารณา');
      }
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อ');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Real File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.url) {
        setSelectedAttachmentUrl(data.url);
        setCurrentSlots((prev) => ({ ...prev, attachment_path: data.url }));

        await handleSend(
          undefined,
          false,
          data.url,
          'แนบไฟล์ภาพหลักฐานใบนัดแพทย์ / ภาพหน้าจอแชทผู้ปกครองเรียบร้อยแล้วครับ'
        );
      } else {
        alert(data.error || 'อัปโหลดไฟล์ไม่สำเร็จ');
      }
    } catch (err) {
      console.error('File upload error:', err);
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

    // Detect chatMode switches from userText
    if (/ขออนุญาตออก|ขอออก|ยื่นคำร้อง/i.test(userText)) {
      setChatMode('leave');
    } else if (/เมนูหลัก|หน้าหลัก/i.test(userText)) {
      setChatMode('menu');
    } else if (/คำถาม|faq|วิธีสแกน|ตารางเวลา/i.test(userText)) {
      setChatMode('faq');
    }

    if (/เลือกบนแผนที่|ปักหมุด|เปิดแผนที่|พิกัด/i.test(userText) && !isApprover) {
      setShowMapPicker(true);
    }

    setInput('');
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    isUserNearBottomRef.current = true;
    setTimeout(() => scrollToBottom(true), 50);

    // Approver typed approval words
    if (isApprover) {
      const isApproveCmd = /(อนุมัติ|อนุญาต|ผ่าน|ตกลง|ok|yes)/i.test(userText);
      const isRejectCmd = /(ไม่อนุมัติ|ปฏิเสธ|ไม่อนุญาต|ไม่ให้ไป|ตีกลับ)/i.test(userText);

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

    // Student Chat / General AI QA
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
        let newSlots = currentSlots;
        if (data.slots) {
          newSlots = data.slots;
          setCurrentSlots(data.slots);
        }

        setMissingSlots(data.missing_slots || []);

        if (data.ask_attachment_now) {
          setAskAttachmentNow(true);
        }

        // Determine next in-chat options depending on missing slots
        let nextOptions: ChatOption[] | undefined = undefined;
        if (!isApprover && !isGuard) {
          if (!newSlots.category) {
            nextOptions = CATEGORY_OPTIONS;
          } else if (!newSlots.destination_name || !newSlots.allowed_start_time) {
            setShowMapPicker(true);
            nextOptions = [{ label: '🏠 กลับสู่เมนูหลัก', actionValue: 'act_main_menu', variant: 'home' }];
          } else if (data.ask_attachment_now || (!newSlots.attachment_path && !skipAttachment)) {
            nextOptions = ATTACHMENT_OPTIONS;
          } else {
            nextOptions = CONFIRM_OPTIONS;
          }
        }

        if (data.request) {
          setLatestRequest(data.request);
          setCurrentSlots({});
          setMissingSlots([]);
          setSelectedAttachmentUrl(null);
          setShowMapPicker(false);
          setChatMode('menu');
          nextOptions = [{ label: '🏠 กลับสู่เมนูหลัก', actionValue: 'act_main_menu', variant: 'home' }];

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
            options: nextOptions,
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
            options: [{ label: '🏠 กลับสู่เมนูหลัก', actionValue: 'act_main_menu', variant: 'home' }],
          },
        ]);
      }
    } finally {
      clearTimeout(timeoutId);
      setIsSubmitting(false);
      setTimeout(() => scrollToBottom(false), 80);
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
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center hover:bg-slate-700 shadow-md cursor-pointer"
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
              <span className="text-xs font-bold text-slate-800">เอกสารหลักฐาน / รูปถ่ายเช็คอินพิกัด GPS สด</span>
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
                className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 active:scale-95 text-slate-200 hover:text-white transition-all flex items-center gap-1 text-[11px] font-medium px-2.5 cursor-pointer"
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
                setChatMode('menu');
              }}
              className="text-[10px] text-blue-600 hover:underline font-semibold shrink-0 cursor-pointer"
            >
              เริ่มใหม่
            </button>
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        <div className="w-full max-w-4xl mx-auto space-y-4">
        {messages.map((m, index) => {
          const prev = index > 0 ? messages[index - 1] : undefined;
          const divider = getMessengerDivider(m, prev);
          const activeOptions = getOptionsForMessage(m, index);

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

                      {/* In-Chat Option Cards (Shown ONLY on the active message under AI bubble, matching Image 2) */}
                      {activeOptions && activeOptions.length > 0 && (
                        <div className="space-y-2 mt-3 pt-2.5 border-t border-slate-100 select-none animate-fadeIn">
                          {/* Regular options rendered as vertical cards with ChevronRight */}
                          <div className="space-y-1.5">
                            {activeOptions
                              .filter((opt) => opt.variant !== 'home')
                              .map((opt, oIdx) => (
                                <button
                                  key={oIdx}
                                  type="button"
                                  onClick={() => handleOptionClick(m.id, opt)}
                                  disabled={isSubmitting}
                                  className={`w-full text-left py-2.5 px-3.5 rounded-2xl text-xs font-semibold shadow-2xs border transition-all active:scale-[0.98] cursor-pointer flex items-center justify-between gap-2 group ${
                                    opt.variant === 'primary'
                                      ? 'bg-gradient-to-r from-[#0077D7] to-[#0066CC] hover:from-[#0066CC] hover:to-[#0055AA] text-white border-transparent shadow-xs'
                                      : opt.variant === 'success'
                                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white border-transparent shadow-xs'
                                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 hover:border-blue-300'
                                  }`}
                                >
                                  <span className="truncate">{opt.label}</span>
                                  <ChevronRight className="w-4 h-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
                                </button>
                              ))}
                          </div>

                          {/* Home button (Centered at bottom, like Image 2 and Image 3) */}
                          {activeOptions
                            .filter((opt) => opt.variant === 'home')
                            .map((opt, oIdx) => (
                              <div key={`home-${oIdx}`} className="flex justify-center pt-1">
                                <button
                                  type="button"
                                  onClick={() => handleOptionClick(m.id, opt)}
                                  disabled={isSubmitting}
                                  className="px-4 py-1.5 rounded-full text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 hover:border-slate-300 transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 shadow-2xs"
                                >
                                  <span>{opt.label}</span>
                                </button>
                              </div>
                            ))}
                        </div>
                      )}
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

                      {/* Student Info Box */}
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

                      {/* 3-Point Evidence Timeline */}
                      <div className="bg-white/10 rounded-2xl p-3 border border-white/15 space-y-2">
                        <div className="text-[11px] font-bold text-white flex items-center gap-1.5 border-b border-white/15 pb-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-cyan-300" />
                          <span>ไทม์ไลน์หลักฐาน 3 จุด (3-Point Evidence Timeline)</span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-1">
                          {/* Point 1: Submission Attachment */}
                          <div className="bg-black/20 rounded-xl p-2 border border-white/10 text-center flex flex-col items-center justify-between">
                            <div className="text-[10px] font-bold text-blue-100 mb-1">1. แนบคำร้อง</div>
                            {m.requestCard.attachment_path ? (
                              <div
                                onClick={() => setPreviewModalUrl(m.requestCard!.attachment_path!)}
                                className="cursor-pointer group relative"
                              >
                                <img
                                  src={m.requestCard.attachment_path}
                                  alt="หลักฐานแนบคำร้อง"
                                  className="w-12 h-12 object-cover rounded-lg border border-white/30 group-hover:opacity-80 transition-opacity bg-white"
                                />
                                <span className="block text-[8px] text-emerald-300 font-bold mt-1">แนบแล้ว ✓</span>
                              </div>
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-white/5 border border-dashed border-white/20 flex flex-col items-center justify-center text-white/50 text-[9px]">
                                <span>ไม่มีรูป</span>
                              </div>
                            )}
                          </div>

                          {/* Point 2: Destination Live Camera Check-in */}
                          <div className="bg-black/20 rounded-xl p-2 border border-white/10 text-center flex flex-col items-center justify-between">
                            <div className="text-[10px] font-bold text-blue-100 mb-1">2. เช็คอินปลายทาง</div>
                            {m.requestCard.dest_checkin_photo_path ? (
                              <div
                                onClick={() => setPreviewModalUrl(m.requestCard!.dest_checkin_photo_path!)}
                                className="cursor-pointer group relative"
                              >
                                <img
                                  src={m.requestCard.dest_checkin_photo_path}
                                  alt="ภาพถ่ายสดเช็คอินปลายทาง"
                                  className="w-12 h-12 object-cover rounded-lg border border-white/30 group-hover:opacity-80 transition-opacity bg-white"
                                />
                                <span className="block text-[8px] text-emerald-300 font-bold mt-1">กล้องสด ✓</span>
                              </div>
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-white/5 border border-dashed border-white/20 flex flex-col items-center justify-center text-white/50 text-[9px]">
                                <span>{m.requestCard.checkin_at ? 'เช็คอินแล้ว' : 'รอเดินทาง'}</span>
                              </div>
                            )}
                          </div>

                          {/* Point 3: Return Live Camera Check-in */}
                          <div className="bg-black/20 rounded-xl p-2 border border-white/10 text-center flex flex-col items-center justify-between">
                            <div className="text-[10px] font-bold text-blue-100 mb-1">3. รายงานตัวกลับ</div>
                            {m.requestCard.return_checkin_photo_path ? (
                              <div
                                onClick={() => setPreviewModalUrl(m.requestCard!.return_checkin_photo_path!)}
                                className="cursor-pointer group relative"
                              >
                                <img
                                  src={m.requestCard.return_checkin_photo_path}
                                  alt="ภาพถ่ายสดรายงานตัวกลับ"
                                  className="w-12 h-12 object-cover rounded-lg border border-white/30 group-hover:opacity-80 transition-opacity bg-white"
                                />
                                <span className="block text-[8px] text-emerald-300 font-bold mt-1">กล้องสด ✓</span>
                              </div>
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-white/5 border border-dashed border-white/20 flex flex-col items-center justify-center text-white/50 text-[9px]">
                                <span>
                                  {m.requestCard.is_return_required === 0 ? 'ไม่กลับ' : m.requestCard.return_arrived_at ? 'รายงานตัวแล้ว' : 'รอรายงาน'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

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

        {/* Interactive Leaflet Map Picker inside chat */}
        {!isApprover && !isGuard && showMapPicker && (
          <div className="my-2 px-1 animate-fadeIn">
            <ChatMapPicker
              onSelect={(loc) => {
                const hasPhoto = Boolean(loc.attachmentPath);
                const updated = {
                  ...currentSlots,
                  destination_name: loc.name,
                  destination_lat: loc.lat,
                  destination_lng: loc.lng,
                  is_return_required: loc.isReturnRequired,
                  allowed_start_time: loc.startTime,
                  allowed_end_time: loc.endTime,
                  attachment_path: loc.attachmentPath || currentSlots.attachment_path || null,
                };
                setCurrentSlots(updated);
                setShowMapPicker(false);
                if (loc.attachmentPath) {
                  setSelectedAttachmentUrl(loc.attachmentPath);
                  setAskAttachmentNow(false);
                } else {
                  setAskAttachmentNow(true);
                }

                const now = new Date();
                const nowTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

                const summaryText = `📍 ${loc.name} • เวลา ${loc.startTime} - ${
                  loc.endTime === 'ไม่กลับ' ? 'ไม่กลับเข้าวิทยาลัย' : loc.endTime + ' น.'
                } (${loc.isReturnRequired === 1 ? 'ต้องกลับวิทยาลัย' : 'กลับบ้านเลย'})${
                  hasPhoto ? ' 📎 [แนบภาพหลักฐานแล้ว ✓]' : ''
                }`;

                setMessages((prev) => [
                  ...prev,
                  {
                    id: `stu-loc-time-${Date.now()}`,
                    sender: 'student',
                    text: summaryText,
                    time: nowTime,
                    timestamp: Date.now(),
                    dateStr: todayStr,
                    attachmentUrl: loc.attachmentPath || null,
                  },
                  hasPhoto
                    ? {
                        id: `bot-confirm-${Date.now()}`,
                        sender: 'bot',
                        text: `บันทึกพิกัด ช่วงเวลา และภาพหลักฐานเรียบร้อยครับ ✅\n(สถานที่: ${loc.name} | เวลา: ${
                          loc.startTime
                        } - ${loc.endTime === 'ไม่กลับ' ? 'ไม่กลับเข้าวิทยาลัย' : loc.endTime + ' น.'})\n\nพร้อมยื่นคำร้องขออนุญาตออกนอกวิทยาลัยหรือไม่ครับ?`,
                        time: nowTime,
                        timestamp: Date.now() + 50,
                        dateStr: todayStr,
                        poweredBy: 'Google Gemini AI',
                        options: CONFIRM_OPTIONS,
                      }
                    : {
                        id: `bot-attach-${Date.now()}`,
                        sender: 'bot',
                        text: `บันทึกพิกัดและช่วงเวลาเรียบร้อยครับ ✅\n(สถานที่: ${loc.name} | เวลา: ${
                          loc.startTime
                        } - ${
                          loc.endTime === 'ไม่กลับ' ? 'ไม่กลับเข้าวิทยาลัย' : loc.endTime + ' น.'
                        })\n\nท่านมีเอกสารหลักฐาน เช่น ใบนัดแพทย์ หรือแชทผู้ปกครอง ที่ต้องการแนบเพิ่มเติมหรือไม่ครับ?`,
                        time: nowTime,
                        timestamp: Date.now() + 50,
                        dateStr: todayStr,
                        poweredBy: 'Google Gemini AI',
                        options: ATTACHMENT_OPTIONS,
                      },
                ]);
              }}
              onCancel={() => setShowMapPicker(false)}
              initialLat={currentSlots.destination_lat || undefined}
              initialLng={currentSlots.destination_lng || undefined}
              initialName={currentSlots.destination_name || 'โรงพยาบาลองครักษ์'}
              initialStartTime={currentSlots.allowed_start_time || '12:00'}
              initialEndTime={currentSlots.allowed_end_time || '13:00'}
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

      {/* Hidden File Input for Real File Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Floating Jump-to-Bottom Button */}
      {showScrollBottomBtn && (
        <div className="sticky bottom-20 z-30 flex justify-center pointer-events-none mb-2">
          <button
            type="button"
            onClick={() => scrollToBottom(true)}
            className="pointer-events-auto bg-white/95 hover:bg-white text-[#0066CC] shadow-md border border-blue-200/80 rounded-full px-3.5 py-1.5 text-xs font-bold flex items-center gap-1.5 transition-all active:scale-95 animate-bounce backdrop-blur cursor-pointer"
            title="เลื่อนลงดูข้อความล่าสุด"
          >
            <span>↓ ข้อความล่าสุด</span>
          </button>
        </div>
      )}

      {/* Bottom Input Field Bar (Clean - Zero buttons above keyboard) */}
      <div className="p-3 bg-white border-t border-slate-200/80 sticky bottom-16 z-30">
        <div className="w-full max-w-4xl mx-auto">
          <form onSubmit={(e) => handleSend(e, false)} className="flex items-center gap-2">
          {!isApprover && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-slate-500 hover:text-[#0066CC] transition-colors relative cursor-pointer"
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
                : 'พิมพ์คุยกับน้องเกต AI หรือเลือกหัวข้อด้านบน...'
            }
            className="flex-1 py-2.5 px-4 bg-slate-100 border border-slate-200/60 rounded-2xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0066CC]/20 focus:border-[#0066CC] transition-all"
          />

          <button
            type="submit"
            disabled={!input.trim() || isSubmitting}
            className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all ${
              input.trim()
                ? 'bg-[#0077D7] hover:bg-[#0066CC] text-white shadow-sm cursor-pointer'
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
