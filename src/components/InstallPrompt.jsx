import { useEffect, useState } from "react";
import { useDevice } from "../hooks/useDevice";

const DISMISS_KEY = "bahdela.install.dismissed";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true
  );
}

function isIos() {
  const ua = window.navigator.userAgent || "";
  return (
    /iPhone|iPad|iPod/i.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** Compact sticky install bar — shows after the main install card is dismissed */
export function InstallBar() {
  const { isMobile } = useDevice();
  const [deferred, setDeferred] = useState(null);
  const [hidden, setHidden] = useState(false);
  const [installed, setInstalled] = useState(() => isStandalone());
  const [iosHelp, setIosHelp] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    try {
      setAllowed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setAllowed(false);
    }
  }, []);

  useEffect(() => {
    if (!isMobile || installed) return;

    const onBip = (e) => {
      e.preventDefault();
      setDeferred(e);
    };
    const onInstalled = () => {
      setInstalled(true);
      setHidden(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);

    const onStorage = () => {
      try {
        setAllowed(localStorage.getItem(DISMISS_KEY) === "1");
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("storage", onStorage);
    const poll = setInterval(onStorage, 800);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("storage", onStorage);
      clearInterval(poll);
    };
  }, [isMobile, installed]);

  if (!isMobile || installed || hidden || !allowed) return null;

  const install = async () => {
    if (deferred) {
      deferred.prompt();
      const choice = await deferred.userChoice;
      setDeferred(null);
      if (choice?.outcome === "accepted") {
        setInstalled(true);
        setHidden(true);
      }
      return;
    }
    setIosHelp(true);
  };

  return (
    <div className="install-bar">
      <img src="/icon-192.png" alt="" className="install-bar-logo" />
      <div className="install-bar-text">
        <strong>Install Bahdela</strong>
        <small>Add Bahdela to your home screen</small>
        {iosHelp ? (
          <small className="install-bar-tip">
            {isIos()
              ? "Tap Share → Add to Home Screen"
              : "Use browser menu → Install app"}
          </small>
        ) : null}
      </div>
      <button type="button" className="btn btn-primary install-bar-btn" onClick={install}>
        Install
      </button>
      <button
        type="button"
        className="install-bar-dismiss"
        aria-label="Dismiss"
        onClick={() => setHidden(true)}
      >
        ×
      </button>
    </div>
  );
}

export default function InstallPrompt() {
  const { isMobile } = useDevice();
  const [deferred, setDeferred] = useState(null);
  const [visible, setVisible] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);
  const [installed, setInstalled] = useState(() => isStandalone());

  useEffect(() => {
    if (!isMobile || installed) return;

    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {
      /* ignore */
    }

    const onBip = (e) => {
      e.preventDefault();
      setDeferred(e);
      setVisible(true);
    };

    const onInstalled = () => {
      setInstalled(true);
      setVisible(false);
      setDeferred(null);
    };

    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);

    const t = setTimeout(() => {
      if (!isStandalone()) setVisible(true);
    }, 900);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
      clearTimeout(t);
    };
  }, [isMobile, installed]);

  if (!isMobile || installed || !visible) return null;

  const dismiss = () => {
    setVisible(false);
    setIosHelp(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  const install = async () => {
    if (deferred) {
      deferred.prompt();
      const choice = await deferred.userChoice;
      setDeferred(null);
      if (choice?.outcome === "accepted") {
        setVisible(false);
        setInstalled(true);
      }
      return;
    }
    setIosHelp(true);
  };

  return (
    <div className="install-backdrop" role="dialog" aria-modal="true" aria-label="Install Bahdela">
      <div className="install-card">
        <button type="button" className="install-close" onClick={dismiss} aria-label="Close">
          ×
        </button>

        <div className="install-store-row">
          <img className="install-logo" src="/icon-192.png" alt="Bahdela" />
          <div className="install-meta">
            <strong className="install-name">Bahdela</strong>
            <span className="install-publisher">Bahdela · Attendance & registration</span>
            <span className="install-rating">★★★★★ · Free</span>
          </div>
        </div>

        <p className="install-desc">
          Install Bahdela on your phone for one-tap access from your home screen.
        </p>

        <div className="install-actions">
          <button type="button" className="btn btn-primary btn-block" onClick={install}>
            Install
          </button>
          <button type="button" className="btn btn-ghost btn-block" onClick={dismiss}>
            Not now
          </button>
        </div>

        {iosHelp ? (
          <div className="install-ios-help">
            {isIos() ? (
              <p>
                On iPhone / iPad: tap <strong>Share</strong>, then{" "}
                <strong>Add to Home Screen</strong>, and confirm with the Bahdela logo.
              </p>
            ) : (
              <p>
                Open your browser menu and choose <strong>Install app</strong> or{" "}
                <strong>Add to Home screen</strong>.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
