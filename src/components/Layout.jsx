import { NavLink, Outlet } from "react-router-dom";
import { useDevice } from "../hooks/useDevice";
import { useDeviceContext } from "../context/DeviceContext";
import { siteDisplayName } from "./SitePicker";

const links = [
  { to: "/", label: "Home", icon: "⌂" },
  { to: "/users", label: "Users", icon: "☰" },
  { to: "/register", label: "Register", icon: "+" },
  { to: "/reports", label: "Reports", icon: "▦" },
  { to: "/device", label: "Device", icon: "◎" },
];

function looksLikeHost(value) {
  return /\d{1,3}(\.\d{1,3}){3}|:\/\/|:\d{2,5}\b/i.test(String(value || ""));
}

export default function Layout() {
  const { isMobile } = useDevice();
  const { label, online, device } = useDeviceContext();

  let bannerLabel = "No site selected";
  if (device?.mode === "site") {
    bannerLabel = siteDisplayName({
      label: device.site_label,
      name: device.site_name,
    });
    if (looksLikeHost(bannerLabel)) bannerLabel = device.site_name || "Site";
  } else if (device?.mode === "custom") {
    bannerLabel = "Custom device";
  } else if (label && !looksLikeHost(label)) {
    bannerLabel = label;
  }

  return (
    <div className="app-shell">
      <header className={`topbar ${isMobile ? "topbar-mobile" : ""}`}>
        <NavLink to="/" className="brand">
          <img
            src="/BAHDELA-logo.png"
            alt=""
            onError={(e) => {
              e.currentTarget.style.display = "none";
            }}
          />
          <div className="brand-text">
            <div className="brand-title">Bahdela</div>
            <small>
              <span className="mode-label mode-mobile">Mobile</span>
              <span className="mode-label mode-desktop">Desktop</span>
              {" · Attendance & registration"}
            </small>
          </div>
        </NavLink>
        <nav className="desktop-nav" aria-label="Main">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === "/"}>
              {l.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="main">
        <div className={`device-banner ${online === false ? "offline" : device ? "online" : ""}`}>
          <span className="dot" aria-hidden />
          <strong>{bannerLabel}</strong>
          <span className="badge warn">
            {online === false ? "API offline" : device ? "Ready" : "Setup needed"}
          </span>
        </div>
        <Outlet />
      </main>

      {isMobile ? (
        <nav className="mobile-nav" aria-label="Mobile">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === "/"}>
              <span className="icon">{l.icon}</span>
              {l.label}
            </NavLink>
          ))}
        </nav>
      ) : null}
    </div>
  );
}
