'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import {
  playNotificationSound,
  sendSystemNotification,
  requestNotificationPermission,
  subscribeToPushNotifications,
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
  const [isIosBrowser, setIsIosBrowser] = useState<boolean>(false);

  // Sync push subscription with backend whenever user is logged in and permission is granted
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Detect iOS Safari running outside of PWA standalone mode
    const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    if (isIos && !isStandalone) {
      setIsIosBrowser(true);
    }

    if (user?.id && 'Notification' in window && Notification.permission === 'granted') {
      subscribeToPushNotifications(user.id);
    }
  }, [user?.id]);

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
            const eventKey = `${user.id}_${r.id}_step${r.current_step}_${r.overall_status}`;
            seenEventsRef.current.add(eventKey);
          });
          initialLoadDoneRef.current = true;
          return;
        }

        // Subsequent polls: detect new requests or status changes for the currently logged-in user
        allRequests.forEach((req) => {
          // Key event uniquely by user.id + request.id + current_step + overall_status
          // This allows multi-role testing on one device (switching top bar) as well as multi-device sync
          const eventKey = `${user.id}_${req.id}_step${req.current_step}_${req.overall_status}`;
          if (seenEventsRef.current.has(eventKey)) return;

          // Case A: For Teachers & Approvers (Triggered specifically when it is this role's turn to approve!)
          if (user.role !== 'student') {
            const isMyTurn =
              (user.role === 'subject_teacher' && req.current_step === 1 && req.overall_status === 'pending') ||
              (user.role === 'advisor' && req.current_step === 2 && req.overall_status === 'pending') ||
              (user.role === 'dept_head' && req.current_step === 3 && req.overall_status === 'pending') ||
              (user.role === 'discipline' && req.current_step === 4 && req.overall_status === 'pending') ||
              (user.role === 'deputy_director' && req.current_step === 5 && req.overall_status === 'pending') ||
              (user.role === 'guard' && req.overall_status === 'approved' && req.synced_to_gate === 1) ||
              (user.role === 'admin' && req.overall_status === 'pending');

            if (isMyTurn) {
              // Mark as seen so we don't alert repeatedly
              seenEventsRef.current.add(eventKey);
              try {
                sessionStorage.setItem(
                  'sgp_seen_notif_events',
                  JSON.stringify(Array.from(seenEventsRef.current))
                );
              } catch {
                // ignore
              }

              // Build informative title and message based on the approval step
              let notifTitle = `🔔 มีคำร้องรออนุมัติ: ${req.student_name || 'นักศึกษา'}`;
              let notifBody = `${req.reason} • ${req.destination_name} (รอการพิจารณาในขั้นที่ ${req.current_step}/5)`;

              if (user.role === 'subject_teacher') {
                notifTitle = `🔔 ขั้นที่ 1: นักเรียนขอออกในคาบเรียน (${req.student_name})`;
                notifBody = `เหตุผล: ${req.reason} • ${req.destination_name} รอนายอนุมัติ`;
              } else if (user.role === 'advisor') {
                notifTitle = `🔔 ขั้นที่ 2 (ครูที่ปรึกษา): ส่งต่อคำร้องของ ${req.student_name}`;
                notifBody = `ครูรายวิชาเห็นชอบแล้ว • รอท่าน (ครูที่ปรึกษา) พิจารณา`;
              } else if (user.role === 'dept_head') {
                notifTitle = `🔔 ขั้นที่ 3 (หัวหน้าแผนก): ส่งต่อคำร้องของ ${req.student_name}`;
                notifBody = `ครูที่ปรึกษาเห็นชอบแล้ว • รอหัวหน้าแผนกอนุมัติ`;
              } else if (user.role === 'discipline') {
                notifTitle = `🔔 ขั้นที่ 4 (ฝ่ายปกครอง): ตรวจสอบคำร้องของ ${req.student_name}`;
                notifBody = `ผ่านหัวหน้าแผนกแล้ว • รอฝ่ายปกครองตรวจความประพฤติ`;
              } else if (user.role === 'deputy_director') {
                notifTitle = `🔔 ขั้นที่ 5 (รอง ผอ.): ลงนามขั้นสุดท้าย ${req.student_name}`;
                notifBody = `ผ่านฝ่ายปกครองแล้ว • รอลงนามเพื่อส่งสิทธิ์เปิดไม้กั้น`;
              } else if (user.role === 'guard') {
                notifTitle = `🚗 ป้อมยาม: อนุมัติผ่านครบ 5 ขั้นแล้ว!`;
                notifBody = `${req.student_name} (${req.group_code || 'ปวส.2'}) กำลังมาสแกนหน้าเปิดไม้กั้น`;
              }

              // Send system push notification (appears in Android notification drawer)
              sendSystemNotification({
                title: notifTitle,
                body: notifBody,
                url: '/chat',
                tag: `leave-${req.id}-step-${req.current_step}`,
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

          // Case B: For Student (When their request status advances, is approved, or is rejected)
          if (user.role === 'student' && req.student_id === user.id) {
            seenEventsRef.current.add(eventKey);
            try {
              sessionStorage.setItem(
                'sgp_seen_notif_events',
                JSON.stringify(Array.from(seenEventsRef.current))
              );
            } catch {
              // ignore
            }

            if (req.overall_status === 'approved') {
              const notifTitle = '🎉 คำร้องผ่านครบ 5 ขั้น ได้รับอนุมัติแล้ว!';
              const notifBody = `ระบบส่งสิทธิ์เข้าป้อมยามแล้ว สแกนหน้าเปิดไม้กั้นได้เลย (${req.destination_name})`;

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
              const notifTitle = '❌ คำร้องขอออกไม่ได้รับการอนุมัติ';
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
            } else if (req.overall_status === 'pending' && req.current_step > 1) {
              const notifTitle = `⚡ คำร้องกำลังส่งต่อ: ขั้นที่ ${req.current_step}/5`;
              const notifBody = `คำร้องผ่านขั้นที่ ${req.current_step - 1} แล้ว กำลังรอผู้อนุมัติขั้นถัดไป`;

              sendSystemNotification({
                title: notifTitle,
                body: notifBody,
                url: '/chat',
                tag: `student-progress-${req.id}-${req.current_step}`,
              });

              setActiveAlert({
                id: req.id,
                title: notifTitle,
                message: notifBody,
                url: '/chat',
                type: 'info',
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

    // Instant local and cross-tab event listeners
    const handleInstantUpdate = () => {
      checkRequests();
    };
    window.addEventListener('sgp_request_updated', handleInstantUpdate);
    window.addEventListener('storage', handleInstantUpdate);

    // Poll every 3 seconds for multi-device sync
    const interval = setInterval(checkRequests, 3000);
    return () => {
      isCancelled = true;
      clearInterval(interval);
      window.removeEventListener('sgp_request_updated', handleInstantUpdate);
      window.removeEventListener('storage', handleInstantUpdate);
    };
  }, [user]);

  // Handle granting permission & subscribing to Background Push
  const handleEnableNotifications = async () => {
    const res = await requestNotificationPermission();
    setPermission(res);
    if (res === 'granted') {
      if (user?.id) {
        await subscribeToPushNotifications(user.id);
      }
      sendSystemNotification({
        title: '🔔 เปิดรับการแจ้งเตือนสำเร็จ!',
        body: 'ระบบจะเด้งเตือนบนมือถือเมื่อมีคำร้องใหม่ แม้ไม่ได้เปิดเว็บ',
        url: '/chat',
        tag: 'test-welcome',
      });
    }
  };

  // Test Notification Trigger
  const handleTestNotification = async () => {
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

    // Also send real background push via backend
    if (user?.id) {
      try {
        await fetch('/api/push/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.id }),
        });
      } catch {}
    }
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

      {/* 2.1 iOS Safari PWA Guidance */}
      {isIosBrowser && !bannerDismissed && (
        <div className="bg-slate-900 text-amber-200 text-[11px] px-3 py-1.5 flex items-center justify-between border-b border-amber-500/30">
          <span>🍎 <strong>ผู้ใช้ iPhone:</strong> แตะปุ่มแชร์ด้านล่าง แล้วเลือก <strong>&quot;เพิ่มไปยังหน้าจอโฮม&quot;</strong> เพื่อรับแจ้งเตือนตอนล็อกหน้าจอ</span>
          <button onClick={() => setBannerDismissed(true)} className="text-slate-400 hover:text-white ml-2 p-1">✕</button>
        </div>
      )}
    </>
  );
}
