"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CompetitionLogo } from "@/components/common/competition-logo";

export function RouteProgress() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const navigationStarted = useRef(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!navigationStarted.current) return;
    navigationStarted.current = false;
    setProgress(100);
    finishTimer.current = setTimeout(() => setProgress(0), 240);
    return () => { if (finishTimer.current) clearTimeout(finishTimer.current); };
  }, [pathname]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(target instanceof HTMLAnchorElement) || target.target === "_blank" || target.hasAttribute("download")) return;
      const next = new URL(target.href, window.location.href);
      if (next.origin !== window.location.origin || next.pathname === window.location.pathname) return;
      navigationStarted.current = true;
      if (timer.current) clearInterval(timer.current);
      setProgress((current) => current > 0 ? current : 8);
      timer.current = setInterval(() => setProgress((current) => Math.min(current + Math.max((92 - current) * 0.12, 1), 92)), 180);
    };
    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      if (timer.current) clearInterval(timer.current);
      if (finishTimer.current) clearTimeout(finishTimer.current);
    };
  }, []);

  useEffect(() => {
    if (progress === 100 && timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, [progress]);

  if (progress === 0) return null;
  return (
    <div className="route-progress" aria-label="Loading page" role="status">
      <div className="route-progress__glow" />
      <div className="route-progress__bar" style={{ transform: `scaleX(${progress / 100})` }} />
      <CompetitionLogo size={24} animated className="route-progress__crest" />
      <span className="sr-only">Loading page</span>
    </div>
  );
}
