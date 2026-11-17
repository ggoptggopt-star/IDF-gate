'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
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
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { LeaveRequest } from '@/types';

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
  sender: 'student' | 'bot' | 'system';
  text?: string;
  time: string;
  poweredBy?: string;
  attachmentUrl?: string | null;
  requestCard?: LeaveRequest;
  checkinCard?: {
    destination: string;
    distance_m: number;
    verified: boolean;
    time: string;
    maps_url: string;
  };
}

function ChatContent() {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category');
  const { user } = useAuth();

  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [latestRequest, setLatestRequest] = useState<LeaveRequest | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [geminiApiKey, setGeminiApiKey] = useState('');
  
  // Slot-Filling State
  const [currentSlots, setCurrentSlots] = useState<ChatSlots>({});
  const [missingSlots, setMissingSlots] = useState<string[]>([]);
  const [askAttachmentNow, setAskAttachmentNow] = useState(false);
  const [selectedAttachmentUrl, setSelectedAttachmentUrl] = useState<string | null>(null);
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // Fetch initial student state and requests
  useEffect(() => {
    async function loadRequests() {
      try {
        const studentId = user?.id || 'user-stu-akkaracha';
        const res = await fetch(`/api/requests?student_id=${studentId}`);
        const data = await res.json();
        const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        if (data.success && data.requests && data.requests.length > 0) {
          const req: LeaveRequest = data.requests[0];
          setLatestRequest(req);

          const initialMsgs: ChatMessage[] = [
            {
              id: 'msg-welcome',
              sender: 'bot',
              text: 'สวัสดีครับ! ผมคือ น้องเกต AI ผู้ช่วยอัจฉริยะประจำวิทยาลัยการอาชีพองครักษ์ ยินดีช่วยเหลือครับ หากต้องการยื่นขออนุญาตออกนอกวิทยาลัย สามารถพิมพ์บอกสถานที่ วันที่ และเวลาได้เลยครับ (เช่น "ขอไปหาหมอที่ รพ.องครักษ์ ตอนเที่ยงวันนี้ครับ")',
              time: req.allowed_start_time || '12:20',
              poweredBy: 'Google Gemini AI',
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
        } else {
          setMessages([
            {
              id: 'msg-welcome',
              sender: 'bot',
              text: 'สวัสดีครับ! ผมคือ น้องเกต AI ผู้ช่วยประจำวิทยาลัยการอาชีพองครักษ์ ยินดีช่วยเหลือครับ หากต้องการยื่นขออนุญาตออกนอกวิทยาลัย สามารถพิมพ์แจ้งเหตุผล สถานที่ วันที่ และเวลาได้เลยครับ (เช่น "ขอไปหาหมอรพ.องครักษ์ตอนเทียง")',
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              poweredBy: 'Google Gemini AI',
            },
          ]);
        }
      } catch (err) {
        console.error(err);
      }
    }

    loadRequests();
  }, [user]);

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
      setIsSubmitting(true);
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.fileUrl) {
        setSelectedAttachmentUrl(data.fileUrl);
        handleSend(undefined, false, data.fileUrl);
      } else {
        alert(data.error || 'อัปโหลดไฟล์ไม่สำเร็จ');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Send request via Gemini AI chat endpoint with Slot-Filling
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
    if (isSubmitting) return;

    setInput('');
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Append student bubble
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
      attachmentUrl: attachUrl || undefined,
    };
    setMessages((prev) => [...prev, newStudentMsg]);
    setIsSubmitting(true);
    setAskAttachmentNow(false);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: bubbleText,
          currentSlots,
          attachment_url: attachUrl,
          skip_attachment: skipAttachment,
          apiKey: geminiApiKey,
          student_id: user?.id || 'user-stu-akkaracha',
        }),
      });

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
          setCurrentSlots({}); // reset slots
          setMissingSlots([]);
          setSelectedAttachmentUrl(null);
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            sender: 'bot',
            text: data.reply,
            time: nowTime,
            poweredBy: data.poweredBy,
            attachmentUrl: data.slots?.attachment_path || undefined,
            requestCard: data.request || undefined,
          },
        ]);
      } else {
        alert(data.error || 'เกิดข้อผิดพลาดในการสนทนากับ AI');
      }
    } catch (err) {
      console.error(err);
    } finally {
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
      <header className="px-4 py-3 bg-[#03152B] text-white flex items-center justify-between sticky top-0 z-30 shadow-sm">
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
            <p className="text-[10px] text-slate-300">ระบบขออนุญาต & ไม้กั้น AI (OICEC)</p>
          </div>
        </div>

        <Link
          href="/gate"
          className="px-3 py-1.5 bg-[#0077D7] hover:bg-[#0066CC] active:scale-95 text-white text-xs font-semibold rounded-full flex items-center gap-1.5 shadow-sm transition-all"
        >
          <ScanFace className="w-3.5 h-3.5" />
          <span>เปิดไม้กั้น</span>
        </Link>
      </header>

      {/* Active Slot-Filling Tracker Banner (If slots partially filled) */}
      {(currentSlots.destination_name || currentSlots.reason || currentSlots.allowed_start_time || currentSlots.leave_date) && !latestRequest?.id && (
        <div className="bg-blue-50 border-b border-blue-200/80 px-4 py-2 flex items-center justify-between text-[11px] animate-fadeIn">
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
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {messages.map((m) => {
          if (m.sender === 'student') {
            return (
              <div key={m.id} className="flex flex-col items-end">
                <div className="max-w-[85%] bg-[#DCE6F2] text-slate-800 text-xs rounded-2xl rounded-tr-xs px-4 py-3 shadow-2xs leading-relaxed space-y-2">
                  <div>{m.text}</div>
                  
                  {/* Student Attached Image Bubble */}
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
            );
          }

          return (
            <div key={m.id} className="flex flex-col items-start max-w-[95%] space-y-2">
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

                  {/* 5-Tier Request Card if created */}
                  {m.requestCard && (
                    <div className="bg-[#0066CC] text-white rounded-3xl p-4 shadow-md w-full space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="bg-white/20 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
                          {m.requestCard.overall_status === 'approved'
                            ? 'อนุมัติคำขอแล้ว'
                            : `กำลังพิจารณา (ขั้นที่ ${m.requestCard.current_step}/5)`}
                        </span>
                        <span className="font-mono text-white/80 text-[11px]">{m.requestCard.request_code}</span>
                      </div>

                      <p className="text-xs text-blue-50 leading-relaxed">
                        บันทึกคำร้องเรียบร้อย ส่งเรื่องต่อไปยังครูประจำวิชาและครูที่ปรึกษา (แผนกเทคโนโลยีธุรกิจดิจิทัล) แล้วครับ
                      </p>

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
                          <span className="text-[11px]">วันที่อนุญาต:</span>
                          <span className="font-bold">
                            {m.requestCard.leave_date}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-xs text-white/90">
                          <span className="text-[11px]">เวลานัดหมายออก-เข้า:</span>
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

                        <Link
                          href="/gate"
                          className="w-full py-2.5 bg-white hover:bg-blue-50 text-[#0066CC] text-xs font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all"
                        >
                          <ScanFace className="w-4 h-4 text-[#0066CC]" />
                          <span>สแกนใบหน้าเพื่อเปิดไม้กั้นอัตโนมัติ</span>
                        </Link>
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
          );
        })}

        {/* AI Typing Indicator */}
        {isSubmitting && (
          <div className="flex items-start gap-2 max-w-[85%] animate-fadeIn">
            <div className="w-7 h-7 rounded-full bg-[#03152B] flex items-center justify-center shrink-0 mt-1 text-cyan-400">
              <Sparkles className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-white text-slate-600 text-xs rounded-2xl rounded-tl-xs px-4 py-3 shadow-2xs border border-slate-100 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-500 animate-ping"></span>
              <span>น้องเกต AI กำลังคิดคำตอบและวิเคราะห์คำขอ...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Smart Quick Replies when Date or Time is Missing */}
      {missingSlots.length > 0 && !askAttachmentNow && (
        <div className="px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-blue-50/80 border-t border-blue-100">
          <span className="text-[10px] font-bold text-blue-800 shrink-0">คำตอบด่วน:</span>
          
          {/* Date Suggestions */}
          {missingSlots.includes('date') && (
            <>
              <button
                onClick={() => handleSend(undefined, false, undefined, 'วันนี้ครับ')}
                className="px-2.5 py-1 bg-white hover:bg-blue-100 border border-blue-200 rounded-full text-[11px] font-semibold text-blue-800 shrink-0 shadow-2xs transition-all"
              >
                📅 วันนี้
              </button>
              <button
                onClick={() => handleSend(undefined, false, undefined, 'พรุ่งนี้ครับ')}
                className="px-2.5 py-1 bg-white hover:bg-blue-100 border border-blue-200 rounded-full text-[11px] font-semibold text-blue-800 shrink-0 shadow-2xs transition-all"
              >
                📅 พรุ่งนี้
              </button>
            </>
          )}

          {/* Return Time Suggestions (Never guess!) */}
          {missingSlots.includes('return_time') && (
            <>
              <button
                onClick={() => handleSend(undefined, false, undefined, 'กลับ 13:30 น. ครับ')}
                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-full text-[11px] font-semibold text-amber-900 shrink-0 shadow-2xs transition-all"
              >
                🕒 กลับ 13:30 น.
              </button>
              <button
                onClick={() => handleSend(undefined, false, undefined, 'กลับบ่ายสอง (14:00 น.) ครับ')}
                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-full text-[11px] font-semibold text-amber-900 shrink-0 shadow-2xs transition-all"
              >
                🕒 กลับบ่ายสอง (14:00 น.)
              </button>
              <button
                onClick={() => handleSend(undefined, false, undefined, 'กลับบ่ายสาม (15:00 น.) ครับ')}
                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-full text-[11px] font-semibold text-amber-900 shrink-0 shadow-2xs transition-all"
              >
                🕒 กลับบ่ายสาม (15:00 น.)
              </button>
              <button
                onClick={() => handleSend(undefined, false, undefined, 'กลับ 15:30 น. ครับ')}
                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-full text-[11px] font-semibold text-amber-900 shrink-0 shadow-2xs transition-all"
              >
                🕒 กลับ 15:30 น.
              </button>
              <button
                onClick={() => handleSend(undefined, false, undefined, 'กลับ 16:30 น. (เลิกเรียน) ครับ')}
                className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-full text-[11px] font-semibold text-amber-900 shrink-0 shadow-2xs transition-all"
              >
                🕒 กลับ 16:30 น. (เลิกเรียน)
              </button>
            </>
          )}

          {/* Departure Time Suggestions */}
          {missingSlots.includes('start_time') && (
            <>
              <button
                onClick={() => handleSend(undefined, false, undefined, 'ออกตอนเทียงครับ')}
                className="px-2.5 py-1 bg-white hover:bg-blue-100 border border-blue-200 rounded-full text-[11px] font-semibold text-blue-800 shrink-0 shadow-2xs transition-all"
              >
                🕛 ออกตอนเที่ยง (12:00)
              </button>
              <button
                onClick={() => handleSend(undefined, false, undefined, 'ออกช่วงบ่ายครับ')}
                className="px-2.5 py-1 bg-white hover:bg-blue-100 border border-blue-200 rounded-full text-[11px] font-semibold text-blue-800 shrink-0 shadow-2xs transition-all"
              >
                🕐 ออกช่วงบ่าย (13:00)
              </button>
              <button
                onClick={() => handleSend(undefined, false, undefined, 'ออกช่วงเช้าครับ')}
                className="px-2.5 py-1 bg-white hover:bg-blue-100 border border-blue-200 rounded-full text-[11px] font-semibold text-blue-800 shrink-0 shadow-2xs transition-all"
              >
                🌅 ออกช่วงเช้า (08:30)
              </button>
            </>
          )}

          {/* Destination Quick suggestions */}
          {missingSlots.includes('destination') && (
            <>
              <button
                onClick={() => handleSend(undefined, false, undefined, 'ไปโรงพยาบาลองครักษ์ครับ')}
                className="px-2.5 py-1 bg-white hover:bg-blue-100 border border-blue-200 rounded-full text-[11px] font-semibold text-blue-800 shrink-0 shadow-2xs transition-all"
              >
                🏥 รพ.องครักษ์
              </button>
              <button
                onClick={() => handleSend(undefined, false, undefined, 'ไปที่ว่าการอำเภอองครักษ์ครับ')}
                className="px-2.5 py-1 bg-white hover:bg-blue-100 border border-blue-200 rounded-full text-[11px] font-semibold text-blue-800 shrink-0 shadow-2xs transition-all"
              >
                💼 ที่ว่าการอำเภอ
              </button>
            </>
          )}
        </div>
      )}

      {/* Special Slot-Filling Prompt: Attachment Options Bar */}
      {askAttachmentNow && (
        <div className="mx-3 mb-2 p-3 bg-amber-50 border border-amber-200 rounded-2xl shadow-sm animate-fadeIn space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-amber-900">
            <span className="flex items-center gap-1.5">
              <Paperclip className="w-4 h-4 text-amber-700" />
              <span>แนบหลักฐาน (ถ้ามี) หรือกดส่งคำขอได้เลย:</span>
            </span>
            <span className="text-[10px] text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full font-semibold">
              ขั้นตอนสุดท้าย
            </span>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-xs">
            {/* Quick Demo Attachment 1 */}
            <button
              onClick={() => handleSend(undefined, false, '/uploads/attachments/doctor-note.svg')}
              className="p-2 bg-white hover:bg-amber-100/70 border border-amber-200 rounded-xl text-left transition-all flex items-center gap-2 text-slate-800"
            >
              <span className="text-base">🏥</span>
              <div className="leading-tight truncate">
                <span className="font-bold text-[11px] block">แนบใบนัดแพทย์</span>
                <span className="text-[9px] text-slate-400">รพ.องครักษ์ (ตัวอย่าง)</span>
              </div>
            </button>

            {/* Quick Demo Attachment 2 */}
            <button
              onClick={() => handleSend(undefined, false, '/uploads/attachments/parent-chat.svg')}
              className="p-2 bg-white hover:bg-amber-100/70 border border-amber-200 rounded-xl text-left transition-all flex items-center gap-2 text-slate-800"
            >
              <span className="text-base">💬</span>
              <div className="leading-tight truncate">
                <span className="font-bold text-[11px] block">แนบแชทผู้ปกครอง</span>
                <span className="text-[9px] text-slate-400">รูปยืนยันจากแม่ (ตัวอย่าง)</span>
              </div>
            </button>
          </div>

          {/* Skip Button (ไม่มีเอกสารแนบ) */}
          <button
            onClick={() => handleSend(undefined, true)}
            className="w-full py-2 bg-amber-600 hover:bg-amber-700 active:scale-[0.99] text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>ไม่มีเอกสารแนบ — ส่งคำขออนุมัติทันที</span>
          </button>
        </div>
      )}

      {/* Quick Chips Row (Above Input Bar) */}
      <div className="px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto no-scrollbar bg-[#F4F7FB]">
        <Link
          href="/gate"
          className="px-3 py-1.5 bg-white border border-slate-200/80 rounded-full text-[11px] font-medium text-slate-700 whitespace-nowrap shadow-2xs hover:bg-slate-50 flex items-center gap-1"
        >
          <span>🔒 สแกนใบหน้าเปิดไม้กั้น</span>
        </Link>

        <button
          onClick={handleGpsCheckin}
          className="px-3 py-1.5 bg-white border border-emerald-200 rounded-full text-[11px] font-medium text-emerald-800 whitespace-nowrap shadow-2xs hover:bg-emerald-50 flex items-center gap-1"
        >
          <span>📍 เช็คอินถึงจุดหมาย</span>
        </button>

        <button
          onClick={() => setInput('ขอไปพบแพทย์ตามนัดที่ รพ.องครักษ์ ตอนเทียงวันนี้ครับ')}
          className="px-3 py-1.5 bg-white border border-slate-200/80 rounded-full text-[11px] font-medium text-slate-700 whitespace-nowrap shadow-2xs hover:bg-slate-50 flex items-center gap-1"
        >
          <span>🏥 ขอไปพบแพทย์ (ตอนเที่ยง)</span>
        </button>

        <button
          onClick={() => setInput('ขั้นตอนการขออนุญาตออกนอกวิทยาลัยต้องทำยังไงบ้างครับ?')}
          className="px-3 py-1.5 bg-white border border-slate-200/80 rounded-full text-[11px] font-medium text-slate-700 whitespace-nowrap shadow-2xs hover:bg-slate-50 flex items-center gap-1"
        >
          <span>❓ ถามขั้นตอน 5 ขั้น</span>
        </button>

        <button
          onClick={handleReturnReport}
          className="px-3 py-1.5 bg-white border border-blue-200 rounded-full text-[11px] font-medium text-[#0066CC] whitespace-nowrap shadow-2xs hover:bg-blue-50 flex items-center gap-1"
        >
          <span>✅ รายงานตัวกลับเข้าวิทยาลัย</span>
        </button>
      </div>

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
        <form onSubmit={(e) => handleSend(e, false)} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-slate-500 hover:text-[#0066CC] transition-colors relative"
            title="แนบรูปถ่ายใบนัดแพทย์หรือแชทผู้ปกครองจากเครื่อง"
          >
            <Paperclip className="w-5 h-5 -rotate-45" />
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="พิมพ์คุยกับน้องเกต AI เช่น ขอออกไปไหน ตอนเทียง วันไหน..."
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
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center text-xs text-slate-400">กำลังโหลดระบบแชท AI...</div>}>
      <ChatContent />
    </Suspense>
  );
}
