// Push notification setup. Works on Android, desktop browsers, and iPhone/iPad once the app
// has been added to the home screen (iOS 16.4+).
import { VAPID_PUBLIC_KEY } from '../config.js';

export function pushSupport() {
  const hasApi = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return {
    hasApi,
    isIOS,
    standalone,
    needsInstall: isIOS && !standalone,
    permission: 'Notification' in window ? Notification.permission : 'unsupported',
    configured: Boolean(VAPID_PUBLIC_KEY)
  };
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function enablePush(store) {
  const s = pushSupport();
  if (!s.hasApi) throw new Error('This browser does not support push notifications.');
  if (s.needsInstall) throw new Error('On iPhone, first add the app to your home screen (Share → Add to Home Screen), then open it from there.');
  if (!s.configured) throw new Error('Notifications are not set up on the server yet.');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications were not allowed. You can change this in your browser or phone settings.');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
  const json = sub.toJSON();
  if (store.kind === 'supabase') {
    const { error } = await store.client.from('push_subscriptions').upsert(
      { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, user_agent: navigator.userAgent.slice(0, 200) },
      { onConflict: 'endpoint' }
    );
    if (error) throw new Error(error.message);
  }
  return true;
}

export async function testNotification() {
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification('Rise & Fizz', { body: 'Notifications are working. Bubbles incoming!', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png' });
}

// Is this device set up to receive reminders? 'on' | 'off' | 'blocked' | 'install' | 'unsupported'
export async function pushStatus() {
  const s = pushSupport();
  if (s.needsInstall) return 'install';
  if (!s.hasApi || !s.configured) return 'unsupported';
  if (s.permission === 'denied') return 'blocked';
  if (s.permission !== 'granted') return 'off';
  try {
    const reg = await navigator.serviceWorker.ready;
    return (await reg.pushManager.getSubscription()) ? 'on' : 'off';
  } catch { return 'off'; }
}
