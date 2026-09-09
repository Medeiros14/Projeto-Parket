import { useEffect, useState } from "react";

export function useMobile(bp = 768): boolean {
  const [m, setM] = useState(() =>
    typeof window !== "undefined" && window.matchMedia(`(max-width: ${bp}px)`).matches);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${bp}px)`);
    const fn = () => setM(mq.matches);
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [bp]);
  return m;
}
