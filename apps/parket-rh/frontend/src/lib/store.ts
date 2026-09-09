import { useEffect, useState } from "react";

const KEY = "parket-rh-empresa-id";
type Listener = (id: string | null) => void;
const listeners = new Set<Listener>();
let current: string | null = (() => {
  try { return localStorage.getItem(KEY); } catch { return null; }
})();

export function setSelectedEmpresa(id: string | null) {
  current = id;
  try { id ? localStorage.setItem(KEY, id) : localStorage.removeItem(KEY); } catch {}
  listeners.forEach((l) => l(id));
}

export function useSelectedEmpresa(): [string | null, (id: string | null) => void] {
  const [id, setId] = useState<string | null>(current);
  useEffect(() => {
    const listener = (i: string | null) => setId(i);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);
  return [id, setSelectedEmpresa];
}
