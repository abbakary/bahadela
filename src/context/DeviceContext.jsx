import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { loadDevice, saveDevice } from "../api/client";

const DeviceContext = createContext(null);

export function DeviceProvider({ children }) {
  const [device, setDeviceState] = useState(() => loadDevice());
  const [online, setOnline] = useState(null);

  const setDevice = (next) => {
    setDeviceState(next);
    saveDevice(next);
    setOnline(null);
  };

  const label = useMemo(() => {
    if (!device) return "No device selected";
    if (device.mode === "site") return `${device.site_label || device.site_name} · ${device.device_ip || ""}`;
    return device.base_url || "Custom device";
  }, [device]);

  useEffect(() => {
    // Soft health ping for API availability only
    fetch("/api/health")
      .then((r) => setOnline(r.ok))
      .catch(() => setOnline(false));
  }, [device]);

  return (
    <DeviceContext.Provider value={{ device, setDevice, label, online, setOnline }}>
      {children}
    </DeviceContext.Provider>
  );
}

export function useDeviceContext() {
  const ctx = useContext(DeviceContext);
  if (!ctx) throw new Error("useDeviceContext must be used within DeviceProvider");
  return ctx;
}
