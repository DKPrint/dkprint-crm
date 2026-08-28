'use client';

import { useCallback, useState } from 'react';

function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export function PushSubscribeBanner() {
  const supported = isPushSupported();
  const [subscribed, setSubscribed] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subscribe = useCallback(async () => {
    if (!supported) return;
    setError(null);
    setPending(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== 'granted') {
        setError('Разрешите уведомления в браузере');
        return;
      }

      const keyRes = await fetch('/api/push/vapid-public-key', { credentials: 'same-origin' });
      const keyData = (await keyRes.json()) as { publicKey?: string; message?: string };
      if (!keyRes.ok || !keyData.publicKey) {
        setError(keyData.message ?? 'Push не настроен на сервере');
        return;
      }

      const reg = await navigator.serviceWorker.register('/sw.js');
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyData.publicKey) as BufferSource,
      });

      const json = sub.toJSON();
      const res = await fetch('/api/push/subscribe', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: json.keys,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { message?: string };
        setError(data.message ?? 'Не удалось сохранить подписку');
        return;
      }
      setSubscribed(true);
    } catch {
      setError('Не удалось включить уведомления');
    } finally {
      setPending(false);
    }
  }, [supported]);

  if (!supported || subscribed) return null;

  return (
    <div className="push-banner">
      <p className="push-banner-text">Включите push-уведомления о заказах и SLA.</p>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={pending}
        onClick={() => void subscribe()}
      >
        {pending ? '…' : 'Включить'}
      </button>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
