type ToastType = "success" | "error" | "info";
type Toast = { id: string; type: ToastType; message: string };
type Listener = (toasts: Toast[]) => void;

let toasts: Toast[] = [];
const listeners = new Set<Listener>();

function notify() { listeners.forEach((l) => l(toasts)); }

export function showToast(type: ToastType, message: string, ms = 3000) {
  const id = Math.random().toString(36).slice(2);
  toasts = [...toasts, { id, type, message }];
  notify();
  setTimeout(() => {
    toasts = toasts.filter((t) => t.id !== id);
    notify();
  }, ms);
}

export const toast = {
  success: (m: string) => showToast("success", m),
  error: (m: string) => showToast("error", m),
  info: (m: string) => showToast("info", m),
};

export function subscribeToasts(l: Listener) {
  listeners.add(l);
  l(toasts);
  return () => { listeners.delete(l); };
}
