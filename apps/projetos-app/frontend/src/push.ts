/* Web Push helpers — registra o service worker, faz subscribe usando a
   chave pública VAPID e manda o endpoint pro backend. Idempotente:
   pode chamar `ensureSubscribed()` sempre que o user logar. */
import { api } from "./api";

const VAPID_PUBLIC = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) || "";

function urlB64ToUint8Array(base64: string): Uint8Array {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export type PushState =
  | { state: "unsupported" }
  | { state: "blocked" }
  | { state: "off" }
  | { state: "on" };

export async function pushState(): Promise<PushState> {
  if (typeof window === "undefined") return { state: "unsupported" };
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return { state: "unsupported" };
  if (Notification.permission === "denied") return { state: "blocked" };
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return { state: "off" };
  const sub = await reg.pushManager.getSubscription();
  return { state: sub ? "on" : "off" };
}

export async function enablePush(): Promise<PushState> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    alert("Seu navegador não suporta notificações web.");
    return { state: "unsupported" };
  }
  if (!VAPID_PUBLIC) {
    alert("Notificações não configuradas (falta VAPID no build).");
    return { state: "off" };
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { state: "blocked" };

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC),
    });
  }
  const j = sub.toJSON();
  await api.pushSubscribe({
    endpoint: sub.endpoint,
    keys: {
      p256dh: (j.keys && (j.keys as any).p256dh) || "",
      auth:   (j.keys && (j.keys as any).auth)   || "",
    },
  });
  return { state: "on" };
}

export async function disablePush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return { state: "off" };
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return { state: "off" };
  try { await api.pushUnsubscribe({ endpoint: sub.endpoint }); } catch {}
  await sub.unsubscribe();
  return { state: "off" };
}
