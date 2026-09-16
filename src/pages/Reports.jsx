import { useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Link } from "react-router-dom";
import { api, downloadBlob } from "../api/client";
import { useDeviceContext } from "../context/DeviceContext";
import { useToast } from "../components/Toast";
import { Spinner } from "../components/Spinner";
import { siteDisplayName } from "../components/SitePicker";

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

const PRESETS = ["Today", "Yesterday", "This week", "Last week", "This month", "Last month", "Custom"];

const STATUS_FILTERS = [
  { id: "all", label: "All people" },
  { id: "present", label: "Present only", metric: "present" },
  { id: "absent", label: "Absent only", metric: "absent" },
  { id: "early", label: "Early arrivals", metric: "early" },
  { id: "on_time", label: "On time", metric: "on_time" },
  { id: "late", label: "Late arrivals", metric: "late" },
  { id: "incomplete", label: "Missing check-out", metric: "incomplete" },
];

function matchesFilter(row, filterId) {
  if (filterId === "all") return true;
  if (filterId === "present") return row.status === "Present";
  if (filterId === "absent") return row.status === "Absent";
  if (filterId === "early") return row.timing === "Early";
  if (filterId === "on_time") return row.timing === "On time";
  if (filterId === "late") return row.timing === "Late";
  if (filterId === "incomplete") return !!row.incomplete;
  return true;
}

function statusBadgeClass(row) {
  if (row.status === "Absent") return "warn";
  if (row.timing === "Late") return "danger";
  if (row.timing === "Early") return "ok";
  if (row.incomplete) return "warn";
  return "ok";
}

function statusLabel(row) {
  if (row.status === "Absent") return "Absent";
  if (row.incomplete && row.timing === "Late") return "Late · no out";
  if (row.incomplete) return "No check-out";
  return row.timing || row.status;
}

const reportMemory = new Map();

function memoryKey(device, start, end) {
  const site = device?.mode === "site" ? device.site_name : device?.base_url || "custom";
  return `${site}|${start}|${end}`;
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
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [showDownloads, setShowDownloads] = useState(false);
  const [isPending, startTransition] = useTransition();
  const deferredQuery = useDeferredValue(query);
  const fetchSeq = useRef(0);
  const autoKey = useRef("");

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
    const days = (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24) + 1;
    if (days >= 28) return "Monthly";
    if (days >= 7) return "Weekly";
    return "Daily";
  }, [startDate, endDate]);

  const selectedSiteName = device?.mode === "site" ? device.site_name || "" : "";
  const selectedSiteLabel =
    device?.mode === "site"
      ? siteDisplayName({ label: device.site_label, name: device.site_name })
      : device?.mode === "custom"
        ? "Custom device"
        : "";

  const onSiteChange = (name) => {
    if (!name) return;
    const site = sites.find((s) => s.name === name);
    if (!site) return;
    setDevice({
      mode: "site",
      site_name: site.name,
      site_label: siteDisplayName(site),
    });
  };

  const applyReport = (data) => {
    startTransition(() => {
      setReport(data);
      setStatusFilter("all");
      setDeptFilter("all");
      setQuery("");
    });
  };

  const generate = async ({ refresh = false, silent = false } = {}) => {
    if (!device) {
      if (!silent) push("Select a site first", "error");
      return;
    }
    const key = memoryKey(device, startDate, endDate);
    if (!refresh && reportMemory.has(key)) {
      applyReport(reportMemory.get(key));
      if (!silent) push("Loaded from cache", "success");
      softRefresh(key);
      return;
    }

    const seq = ++fetchSeq.current;
    setLoading(true);
    try {
      const body = {
        start_date: startDate,
        end_date: endDate,
        refresh,
      };
      if (device.mode === "site") body.site_name = device.site_name;
      if (device.mode === "custom") {
        body.base_url = device.base_url;
        body.username = device.username;
        body.password = device.password;
      }
      const data = await api.report(device, body);
      if (seq !== fetchSeq.current) return;
      reportMemory.set(key, data);
      applyReport(data);
      if (!silent) {
        push(data.cached ? "Report ready (cached)" : "Report ready", "success");
      }
    } catch (err) {
      if (seq !== fetchSeq.current) return;
      if (!silent) push(err.message, "error");
    } finally {
      if (seq === fetchSeq.current) setLoading(false);
    }
  };

  const softRefresh = async (key) => {
    if (!device) return;
    try {
      const body = {
        start_date: startDate,
        end_date: endDate,
        refresh: true,
      };
      if (device.mode === "site") body.site_name = device.site_name;
      if (device.mode === "custom") {
        body.base_url = device.base_url;
        body.username = device.username;
        body.password = device.password;
      }
      const data = await api.report(device, body);
      reportMemory.set(key, data);
      startTransition(() => setReport(data));
    } catch {
      /* keep cached view */
    }
  };

  useEffect(() => {
    if (!device) return;
    const key = `${memoryKey(device, startDate, endDate)}`;
    if (autoKey.current === key) return;
    autoKey.current = key;
    const t = setTimeout(() => generate({ silent: true }), 180);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device, startDate, endDate]);

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
        use_cache: true,
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

  const departments = useMemo(() => report?.department_breakdown || [], [report]);

  const filteredViewer = useMemo(() => {
    if (!report?.viewer) return [];
    const q = deferredQuery.trim().toLowerCase();
    return report.viewer
      .map((day) => {
        const departmentsFiltered = day.departments
          .filter((dept) => deptFilter === "all" || dept.key === deptFilter)
          .map((dept) => {
            const records = dept.records.filter((row) => {
              if (!matchesFilter(row, statusFilter)) return false;
              if (!q) return true;
              return (
                row.name.toLowerCase().includes(q) ||
                String(row.id || "").toLowerCase().includes(q) ||
                String(dept.label || "").toLowerCase().includes(q)
              );
            });
            return { ...dept, records };
          })
          .filter((dept) => dept.records.length > 0);
        const matchCount = departmentsFiltered.reduce((n, d) => n + d.records.length, 0);
        return { ...day, departments: departmentsFiltered, matchCount };
      })
      .filter((day) => day.matchCount > 0);
  }, [report, statusFilter, deptFilter, deferredQuery]);

  const visibleCount = useMemo(
    () => filteredViewer.reduce((n, day) => n + day.matchCount, 0),
    [filteredViewer],
  );

  const m = report?.metrics || {};
  const filtersActive = statusFilter !== "all" || deptFilter !== "all" || !!query.trim();

  const clearFilters = () => {
    setStatusFilter("all");
    setDeptFilter("all");
    setQuery("");
  };

  const statusOptions = STATUS_FILTERS.map((f) => {
    const count = f.metric && m[f.metric] != null ? m[f.metric] : null;
    return {
      ...f,
      optionLabel: count != null ? `${f.label} (${count})` : f.label,
    };
  });

  return (
    <div className="reports-page reports-simple">
      <div className="panel reports-controls compact">
        <div className="reports-head">
          <div>
            <h2>Reports</h2>
            <p>Pick a site and period, then review attendance below.</p>
          </div>
          {report?.cached ? <span className="badge ok">Cached</span> : null}
        </div>

        <div className="control-stack">
          <label className="field">
            Site
            <select
              value={selectedSiteName}
              onChange={(e) => onSiteChange(e.target.value)}
            >
              <option value="">Select a site…</option>
              {sites.map((site) => (
                <option key={site.name} value={site.name}>
                  {siteDisplayName(site)}
                </option>
              ))}
            </select>
          </label>

          {!device ? (
            <p className="hint-line">
              No site yet? <Link to="/device">Connect a device</Link>
            </p>
          ) : device.mode === "custom" ? (
            <p className="hint-line">Using custom device. Choose a site above to switch.</p>
          ) : null}

          <label className="field">
            Period
            <select value={preset} onChange={(e) => setPreset(e.target.value)}>
              {PRESETS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>

          {preset === "Custom" ? (
            <div className="form-row two reports-dates">
              <label className="field">
                From
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setPreset("Custom");
                    setStartDate(e.target.value);
                  }}
                />
              </label>
              <label className="field">
                To
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setPreset("Custom");
                    setEndDate(e.target.value);
                  }}
                />
              </label>
            </div>
          ) : (
            <p className="range-line">
              {startDate === endDate ? startDate : `${startDate} → ${endDate}`} · {periodLabel}
              {selectedSiteLabel ? ` · ${selectedSiteLabel}` : ""}
            </p>
          )}

          <div className="reports-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading || !device}
              onClick={() => generate({ refresh: false })}
            >
              {loading ? "Loading…" : "Load report"}
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={loading || !device}
              onClick={() => generate({ refresh: true })}
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {loading && !report ? <Spinner label="Fetching events…" /> : null}

      {report ? (
        <div className={`report-results ${isPending ? "is-filtering" : ""}`}>
          <div className="metrics metrics-simple">
            <div className="metric">
              <strong>{m.present ?? 0}</strong>
              <span>Present</span>
            </div>
            <div className="metric">
              <strong>{m.absent ?? 0}</strong>
              <span>Absent</span>
            </div>
            <div className="metric">
              <strong>{m.late ?? 0}</strong>
              <span>Late</span>
            </div>
            <div className="metric">
              <strong>{m.attendance_rate ?? 0}%</strong>
              <span>Rate</span>
            </div>
          </div>

          <div className="panel report-filter-bar">
            <div className="filter-bar-head">
              <h3>Find in this report</h3>
              <span>
                {visibleCount} shown
                {filtersActive ? " · filtered" : ""}
              </span>
            </div>

            <div className="filter-bar-grid">
              <label className="field">
                Status
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  {statusOptions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.optionLabel}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                Department
                <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
                  <option value="all">All departments</option>
                  {departments.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label} ({d.present}/{d.total})
                    </option>
                  ))}
                </select>
              </label>

              <label className="field filter-search-field">
                Search
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Name or ID"
                  autoComplete="off"
                />
              </label>
            </div>

            {filtersActive ? (
              <button type="button" className="linkish clear-filters" onClick={clearFilters}>
                Clear filters
              </button>
            ) : null}
          </div>

          <div className="panel downloads-panel">
            <button
              type="button"
              className="downloads-toggle"
              onClick={() => setShowDownloads((v) => !v)}
            >
              <span>
                <strong>Downloads</strong>
                <small>DOCX · PDF · Excel</small>
              </span>
              <span aria-hidden>{showDownloads ? "▾" : "▸"}</span>
            </button>
            {showDownloads ? (
              <div className="download-grid">
                {["docx", "pdf", "xlsx"].map((fmt) => (
                  <button
                    key={`daily-${fmt}`}
                    type="button"
                    className="download-btn"
                    disabled={!!exporting}
                    onClick={() => doExport(fmt, "daily")}
                  >
                    <span className="dl-title">
                      {exporting === `daily-${fmt}` ? "…" : fmt.toUpperCase()}
                    </span>
                    <span className="dl-sub">Daily file</span>
                  </button>
                ))}
                {["docx", "pdf", "xlsx"].map((fmt) => (
                  <button
                    key={`summary-${fmt}`}
                    type="button"
                    className="download-btn summary"
                    disabled={!!exporting}
                    onClick={() => doExport(fmt, "summary")}
                  >
                    <span className="dl-title">
                      {exporting === `summary-${fmt}` ? "…" : fmt.toUpperCase()}
                    </span>
                    <span className="dl-sub">{periodLabel} summary</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="legend">
            <span style={{ background: "#C6EFCE", color: "#276221" }}>Early</span>
            <span>On time</span>
            <span style={{ background: "#FFCCCC", color: "#CC0000" }}>Late</span>
            <span style={{ background: "#EEEEEE", color: "#777" }}>Absent</span>
          </div>

          {filteredViewer.length === 0 ? (
            <div className="empty panel">No people match these filters.</div>
          ) : (
            filteredViewer.map((day) => (
              <div key={day.date} className="panel day-panel">
                <div className="day-head">
                  <h2>{day.label}</h2>
                  <span className="day-count">{day.matchCount}</span>
                </div>
                {day.departments.map((dept) => (
                  <div key={dept.key} className="dept-section">
                    <h3 style={{ color: dept.color }}>
                      {dept.label}
                      <small>
                        {dept.present} present · {dept.absent} absent
                      </small>
                    </h3>
                    <p>{dept.shift}</p>

                    <div className="attendance-mobile mobile-only">
                      {dept.records.map((row, idx) => (
                        <article
                          key={`${row.id}-${row.name}-${idx}`}
                          className={`att-card ${row.status === "Absent" ? "absent" : ""} ${
                            row.timing === "Late" ? "late" : ""
                          }`}
                        >
                          <div className="att-card-top">
                            <div>
                              <strong>{row.name}</strong>
                              <div className="att-card-meta">ID {row.id || "—"}</div>
                            </div>
                            <span className={`badge ${statusBadgeClass(row)}`}>{statusLabel(row)}</span>
                          </div>
                          <div className="att-times">
                            <div
                              className="att-time"
                              style={{
                                background: row.check_in_bg || undefined,
                                color: row.check_in_color || undefined,
                              }}
                            >
                              <span>In</span>
                              <strong>{row.check_in || "—"}</strong>
                            </div>
                            <div className="att-time">
                              <span>Out</span>
                              <strong>{row.check_out || "—"}</strong>
                            </div>
                            <div className="att-time">
                              <span>Hours</span>
                              <strong>{row.hours || "—"}</strong>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>

                    <div className="table-wrap desktop-only">
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
                            <tr
                              key={`${row.id}-${row.name}-${idx}`}
                              className={row.status === "Absent" ? "absent" : ""}
                            >
                              <td>{statusLabel(row)}</td>
                              <td>{row.name}</td>
                              <td>{row.id}</td>
                              <td
                                style={{
                                  background: row.check_in_bg,
                                  color: row.check_in_color,
                                  fontWeight: 700,
                                }}
                              >
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
            ))
          )}
        </div>
      ) : !loading ? (
        <div className="empty panel">Select a site to load the attendance report.</div>
      ) : null}
    </div>
  );
}
