'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { LeaveRequest } from '@/types';
import {
  ChevronLeft,
  ScanFace,
  Paperclip,
  Send,
  MapPin,
  CheckCircle2,
  Clock,
  Sparkles,
  ExternalLink,
  Bot,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'student' | 'bot' | 'system';
  text?: string;
  time: string;
  poweredBy?: string;
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
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isSubmitting]);

  // Load API key from localStorage
  useEffect(() => {
    const savedKey = localStorage.getItem('sgp_gemini_api_key');
    if (savedKey) setGeminiApiKey(savedKey);
  }, []);

  // Load existing requests for active student
  useEffect(() => {
    async function loadRequests() {
      try {
        const studentId = user?.id || 'user-stu-akkaracha';
        const res = await fetch(`/api/requests?student_id=${studentId}`);
        const data = await res.json();
        if (data.success && data.requests && data.requests.length > 0) {
          const req = data.requests[0];
          setLatestRequest(req);

          const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          const initialMsgs: ChatMessage[] = [
            {
              id: 'msg-1',
              sender: 'student',
              text: `ขออนุญาตออกนอกสถานศึกษาไป${req.reason} เวลา ${req.allowed_start_time} - ${req.allowed_end_time} น. ครับ (แนบไฟล์เรียบร้อย)`,
              time: req.allowed_start_time || '12:25',
            },
            {
              id: 'msg-2',
              sender: 'bot',
              text: `รับเรื่องเรียบร้อยครับ! ระบบได้สร้างคำร้อง #${req.request_code} และส่งต่อให้ผู้อนุมัติทั้ง 5 ขั้นตอนแล้วครับ`,
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
              text: 'สวัสดีครับ! ผมคือ น้องเกต AI ผู้ช่วยประจำวิทยาลัยการอาชีพองครักษ์ ยินดีช่วยเหลือครับ หากต้องการยื่นขออนุญาตออกนอกวิทยาลัย สามารถพิมพ์แจ้งเหตุผล สถานที่ปลายทาง และเวลาที่ต้องการออกได้เลยครับ',
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
        setInput('ขอไปพบแพทย์ตามนัดที่ โรงพยาบาลองครักษ์ เวลา 13:00 - 15:30 น.');
      } else if (categoryParam === 'personal') {
        setInput('มีธุระส่วนตัวจำเป็นที่ ที่ว่าการอำเภอองครักษ์ เวลา 13:30 - 16:00 น.');
      } else if (categoryParam === 'department') {
        setInput('ไปจัดเตรียมสถานที่และอุปกรณ์นำเสนอโครงงานที่หอประชุมใหญ่');
      } else if (categoryParam === 'parent_pickup') {
        setInput('ผู้ปกครองเดินทางมารับกลับบ้านก่อนเวลา');
      }
    }
  }, [categoryParam]);

  // Send request via Gemini AI chat endpoint
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isSubmitting) return;

    const userText = input.trim();
    setInput('');
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Append student bubble
    const newStudentMsg: ChatMessage = {
      id: `stu-${Date.now()}`,
      sender: 'student',
      text: userText,
      time: nowTime,
    };
    setMessages((prev) => [...prev, newStudentMsg]);
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          apiKey: geminiApiKey,
          student_id: user?.id || 'user-stu-akkaracha',
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (data.request) {
          setLatestRequest(data.request);
        }

        setMessages((prev) => [
          ...prev,
          {
            id: `bot-${Date.now()}`,
            sender: 'bot',
            text: data.reply,
            time: nowTime,
            poweredBy: data.poweredBy,
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
      }
    } catch (err) {
      console.error('GPS Checkin error:', err);
    }
  };

  // Return to college report
  const handleReturnReport = () => {
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMessages((prev) => [
      ...prev,
      {
        id: `return-${Date.now()}`,
        sender: 'student',
        text: 'ตอนนี้ผมเดินทางกลับมาถึงหน้าป้อมยามประตู 1 วิทยาลัยการอาชีพองครักษ์แล้วครับ พร้อมรายงานตัวกลับเข้าวิทยาลัย',
        time: nowTime,
      },
      {
        id: `return-bot-${Date.now()}`,
        sender: 'bot',
        text: 'ระบบตรวจสอบพิกัด Geofencing ยืนยันว่าคุณอยู่ในบริเวณวิทยาลัยการอาชีพองครักษ์แล้ว กรุณาสแกนใบหน้าที่กล้องหน้าป้อมยามเพื่อบันทึกเวลากลับและเปิดไม้กั้นครับ',
        time: nowTime,
        poweredBy: 'Google Gemini AI',
      },
    ]);
  };

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-[#F4F7FB]">
      {/* Header (Matching screen-3-chat.png) */}
      <div className="bg-white px-4 py-3 border-b border-slate-200/80 flex items-center justify-between sticky top-8 z-30 shadow-xs">
        <div className="flex items-center gap-2.5">
          <Link href="/" className="p-1 -ml-1 text-slate-700 hover:text-slate-900">
            <ChevronLeft className="w-6 h-6" />
          </Link>

          {/* AI Messaging Emblem */}
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-b from-[#00A3FF] to-[#0055B3] p-[2px] flex items-center justify-center shadow-xs">
              <div className="w-full h-full rounded-full bg-[#03152B] flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-cyan-400" />
              </div>
            </div>
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-[#10B981] border-2 border-white"></span>
          </div>

          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-bold text-slate-900 leading-tight">AI Messaging</h2>
              <span className="text-[10px] text-[#10B981] font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]"></span>
                Online
              </span>
            </div>
            <p className="text-[10px] text-slate-400">ระบบขออนุญาต & ไม้กั้น AI (Gemini Powered)</p>
          </div>
        </div>

        {/* Top Right "เปิดไม้กั้น" Button */}
        <Link
          href="/gate"
          className="px-3 py-1.5 bg-[#EBF3FC] hover:bg-[#DEEEFC] text-[#0066CC] border border-[#B8D7F9] rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-2xs"
        >
          <ScanFace className="w-4 h-4 text-[#0066CC]" />
          <span>เปิดไม้กั้น</span>
        </Link>
      </div>

      {/* Notice Banner */}
      <div className="px-4 pt-3 pb-1">
        <div className="bg-white rounded-2xl p-3 border border-slate-100 shadow-2xs text-[11px] text-slate-600 leading-relaxed flex items-center justify-between">
          <div>
            <span className="font-bold text-[#0066CC]">น้องเกต AI:</span>{' '}
            พิมพ์แจ้งเหตุผลการขอออกนอกวิทยาลัยได้ตามสบาย ผมจะช่วยสกัดข้อมูลและยื่นคำร้องให้อัตโนมัติครับ
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {messages.map((m) => {
          if (m.sender === 'student') {
            return (
              <div key={m.id} className="flex flex-col items-end">
                <div className="max-w-[85%] bg-[#DCE6F2] text-slate-800 text-xs rounded-2xl rounded-tr-xs px-4 py-3 shadow-2xs leading-relaxed">
                  {m.text}
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
                    <div className="bg-[#0066CC] text-white rounded-3xl p-4 shadow-md w-full">
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="bg-white/20 backdrop-blur-md px-2.5 py-0.5 rounded-full text-[11px] font-semibold">
                          {m.requestCard.overall_status === 'approved'
                            ? 'อนุมัติคำขอแล้ว'
                            : `กำลังพิจารณา (ขั้นที่ ${m.requestCard.current_step}/5)`}
                        </span>
                        <span className="font-mono text-white/80 text-[11px]">{m.requestCard.request_code}</span>
                      </div>

                      <p className="text-xs text-blue-50 leading-relaxed mb-3">
                        บันทึกคำร้องเรียบร้อย ส่งเรื่องต่อไปยังครูประจำวิชาและครูที่ปรึกษา (แผนกเทคโนโลยีธุรกิจดิจิทัล) แล้วครับ
                      </p>

                      <div className="bg-white/10 rounded-2xl p-3 border border-white/15">
                        <div className="flex items-center justify-between text-xs text-white/90 mb-2">
                          <span className="text-[11px]">เวลานัดหมายออก-เข้า:</span>
                          <span className="font-bold">
                            {m.requestCard.allowed_start_time} - {m.requestCard.allowed_end_time} น.
                          </span>
                        </div>

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
          onClick={() => setInput('ขออนุญาตไปพบแพทย์ตามนัดที่ รพ.องครักษ์ บ่ายนี้ครับ')}
          className="px-3 py-1.5 bg-white border border-slate-200/80 rounded-full text-[11px] font-medium text-slate-700 whitespace-nowrap shadow-2xs hover:bg-slate-50 flex items-center gap-1"
        >
          <span>🏥 ขอไปพบแพทย์</span>
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

      {/* Bottom Input Field Bar */}
      <div className="p-3 bg-white border-t border-slate-200/80 sticky bottom-16 z-30">
        <form onSubmit={handleSend} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => alert('จำลองการแนบไฟล์หลักฐาน เช่น ใบนัดแพทย์ หรือหนังสือขออนุญาต')}
            className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
            title="แนบไฟล์หลักฐาน"
          >
            <Paperclip className="w-5 h-5 -rotate-45" />
          </button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="พิมพ์คุยกับน้องเกต AI ได้อย่างอิสระ..."
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
