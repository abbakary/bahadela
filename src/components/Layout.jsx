import { NavLink, Outlet } from "react-router-dom";
import { useDevice } from "../hooks/useDevice";
import { useDeviceContext } from "../context/DeviceContext";

const links = [
  { to: "/", label: "Home", icon: "⌂" },
  { to: "/users", label: "Users", icon: "☰" },
  { to: "/register", label: "Register", icon: "+" },
  { to: "/reports", label: "Reports", icon: "▦" },
  { to: "/device", label: "Device", icon: "◎" },
];

export default function Layout() {
  const { isMobile } = useDevice();
  const { label, online, device } = useDeviceContext();

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink to="/" className="brand">
          <img src="/BAHDELA-logo.png" alt="Bahdela" onError={(e) => { e.currentTarget.style.display = "none"; }} />
          <div>
            <div className="brand-title">Bahdela</div>
            <small>{isMobile ? "Mobile" : "Desktop"} · Attendance & registration</small>
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
          <strong>{label}</strong>
          <span className="badge warn">{online === false ? "API offline" : device ? "Ready" : "Setup needed"}</span>
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
