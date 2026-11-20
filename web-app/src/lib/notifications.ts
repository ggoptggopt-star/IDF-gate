// Notification and Sound Dispatcher for Smart Gate Pass AI
// Supports Mobile Push (Notification Drawer), Sound Bell Chimes, and Vibration

// Synthesize pleasant two-tone bell chime using Web Audio API
export function playNotificationSound() {
  if (typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    
    // Tone 1 (High, crisp bell)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, ctx.currentTime); // A5
    osc1.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
    gain1.gain.setValueAtTime(0.3, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.35);

    // Tone 2 (Harmonic resonate)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1760, ctx.currentTime + 0.08);
    gain2.gain.setValueAtTime(0.2, ctx.currentTime + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.08);
    osc2.stop(ctx.currentTime + 0.5);
  } catch (err) {
    console.warn('AudioContext playback error (safe to ignore):', err);
  }
}

// Request permission for system notifications
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.error('Failed to request notification permission:', err);
    return 'denied';
  }
}

interface NotificationOptions {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

// Send system notification (Drawer Notification on Android / Desktop)
export async function sendSystemNotification({
  title,
  body,
  url = '/chat',
  tag,
}: NotificationOptions) {
  if (typeof window === 'undefined') return;

  // 1. Play chime sound
  playNotificationSound();

  // 2. Vibrate phone (pattern: vibrate 200ms, pause 100ms, vibrate 200ms)
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      navigator.vibrate([200, 100, 200]);
    } catch {
      // ignore
    }
  }

  // 3. Dispatch system notification
  if ('Notification' in window && Notification.permission === 'granted') {
    try {
      // Prefer Service Worker registration showNotification (required on Android Chrome)
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.ready;
        if (registration && registration.showNotification) {
          await registration.showNotification(title, {
            body,
            icon: '/icon.png',
            badge: '/icon.png',
            vibrate: [250, 100, 250],
            tag: tag || `req-${Date.now()}`,
            data: { url },
          } as any);
          return;
        }
      }

      // Fallback to standard window Notification
      new Notification(title, {
        body,
        icon: '/icon.png',
        tag: tag || `req-${Date.now()}`,
      });
    } catch (err) {
      console.warn('Could not display system notification:', err);
    }
  }
}
