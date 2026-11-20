'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  playNotificationSound,
  sendSystemNotification,
  requestNotificationPermission,
} from '@/lib/notifications';
import { Bell, BellRing, X, ExternalLink, CheckCircle } from 'lucide-react';
import { LeaveRequest } from '@/types';

interface InAppAlert {
  id: string;
  title: string;
  message: string;
  url?: string;
  type: 'info' | 'success' | 'warning';
}

export default function NotificationManager() {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [bannerDismissed, setBannerDismissed] = useState<boolean>(false);
  const [activeAlert, setActiveAlert] = useState<InAppAlert | null>(null);

  // Keep track of notified request events so we never duplicate alerts
  // Format stored: `${requestId}_step${currentStep}_${overallStatus}`
  const seenEventsRef = useRef<Set<string>>(new Set());
  const initialLoadDoneRef = useRef<boolean>(false);

  // 1. Register Service Worker on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if ('Notification' in window) {
      setPermission(Notification.permission);
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('✅ Service Worker registered successfully for Push Notifications:', reg.scope);
        })
        .catch((err) => {
          console.warn('Service Worker registration failed:', err);
        });
    }

    // Load previously seen events from sessionStorage to prevent re-alerting on page refresh
    try {
      const stored = sessionStorage.getItem('sgp_seen_notif_events');
      if (stored) {
        seenEventsRef.current = new Set(JSON.parse(stored));
      }
    } catch {
      // ignore
    }
  }, []);

  // 2. Poll for new requests & status changes
  useEffect(() => {
    if (!user) return;

    let isCancelled = false;

    const checkRequests = async () => {
      try {
        const res = await fetch('/api/requests');
        const data = await res.json();
        if (!data.success || !data.requests || isCancelled) return;

        const allRequests: LeaveRequest[] = data.requests;

        // On first load, record existing request states without popping up notifications
        if (!initialLoadDoneRef.current) {
          allRequests.forEach((r) => {
            const eventKey = `${r.id}_step${r.current_step}_${r.overall_status}`;
            seenEventsRef.current.add(eventKey);
          });
          initialLoadDoneRef.current = true;
          return;
        }

        // Subsequent polls: detect new requests or status changes
        allRequests.forEach((req) => {
          const eventKey = `${req.id}_step${req.current_step}_${req.overall_status}`;
          if (seenEventsRef.current.has(eventKey)) return;

          // Found a new event! Mark as seen immediately
          seenEventsRef.current.add(eventKey);
          try {
            sessionStorage.setItem(
              'sgp_seen_notif_events',
              JSON.stringify(Array.from(seenEventsRef.current))
            );
          } catch {
            // ignore
          }

          // Case A: For Teachers & Approvers (When a student submits or advances to their step)
          if (user.role !== 'student') {
            const isWaitingForThisUser =
              (user.role === 'subject_teacher' && req.current_step === 1 && req.step1_teacher_id === user.id) ||
              (user.role === 'advisor' && req.current_step === 2 && req.step2_advisor_id === user.id) ||
              (user.role === 'dept_head' && req.current_step === 3 && req.step3_dept_head_id === user.id) ||
              (user.role === 'discipline' && req.current_step === 4) ||
              (user.role === 'deputy_director' && req.current_step === 5) ||
              (user.role === 'guard' && req.overall_status === 'approved') ||
              user.role === 'admin';

            // In demo mode or matching role, trigger notification
            if (isWaitingForThisUser || req.overall_status === 'pending') {
              const notifTitle = `🔔 มีคำร้องขอออกใหม่: ${req.student_name || 'นักศึกษา'}`;
              const notifBody = `${req.reason} • ${req.destination_name} (รออนุมัติขั้นที่ ${req.current_step}/5)`;

              // Send system push notification (appears in Android notification drawer)
              sendSystemNotification({
                title: notifTitle,
                body: notifBody,
                url: '/chat',
                tag: `leave-${req.id}-${req.current_step}`,
              });

              // Also show in-app banner
              setActiveAlert({
                id: req.id,
                title: notifTitle,
                message: notifBody,
                url: '/chat',
                type: 'info',
              });
            }
          }

          // Case B: For Student (When their request is approved or rejected)
          if (user.role === 'student' && req.student_id === user.id) {
            if (req.overall_status === 'approved') {
              const notifTitle = '🎉 คำร้องขอออกได้รับอนุมัติแล้ว!';
              const notifBody = `ไม้กั้นพร้อมให้สแกนใบหน้าเพื่อออกได้แล้ว (${req.destination_name})`;

              sendSystemNotification({
                title: notifTitle,
                body: notifBody,
                url: '/chat',
                tag: `leave-approved-${req.id}`,
              });

              setActiveAlert({
                id: req.id,
                title: notifTitle,
                message: notifBody,
                url: '/chat',
                type: 'success',
              });
            } else if (req.overall_status === 'rejected') {
              const notifTitle = '❌ คำร้องขอออกไม่ได้รับอนุมัติ';
              const notifBody = `กรุณาติดต่อครูที่ปรึกษา หรือตรวจสอบเหตุผลในแชท`;

              sendSystemNotification({
                title: notifTitle,
                body: notifBody,
                url: '/chat',
                tag: `leave-rejected-${req.id}`,
              });

              setActiveAlert({
                id: req.id,
                title: notifTitle,
                message: notifBody,
                url: '/chat',
                type: 'warning',
              });
            }
          }
        });
      } catch (err) {
        console.warn('Error polling for notifications:', err);
      }
    };

    // Initial check
    checkRequests();

    // Poll every 3 seconds
    const interval = setInterval(checkRequests, 3000);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [user]);

  // Handle granting permission
  const handleEnableNotifications = async () => {
    const res = await requestNotificationPermission();
    setPermission(res);
    if (res === 'granted') {
      sendSystemNotification({
        title: '🔔 เปิดการแจ้งเตือนสำเร็จ!',
        body: 'ระบบจะเด้งเตือนบนมือถือเมื่อมีคำร้องขอออกใหม่ทันที',
        url: '/chat',
        tag: 'test-welcome',
      });
    }
  };

  // Test Notification Trigger
  const handleTestNotification = () => {
    playNotificationSound();
    sendSystemNotification({
      title: '🔔 ทดสอบการแจ้งเตือน: นายอัครชา เปมะวิภาต',
      body: 'เหตุผล: พบแพทย์ตามนัด (โรงพยาบาลองครักษ์) • รอการพิจารณา',
      url: '/chat',
      tag: `test-${Date.now()}`,
    });

    setActiveAlert({
      id: `test-${Date.now()}`,
      title: '🔔 ทดสอบการแจ้งเตือนสำเร็จ!',
      message: 'มีคำร้องใหม่จาก นายอัครชา เปมะวิภาต (โรงพยาบาลองครักษ์)',
      url: '/chat',
      type: 'info',
    });
  };

  return (
    <>
      {/* 1. In-App Notification Toast Slide-down (when looking at the screen) */}
      {activeAlert && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-[999] w-[92%] max-w-sm animate-in slide-in-from-top-4 duration-300">
          <div className="bg-slate-900/95 backdrop-blur-md text-white p-3.5 rounded-2xl shadow-2xl border border-blue-500/40 flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600/30 border border-blue-400/50 flex items-center justify-center shrink-0 text-blue-400">
              <BellRing className="w-5 h-5 animate-bounce" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-blue-300 truncate">{activeAlert.title}</h4>
                <button
                  onClick={() => setActiveAlert(null)}
                  className="text-slate-400 hover:text-white p-0.5 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5 leading-snug line-clamp-2">
                {activeAlert.message}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <a
                  href={activeAlert.url || '/chat'}
                  onClick={() => setActiveAlert(null)}
                  className="inline-flex items-center gap-1 text-[10px] bg-blue-600 hover:bg-blue-500 text-white font-medium px-2.5 py-1 rounded-lg transition-all"
                >
                  <span>เปิดดูในแชท</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
                <button
                  onClick={() => setActiveAlert(null)}
                  className="text-[10px] text-slate-400 hover:text-slate-200 px-2 py-1"
                >
                  ปิด
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2. Top Permission Request Banner (if notifications not yet allowed) */}
      {permission !== 'granted' && !bannerDismissed && (
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white text-xs px-3 py-2 flex items-center justify-between gap-2 shadow-md z-40 border-b border-blue-500/30">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber-300 shrink-0 animate-pulse" />
            <span className="font-medium">
              เปิดแจ้งเตือนบนมือถือ เพื่อรับข้อความเด้งเมื่อมีคำร้องใหม่
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleEnableNotifications}
              className="bg-amber-400 hover:bg-amber-300 text-slate-900 font-bold px-2.5 py-1 rounded text-[11px] transition-all shadow-sm"
            >
              เปิดใช้งาน
            </button>
            <button
              onClick={() => setBannerDismissed(true)}
              className="text-white/70 hover:text-white p-1"
              title="ปิดชั่วคราว"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 3. Small Floating Demo Test Notification Button (Bottom right above nav) */}
      <div className="fixed bottom-20 right-4 z-40">
        <button
          onClick={handleTestNotification}
          className="bg-slate-900/90 hover:bg-slate-800 text-blue-300 border border-blue-500/40 p-2.5 rounded-full shadow-lg backdrop-blur flex items-center justify-center gap-1 text-xs transition-all active:scale-95 group"
          title="กดเพื่อทดสอบส่งการแจ้งเตือนบนมือถือ (เสียง + แถบ Notification)"
        >
          <BellRing className="w-4 h-4 text-amber-400 group-hover:rotate-12 transition-transform" />
          <span className="text-[10px] font-medium pr-1 text-slate-200 hidden sm:inline">
            ทดสอบแจ้งเตือน
          </span>
        </button>
      </div>
    </>
  );
}
