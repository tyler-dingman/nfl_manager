'use client';

import { useEffect, useState } from 'react';
import { Bell, Check } from 'lucide-react';
import styles from './notification-settings.module.css';
import { useAuthUser } from '@/features/auth/auth-session';

async function saveSubscription(subscription: PushSubscription) {
  const response = await fetch('/api/push/subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription.toJSON()),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Unable to save browser subscription.');
  return result.tokenId as string;
}

export default function BrowserPushSettings() {
  const { user } = useAuthUser();
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [tokenId, setTokenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    setTokenId(null);
    const available =
      window.isSecureContext &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;
    setSupported(available);
    if (!available || !user?.id) {
      setBusy(false);
      return;
    }
    setPermission(Notification.permission);
    setBusy(true);
    void (async () => {
      const response = await fetch('/api/push/subscription', { cache: 'no-store' });
      const config = await response.json();
      if (!response.ok) throw new Error(config.error || 'Unable to load browser notifications.');
      if (!active) return;
      setPublicKey(config.publicKey);
      if (!config.publicKey) return;
      // Restore existing subscriptions without ever asking permission on page load.
      const registration = await navigator.serviceWorker.getRegistration('/');
      if (registration?.active?.scriptURL === new URL('/push-sw.js', window.location.origin).href) {
        await registration.update();
      }
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription && Notification.permission === 'granted' && active) {
        const id = await saveSubscription(subscription);
        if (active) setTokenId(id);
      }
    })()
      .catch((error) => {
        if (active) setMessage(error.message);
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [user?.id]);

  async function enable() {
    setBusy(true);
    setMessage('');
    try {
      // Keep permission request directly in the user gesture, before other async work.
      const granted =
        Notification.permission === 'default'
          ? await Notification.requestPermission()
          : Notification.permission;
      setPermission(granted);
      if (granted !== 'granted') return;
      await navigator.serviceWorker.register('/push-sw.js', { scope: '/', updateViaCache: 'none' });
      const registration = await navigator.serviceWorker.ready;
      const bytes = Uint8Array.from(atob(publicKey!.replace(/-/g, '+').replace(/_/g, '/')), (c) =>
        c.charCodeAt(0),
      );
      let subscription = await registration.pushManager.getSubscription();
      const oldKey = subscription?.options.applicationServerKey;
      if (subscription && oldKey && !new Uint8Array(oldKey).every((v, i) => v === bytes[i])) {
        await subscription.unsubscribe();
        subscription = null;
      }
      subscription ??= await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: bytes,
      });
      setTokenId(await saveSubscription(subscription));
      setMessage('Browser notifications are enabled.');
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Unable to enable browser notifications.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function testPush() {
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch('/api/push/web-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokenId }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(
          result.error ||
            result.reason ||
            'Push delivery failed. Try enabling browser notifications again.',
        );
      setMessage('Test sent. Check your browser or desktop notifications.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to send test.');
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    try {
      const response = await fetch('/api/push/subscription', { method: 'DELETE' });
      if (!response.ok) throw new Error('Unable to disable browser notifications.');
      const registration = await navigator.serviceWorker.getRegistration('/');
      await (await registration?.pushManager.getSubscription())?.unsubscribe();
      setTokenId(null);
      setMessage('Browser notifications are disabled on this browser.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to disable.');
    } finally {
      setBusy(false);
    }
  }

  const buttonClass =
    'team-primary-filled min-h-11 rounded-lg px-4 py-2 text-xs font-bold disabled:opacity-50';
  return (
    <section
      className={`${styles.card} ${styles.header}`}
      aria-labelledby="browser-notifications-heading"
    >
      <Bell aria-hidden="true" />
      <div className={styles.copy}>
        <h2 id="browser-notifications-heading">Browser Notifications</h2>
        <p>Get notified on this browser, even when you’re not on the site.</p>
      </div>
      <div className="flex flex-col gap-2 max-sm:w-full">
        {busy && !publicKey && !tokenId ? (
          <p role="status">Checking browser notifications…</p>
        ) : !supported ? (
          <p className="mt-3 text-sm">
            Browser push requires a supported browser and HTTPS (or localhost).
          </p>
        ) : permission === 'denied' ? (
          <p className="mt-3 text-sm">
            Notifications are blocked. Allow notifications in your browser’s site settings, then
            reload this page.
          </p>
        ) : !publicKey && !busy ? (
          <p className="mt-3 text-sm">Browser notifications are not configured yet.</p>
        ) : (
          <div className="flex flex-wrap items-center gap-2 max-sm:[&>button]:w-full">
            {tokenId ? (
              <>
                <span className="flex w-full items-center gap-2 text-sm font-bold">
                  <Check className="h-4 w-4" /> Notifications Enabled
                </span>
                <button className={buttonClass} disabled={busy} onClick={testPush}>
                  Send Test Notification
                </button>
                <button className={buttonClass} disabled={busy} onClick={disable}>
                  Disable Browser Notifications
                </button>
              </>
            ) : (
              <button
                className={buttonClass}
                disabled={busy || !publicKey || !user}
                onClick={enable}
              >
                Enable Notifications
              </button>
            )}
          </div>
        )}
        {message ? (
          <p role="status" aria-live="polite" className="mt-3 text-sm text-[#40556b]">
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
