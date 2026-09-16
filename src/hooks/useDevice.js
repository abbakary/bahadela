import { useEffect, useState } from "react";

function detect() {
  if (typeof window === "undefined") {
    return { isMobile: false, isTablet: false, isDesktop: true };
  }
  const width = window.innerWidth;
  const ua = navigator.userAgent || "";
  const touch = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  const uaMobile = /Android|iPhone|iPod|Windows Phone|Mobile/i.test(ua);
  const uaTablet = /iPad|Tablet|Android(?!.*Mobile)/i.test(ua) || (touch && width >= 768 && width <= 1024);

  const isMobile = width < 768 || (uaMobile && width < 900);
  const isTablet = !isMobile && (uaTablet || (width >= 768 && width < 1024));
  const isDesktop = !isMobile && !isTablet;

  return { isMobile, isTablet, isDesktop, width, touch };
}

export function useDevice() {
  const [info, setInfo] = useState(detect);

  useEffect(() => {
    const onResize = () => setInfo(detect());
    const mq = window.matchMedia("(max-width: 767px)");
    mq.addEventListener?.("change", onResize);
    window.addEventListener("resize", onResize);
    return () => {
      mq.removeEventListener?.("change", onResize);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return info;
}
