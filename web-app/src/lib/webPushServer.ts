// Web Push Notification Server for Smart Gate Pass AI
// Standards-compliant W3C Push Service (FCM, Apple Push Service for iOS 16.4+, Mozilla)

import * as webpush from 'web-push';
import { query, execute } from './db';

const VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  'BBNcMz6a1mBTetLVv97ozWMRvsf9v4pFEAQkAyQwCYUMUzxfHxdxF_PrnHi03QlyoI1h_SM20XcRVV0D6mA0ft4';

const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  'Lb-hrc5taYDljpEdFf8OcTG-kzleWqKNwDsILsvIM5E';

const VAPID_SUBJECT =
  process.env.VAPID_SUBJECT ||
  'mailto:admin@oicec.ac.th';

try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (err) {
  console.warn('Error configuring webpush VAPID details:', err);
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
}

interface StoredSubscription {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Send background push notification to specific users (works even when browser is completely closed)
 */
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<{ success: number; failed: number }> {
  if (!userIds || userIds.length === 0) return { success: 0, failed: 0 };

  const placeholders = userIds.map(() => '?').join(',');
  const subscriptions = query<StoredSubscription>(
    `SELECT * FROM push_subscriptions WHERE user_id IN (${placeholders})`,
    ...userIds
  );

  if (!subscriptions || subscriptions.length === 0) {
    return { success: 0, failed: 0 };
  }

  const payloadString = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url || '/chat',
    tag: payload.tag || `push-${Date.now()}`,
    icon: payload.icon || '/icon.png',
    badge: payload.badge || '/icon.png',
  });

  let successCount = 0;
  let failedCount = 0;

  for (const sub of subscriptions) {
    const pushSub = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.p256dh,
        auth: sub.auth,
      },
    };

    try {
      await webpush.sendNotification(pushSub, payloadString);
      successCount++;
    } catch (err: any) {
      failedCount++;
      // If subscription has expired or unsubscribed (HTTP 410 or 404), clean up from DB
      if (err.statusCode === 410 || err.statusCode === 404) {
        try {
          execute(`DELETE FROM push_subscriptions WHERE endpoint = ?`, sub.endpoint);
        } catch {}
      } else {
        console.warn(`Web push delivery error for user ${sub.user_id}:`, err.message);
      }
    }
  }

  return { success: successCount, failed: failedCount };
}

/**
 * Broadcast background push notification to all subscribers
 */
export async function broadcastPush(payload: PushPayload): Promise<{ success: number; failed: number }> {
  const subscriptions = query<StoredSubscription>(`SELECT * FROM push_subscriptions`);
  if (!subscriptions || subscriptions.length === 0) {
    return { success: 0, failed: 0 };
  }

  const payloadString = JSON.stringify(payload);
  let successCount = 0;
  let failedCount = 0;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payloadString
      );
      successCount++;
    } catch (err: any) {
      failedCount++;
      if (err.statusCode === 410 || err.statusCode === 404) {
        try {
          execute(`DELETE FROM push_subscriptions WHERE endpoint = ?`, sub.endpoint);
        } catch {}
      }
    }
  }

  return { success: successCount, failed: failedCount };
}
