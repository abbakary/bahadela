const DEVICE_KEY = "bahdela.device";

export function loadDevice() {
  try {
    return JSON.parse(localStorage.getItem(DEVICE_KEY) || "null");
  } catch {
    return null;
  }
}

export function saveDevice(device) {
  localStorage.setItem(DEVICE_KEY, JSON.stringify(device));
}

function deviceHeaders(device) {
  if (!device) return {};
  if (device.mode === "custom" && device.base_url) {
    return {
      "X-Device-URL": device.base_url,
      "X-Device-User": device.username || "admin",
      "X-Device-Password": device.password || "",
    };
  }
  return {};
}

function withSite(path, device) {
  if (device?.mode === "site" && device.site_name) {
    const join = path.includes("?") ? "&" : "?";
    return `${path}${join}site_name=${encodeURIComponent(device.site_name)}`;
  }
  return path;
}

async function request(path, { method = "GET", body, device, headers = {}, isForm = false } = {}) {
  const opts = {
    method,
    headers: {
      ...deviceHeaders(device),
      ...headers,
    },
  };

  const url = withSite(path, device);

  if (body != null) {
    if (isForm) {
      opts.body = body;
    } else {
      opts.headers["Content-Type"] = "application/json";
      opts.body = JSON.stringify(body);
    }
  }

  const res = await fetch(url, opts);
  if (!res.ok) {
    let detail = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      detail = data.detail || data.message || detail;
      if (Array.isArray(detail)) detail = detail.map((d) => d.msg || d).join(", ");
    } catch {
      /* ignore */
    }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }

  const type = res.headers.get("content-type") || "";
  if (type.includes("application/json")) return res.json();
  return res.blob();
}

export const api = {
  health: () => request("/api/health"),
  sites: () => request("/api/sites"),
  siteConfig: (name) => request(`/api/sites/${encodeURIComponent(name)}/config`),
  testDevice: (payload) => request("/api/device/test", { method: "POST", body: payload }),
  verifyPin: (pin) => request("/api/auth/enrollment-pin", { method: "POST", body: { pin } }),
  listUsers: (device, { position = 0, maxResults = 50 } = {}) =>
    request(`/api/users?position=${position}&max_results=${maxResults}`, { device }),
  createUser: (device, data, { requirePin = false, pin } = {}) => {
    let path = `/api/users?require_pin=${requirePin ? "true" : "false"}`;
    if (pin) path += `&pin=${encodeURIComponent(pin)}`;
    return request(path, { method: "POST", body: data, device });
  },
  updateUser: (device, employeeNo, data) =>
    request(`/api/users/${encodeURIComponent(employeeNo)}`, { method: "PUT", body: data, device }),
  deleteUser: (device, employeeNo) =>
    request(`/api/users/${encodeURIComponent(employeeNo)}`, { method: "DELETE", device }),
  uploadFace: (device, employeeNo, file) => {
    const form = new FormData();
    form.append("file", file);
    return request(`/api/users/${encodeURIComponent(employeeNo)}/face`, {
      method: "POST",
      body: form,
      device,
      isForm: true,
    });
  },
  fingerprint: (device, employeeNo) =>
    request(`/api/users/${encodeURIComponent(employeeNo)}/fingerprint`, {
      method: "POST",
      device,
    }),
  report: (device, body) => {
    const payload = { ...body };
    if (device?.mode === "site") payload.site_name = device.site_name;
    if (device?.mode === "custom") {
      payload.base_url = device.base_url;
      payload.username = device.username;
      payload.password = device.password;
    }
    return request("/api/attendance/report/full", { method: "POST", body: payload, device });
  },
  exportReport: (device, body) => {
    const payload = { ...body };
    if (device?.mode === "site") payload.site_name = device.site_name;
    if (device?.mode === "custom") {
      payload.base_url = device.base_url;
      payload.username = device.username;
      payload.password = device.password;
    }
    return request("/api/attendance/export", { method: "POST", body: payload, device });
  },
};

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
