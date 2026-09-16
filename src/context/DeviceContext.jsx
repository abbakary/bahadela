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
    if (!device) return "No site selected";
    if (device.mode === "site") {
      const name = device.site_label || device.site_name || "Site";
      // Never surface raw host/IP in the UI banner
      if (/\d{1,3}(\.\d{1,3}){3}|:\d{2,5}\b/.test(String(name))) {
        return device.site_name || "Site";
      }
      return name;
    }
    return "Custom device";
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
