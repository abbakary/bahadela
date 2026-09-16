import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { clearUsersCache, readUsersCache, writeUsersCache } from "../lib/usersCache";

export function normalizeUser(u) {
  const valid = u.Valid || {};
  return {
    employee_no: u.employeeNo || u.employee_no || "",
    name: u.name || "",
    gender: u.gender === "unknown" ? "unspecified" : u.gender || "unspecified",
    valid_from: (valid.beginTime || u.valid_from || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
    valid_until: (valid.endTime || u.valid_until || "").slice(0, 10) || "2036-12-31",
    access_plan: Number(u.RightPlan?.[0]?.planTemplateNo || u.access_plan || 1),
    num_of_face: Number(u.numOfFace || 0),
    num_of_fingerprint: Number(u.numOfFP || 0),
    raw: u,
  };
}

const PAGE_SIZE = 30;

/**
 * Fast first paint from cache / first page, then background-fill the rest.
 */
export function useUsersDirectory(device, { onError } = {}) {
  const cached = device ? readUsersCache(device) : null;
  const [users, setUsers] = useState(() => cached?.users || []);
  const [total, setTotal] = useState(() => cached?.total || 0);
  const [complete, setComplete] = useState(() => Boolean(cached?.complete));
  const [loading, setLoading] = useState(() => !cached?.users?.length);
  const [syncing, setSyncing] = useState(false);
  const runIdRef = useRef(0);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const syncFromDevice = useCallback(async ({ force = false } = {}) => {
    if (!device) return;
    const runId = ++runIdRef.current;
    const existing = force ? null : readUsersCache(device);

    if (existing?.users?.length) {
      setUsers(existing.users);
      setTotal(existing.total || existing.users.length);
      setComplete(Boolean(existing.complete));
      setLoading(false);
    } else {
      setLoading(true);
    }
    setSyncing(true);

    try {
      const first = await api.listUsers(device, { position: 0, maxResults: PAGE_SIZE });
      if (runId !== runIdRef.current) return;

      let all = (first.users || []).map(normalizeUser);
      let totalMatches = first.total || all.length;
      let position = first.matched || all.length;

      setUsers(all);
      setTotal(totalMatches);
      setComplete(position >= totalMatches || all.length === 0);
      setLoading(false);
      writeUsersCache(device, {
        users: all,
        total: totalMatches,
        complete: position >= totalMatches,
      });

      while (position < totalMatches) {
        if (runId !== runIdRef.current) return;
        const page = await api.listUsers(device, { position, maxResults: PAGE_SIZE });
        if (runId !== runIdRef.current) return;

        const batch = (page.users || []).map(normalizeUser);
        if (!batch.length) break;

        const seen = new Set(all.map((u) => u.employee_no));
        for (const user of batch) {
          if (!seen.has(user.employee_no)) {
            all.push(user);
            seen.add(user.employee_no);
          }
        }
        totalMatches = page.total || totalMatches;
        position += page.matched || batch.length;

        setUsers([...all]);
        setTotal(totalMatches);
        writeUsersCache(device, {
          users: all,
          total: totalMatches,
          complete: position >= totalMatches,
        });

        await new Promise((r) => setTimeout(r, 0));
      }

      if (runId !== runIdRef.current) return;
      setComplete(true);
      writeUsersCache(device, { users: all, total: totalMatches, complete: true });
    } catch (err) {
      if (runId !== runIdRef.current) return;
      onErrorRef.current?.(err);
      setLoading(false);
    } finally {
      if (runId === runIdRef.current) setSyncing(false);
    }
  }, [device]);

  useEffect(() => {
    if (!device) {
      setUsers([]);
      setTotal(0);
      setComplete(false);
      setLoading(false);
      setSyncing(false);
      return;
    }
    syncFromDevice({ force: false });
    return () => {
      runIdRef.current += 1;
    };
  }, [device, syncFromDevice]);

  const refresh = useCallback(async () => {
    if (!device) return;
    clearUsersCache(device);
    await syncFromDevice({ force: true });
  }, [device, syncFromDevice]);

  const upsertLocal = useCallback(
    (user) => {
      setUsers((prev) => {
        const idx = prev.findIndex((u) => u.employee_no === user.employee_no);
        const next = idx >= 0 ? prev.map((u, i) => (i === idx ? { ...u, ...user } : u)) : [user, ...prev];
        writeUsersCache(device, { users: next, total: Math.max(total, next.length), complete });
        return next;
      });
    },
    [device, total, complete],
  );

  const removeLocal = useCallback(
    (employeeNo) => {
      setUsers((prev) => {
        const next = prev.filter((u) => u.employee_no !== employeeNo);
        writeUsersCache(device, {
          users: next,
          total: Math.max(0, (total || prev.length) - 1),
          complete,
        });
        return next;
      });
      setTotal((t) => Math.max(0, t - 1));
    },
    [device, total, complete],
  );

  return {
    users,
    total,
    complete,
    loading,
    syncing,
    refresh,
    upsertLocal,
    removeLocal,
  };
}
