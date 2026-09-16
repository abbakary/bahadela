import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useDeviceContext } from "../context/DeviceContext";
import { useToast } from "../components/Toast";
import { Spinner } from "../components/Spinner";

export default function DeviceSetup() {
  const { device, setDevice, setOnline } = useDeviceContext();
  const { push } = useToast();
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [form, setForm] = useState({
    base_url: device?.base_url || "",
    username: device?.username || "admin",
    password: device?.password || "",
  });

  useEffect(() => {
    api
      .sites()
      .then((data) => setSites(data.sites || []))
      .catch((err) => push(err.message, "error"))
      .finally(() => setLoading(false));
  }, [push]);

  const selectSite = (site) => {
    setDevice({
      mode: "site",
      site_name: site.name,
      site_label: site.label,
      device_ip: site.device_ip,
    });
    push(`Selected ${site.label}`, "success");
  };

  const testAndSave = async () => {
    setTesting(true);
    try {
      const result = await api.testDevice(form);
      setDevice({
        mode: "custom",
        ...form,
      });
      setOnline(true);
      push(`${result.message}. Users on device: ${result.total_users}`, "success");
    } catch (err) {
      setOnline(false);
      push(err.message, "error");
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <Spinner label="Loading sites…" />;

  return (
    <div>
      <div className="panel">
        <h2>Choose a site</h2>
        <p>Each site talks to its Hikvision terminal by IP. Passwords stay on the server.</p>
        <div className="chips">
          {sites.map((site) => (
            <button
              key={site.name}
              type="button"
              className={`chip ${device?.mode === "site" && device.site_name === site.name ? "active" : ""}`}
              onClick={() => selectSite(site)}
            >
              {site.label}
            </button>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>Or connect by IP</h2>
        <p>Use any reachable device URL — LAN IP, public IP:port, or ngrok HTTPS.</p>
        <div className="form-grid">
          <label className="field">
            Device URL / IP
            <input
              value={form.base_url}
              onChange={(e) => setForm({ ...form, base_url: e.target.value })}
              placeholder="http://192.168.1.64 or 217.29.x.x:4376"
            />
          </label>
          <div className="form-row two">
            <label className="field">
              Username
              <input
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </label>
            <label className="field">
              Password
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>
          </div>
          <button type="button" className="btn btn-primary btn-block" disabled={testing} onClick={testAndSave}>
            {testing ? "Testing…" : "Test connection & save"}
          </button>
        </div>
      </div>
    </div>
  );
}
