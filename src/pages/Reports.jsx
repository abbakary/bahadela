import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, downloadBlob } from "../api/client";
import { useDeviceContext } from "../context/DeviceContext";
import { useToast } from "../components/Toast";
import { Spinner } from "../components/Spinner";

function iso(d) {
  return d.toISOString().slice(0, 10);
}

function presetRange(preset) {
  const today = new Date();
  const end = new Date(today);
  let start = new Date(today);
  if (preset === "Yesterday") {
    start.setDate(today.getDate() - 1);
    end.setDate(today.getDate() - 1);
  } else if (preset === "This week") {
    const day = today.getDay() || 7;
    start.setDate(today.getDate() - (day - 1));
  } else if (preset === "Last week") {
    const day = today.getDay() || 7;
    end.setDate(today.getDate() - day);
    start = new Date(end);
    start.setDate(end.getDate() - 6);
  } else if (preset === "This month") {
    start = new Date(today.getFullYear(), today.getMonth(), 1);
  } else if (preset === "Last month") {
    start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    end.setDate(0);
  }
  return { start: iso(start), end: iso(end) };
}

export default function Reports() {
  const { device, setDevice } = useDeviceContext();
  const { push } = useToast();
  const [sites, setSites] = useState([]);
  const [preset, setPreset] = useState("Today");
  const [startDate, setStartDate] = useState(iso(new Date()));
  const [endDate, setEndDate] = useState(iso(new Date()));
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [exporting, setExporting] = useState("");

  useEffect(() => {
    api.sites().then((d) => setSites(d.sites || [])).catch((e) => push(e.message, "error"));
  }, [push]);

  useEffect(() => {
    if (preset === "Custom") return;
    const range = presetRange(preset);
    setStartDate(range.start);
    setEndDate(range.end);
  }, [preset]);

  const periodLabel = useMemo(() => {
    const days =
      (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24) + 1;
    if (days >= 28) return "Monthly";
    if (days >= 7) return "Weekly";
    return "Daily";
  }, [startDate, endDate]);

  const selectSite = (site) => {
    setDevice({
      mode: "site",
      site_name: site.name,
      site_label: site.label,
      device_ip: site.device_ip,
    });
  };

  const generate = async () => {
    if (!device) {
      push("Select a site or device first", "error");
      return;
    }
    setLoading(true);
    setReport(null);
    try {
      const body = {
        start_date: startDate,
        end_date: endDate,
      };
      if (device.mode === "site") body.site_name = device.site_name;
      if (device.mode === "custom") {
        body.base_url = device.base_url;
        body.username = device.username;
        body.password = device.password;
      }
      const data = await api.report(device, body);
      setReport(data);
      push("Report ready", "success");
    } catch (err) {
      push(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  const doExport = async (format, report_type) => {
    if (!device) return;
    const key = `${report_type}-${format}`;
    setExporting(key);
    try {
      const body = {
        start_date: startDate,
        end_date: endDate,
        format,
        report_type,
      };
      if (device.mode === "site") body.site_name = device.site_name;
      if (device.mode === "custom") {
        body.base_url = device.base_url;
        body.username = device.username;
        body.password = device.password;
      }
      const blob = await api.exportReport(device, body);
      const site = (report?.site || device.site_label || "Bahdela").replace(/\s+/g, "_");
      downloadBlob(blob, `${site}_${report_type}_${startDate}.${format}`);
    } catch (err) {
      push(err.message, "error");
    } finally {
      setExporting("");
    }
  };

  return (
    <div>
      <div className="panel">
        <h2>Attendance reports</h2>
        <p>Pull events from the site terminal and view or download shift reports.</p>

        <h3 style={{ marginTop: "0.5rem" }}>Site</h3>
        <div className="chips" style={{ marginBottom: "0.9rem" }}>
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
        {!device ? (
          <p>
            Or <Link to="/device">connect a custom IP</Link>.
          </p>
        ) : null}

        <label className="field">
          Quick select
          <select value={preset} onChange={(e) => setPreset(e.target.value)}>
            {["Today", "Yesterday", "This week", "Last week", "This month", "Last month", "Custom"].map(
              (p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ),
            )}
          </select>
        </label>

        <div className="form-row two" style={{ marginTop: "0.85rem" }}>
          <label className="field">
            From
            <input type="date" value={startDate} onChange={(e) => { setPreset("Custom"); setStartDate(e.target.value); }} />
          </label>
          <label className="field">
            To
            <input type="date" value={endDate} onChange={(e) => { setPreset("Custom"); setEndDate(e.target.value); }} />
          </label>
        </div>
        <p style={{ marginTop: "0.5rem" }}>
          {periodLabel} report selected
        </p>
        <button type="button" className="btn btn-primary btn-block" disabled={loading} onClick={generate}>
          {loading ? "Generating…" : "View / generate reports"}
        </button>
      </div>

      {loading ? <Spinner label="Fetching events from device…" /> : null}

      {report ? (
        <>
          <div className="metrics">
            <div className="metric">
              <strong>{report.metrics.days}</strong>
              <span>Days</span>
            </div>
            <div className="metric">
              <strong>{report.metrics.total_records}</strong>
              <span>Records</span>
            </div>
            <div className="metric">
              <strong>{report.metrics.staff_roster}</strong>
              <span>Roster</span>
            </div>
            <div className="metric">
              <strong>{report.metrics.avg_per_day}</strong>
              <span>Avg / day</span>
            </div>
            <div className="metric">
              <strong>{report.metrics.unique_staff}</strong>
              <span>Unique staff</span>
            </div>
          </div>

          <div className="dept-grid">
            {report.department_breakdown.map((d) => (
              <div key={d.key} className="dept-card" style={{ background: d.color }}>
                <small>{d.label}</small>
                <strong>{d.present}</strong>
                <small>of {d.total}</small>
              </div>
            ))}
          </div>

          <div className="panel">
            <h2>Downloads</h2>
            <div className="form-row two">
              {["docx", "pdf", "xlsx"].map((fmt) => (
                <button
                  key={`daily-${fmt}`}
                  type="button"
                  className="btn btn-secondary"
                  disabled={!!exporting}
                  onClick={() => doExport(fmt, "daily")}
                >
                  {exporting === `daily-${fmt}` ? "…" : `Daily ${fmt.toUpperCase()}`}
                </button>
              ))}
              {["docx", "pdf", "xlsx"].map((fmt) => (
                <button
                  key={`summary-${fmt}`}
                  type="button"
                  className="btn btn-ghost"
                  disabled={!!exporting}
                  onClick={() => doExport(fmt, "summary")}
                >
                  {exporting === `summary-${fmt}` ? "…" : `${periodLabel} ${fmt.toUpperCase()}`}
                </button>
              ))}
            </div>
          </div>

          <div className="legend">
            <span style={{ background: "#C6EFCE", color: "#276221" }}>Early</span>
            <span>On time</span>
            <span style={{ background: "#FFCCCC", color: "#CC0000" }}>Late</span>
            <span style={{ background: "#EEEEEE", color: "#777" }}>Absent</span>
          </div>

          {report.viewer.map((day) => (
            <div key={day.date} className="panel">
              <h2>{day.label}</h2>
              {day.departments.map((dept) => (
                <div key={dept.key} style={{ marginBottom: "1rem" }}>
                  <h3 style={{ color: dept.color }}>
                    {dept.label} · {dept.present} present / {dept.absent} absent
                  </h3>
                  <p>{dept.shift}</p>
                  <div className="table-wrap">
                    <table className="data">
                      <thead>
                        <tr>
                          <th>Status</th>
                          <th>Name</th>
                          <th>ID</th>
                          <th>In</th>
                          <th>Out</th>
                          <th>Hours</th>
                        </tr>
                      </thead>
                      <tbody>
                        {dept.records.map((row, idx) => (
                          <tr key={`${row.id}-${idx}`} className={row.status === "Absent" ? "absent" : ""}>
                            <td>{row.status}</td>
                            <td>{row.name}</td>
                            <td>{row.id}</td>
                            <td style={{ background: row.check_in_bg, color: row.check_in_color, fontWeight: 700 }}>
                              {row.check_in || "-"}
                            </td>
                            <td>{row.check_out || "-"}</td>
                            <td>{row.hours || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}
