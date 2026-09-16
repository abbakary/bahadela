const memory = new Map();

function deviceCacheKey(device) {
  if (!device) return "none";
  if (device.mode === "site") return `site:${device.site_name}`;
  return `custom:${device.base_url || ""}`;
}

function storageKey(device) {
  return `bahdela.users.${deviceCacheKey(device)}`;
}

export function readUsersCache(device) {
  const mem = memory.get(deviceCacheKey(device));
  if (mem?.users?.length) return mem;
  try {
    const raw = sessionStorage.getItem(storageKey(device));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.users?.length) return null;
    // Ignore caches older than 10 minutes.
    if (Date.now() - (parsed.savedAt || 0) > 10 * 60 * 1000) return null;
    memory.set(deviceCacheKey(device), parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function writeUsersCache(device, payload) {
  const entry = {
    users: payload.users || [],
    total: payload.total || 0,
    complete: Boolean(payload.complete),
    savedAt: Date.now(),
  };
  memory.set(deviceCacheKey(device), entry);
  try {
    sessionStorage.setItem(storageKey(device), JSON.stringify(entry));
  } catch {
    /* quota / private mode */
  }
}

export function clearUsersCache(device) {
  memory.delete(deviceCacheKey(device));
  try {
    sessionStorage.removeItem(storageKey(device));
  } catch {
    /* ignore */
  }
}

const faceMemory = new Map();

export function faceCacheKey(device, employeeNo) {
  return `${deviceCacheKey(device)}::${employeeNo}`;
}

export function getCachedFaceUrl(device, employeeNo) {
  return faceMemory.get(faceCacheKey(device, employeeNo)) || "";
}

export function setCachedFaceUrl(device, employeeNo, objectUrl) {
  const key = faceCacheKey(device, employeeNo);
  const prev = faceMemory.get(key);
  if (prev && prev !== objectUrl) URL.revokeObjectURL(prev);
  faceMemory.set(key, objectUrl);
}

export function clearCachedFace(device, employeeNo) {
  const key = faceCacheKey(device, employeeNo);
  const prev = faceMemory.get(key);
  if (prev) URL.revokeObjectURL(prev);
  faceMemory.delete(key);
}
