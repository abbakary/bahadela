import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { getCachedFaceUrl, setCachedFaceUrl } from "../lib/usersCache";

/**
 * Loads face photos only when the avatar scrolls into view.
 * Reuses in-memory object URLs so revisiting a row is instant.
 */
export default function FacePhoto({ device, employeeNo, alt = "", className = "", enabled = true }) {
  const rootRef = useRef(null);
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState(() => (enabled ? getCachedFaceUrl(device, employeeNo) : ""));
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setMissing(true);
      setLoading(false);
      return undefined;
    }
    const node = rootRef.current;
    if (!node) return undefined;

    const cached = getCachedFaceUrl(device, employeeNo);
    if (cached) {
      setUrl(cached);
      setMissing(false);
      setVisible(true);
      return undefined;
    }

    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return undefined;
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "120px 0px", threshold: 0.01 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [device, employeeNo, enabled]);

  useEffect(() => {
    let cancelled = false;
    if (!enabled || !device || !employeeNo || !visible) return undefined;

    const cached = getCachedFaceUrl(device, employeeNo);
    if (cached) {
      setUrl(cached);
      setMissing(false);
      setLoading(false);
      return undefined;
    }

    setLoading(true);
    setMissing(false);

    (async () => {
      try {
        const blob = await api.getUserFaceBlob(device, employeeNo);
        if (cancelled) return;
        const objectUrl = URL.createObjectURL(blob);
        setCachedFaceUrl(device, employeeNo, objectUrl);
        setUrl(objectUrl);
      } catch {
        if (!cancelled) {
          setMissing(true);
          setUrl("");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [device, employeeNo, enabled, visible]);

  return (
    <div ref={rootRef} className={`face-photo-host ${className}`.trim()}>
      {loading ? <div className="face-photo-skeleton" aria-hidden /> : null}
      {!loading && (missing || !url) ? (
        <div className="face-photo-empty">
          <span>No photo</span>
        </div>
      ) : null}
      {!loading && url ? <img src={url} alt={alt} /> : null}
    </div>
  );
}
