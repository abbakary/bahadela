import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useDeviceContext } from "../context/DeviceContext";
import { useToast } from "../components/Toast";
import { Spinner } from "../components/Spinner";
import { Modal } from "../components/Modal";
import FaceCapture from "../components/FaceCapture";
import FingerprintCapture from "../components/FingerprintCapture";
import UserForm from "./UserForm";

function normalizeUser(u) {
  const valid = u.Valid || {};
  return {
    employee_no: u.employeeNo || u.employee_no || "",
    name: u.name || "",
    gender: u.gender === "unknown" ? "unspecified" : u.gender || "unspecified",
    valid_from: (valid.beginTime || u.valid_from || "").slice(0, 10) || new Date().toISOString().slice(0, 10),
    valid_until: (valid.endTime || u.valid_until || "").slice(0, 10) || "2036-12-31",
    access_plan: Number(u.RightPlan?.[0]?.planTemplateNo || u.access_plan || 1),
    raw: u,
  };
}

export default function Users() {
  const { device } = useDeviceContext();
  const { push } = useToast();
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [faceUser, setFaceUser] = useState(null);
  const [fpUser, setFpUser] = useState(null);
  const [busyId, setBusyId] = useState("");

  const load = async () => {
    if (!device) return;
    setLoading(true);
    try {
      const all = [];
      let position = 0;
      let totalMatches = 0;
      do {
        const page = await api.listUsers(device, { position, maxResults: 50 });
        const batch = (page.users || []).map(normalizeUser);
        all.push(...batch);
        totalMatches = page.total || all.length;
        position += page.matched || batch.length;
        if (!batch.length) break;
      } while (position < totalMatches);
      setUsers(all);
      setTotal(totalMatches || all.length);
    } catch (err) {
      push(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.name.toLowerCase().includes(q) || String(u.employee_no).toLowerCase().includes(q),
    );
  }, [users, query]);

  const onSave = async (form) => {
    try {
      if (editing) {
        await api.updateUser(device, form.employee_no, form);
        push("User updated on device", "success");
      } else {
        await api.createUser(device, form);
        push("User created on device", "success");
      }
      setEditing(null);
      setCreating(false);
      await load();
    } catch (err) {
      push(err.message, "error");
    }
  };

  const onDelete = async () => {
    if (!confirmDelete) return;
    setBusyId(confirmDelete.employee_no);
    try {
      await api.deleteUser(device, confirmDelete.employee_no);
      push("User deleted", "success");
      setConfirmDelete(null);
      await load();
    } catch (err) {
      push(err.message, "error");
    } finally {
      setBusyId("");
    }
  };

  const onFace = async (file) => {
    if (!file || !faceUser) return;
    setBusyId(faceUser.employee_no);
    try {
      await api.uploadFace(device, faceUser.employee_no, file);
      push("Face registered", "success");
      setFaceUser(null);
    } catch (err) {
      push(err.message, "error");
    } finally {
      setBusyId("");
    }
  };

  const onFingerprint = async () => {
    if (!fpUser) return;
    setBusyId(fpUser.employee_no);
    try {
      const result = await api.fingerprint(device, fpUser.employee_no);
      push(
        `${result.message}${result.quality != null ? ` · quality ${result.quality}%` : ""}`,
        "success",
      );
      setFpUser(null);
    } catch (err) {
      push(err.message, "error");
    } finally {
      setBusyId("");
    }
  };

  if (!device) {
    return (
      <div className="panel empty">
        <p>Connect a site or device IP first.</p>
        <Link className="btn btn-primary" to="/device">
          Open device setup
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="panel">
        <h2>Registered users</h2>
        <p>Live list from the Hikvision terminal · {total} total</p>
        <div className="toolbar">
          <input
            className="search"
            placeholder="Search name or employee ID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
            Refresh
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            Add user
          </button>
        </div>
      </div>

      {loading ? <Spinner label="Loading users from device…" /> : null}

      {!loading && filtered.length === 0 ? (
        <div className="panel empty">No users found on this device.</div>
      ) : null}

      <div className="user-list">
        {filtered.map((user) => (
          <article key={user.employee_no} className="user-card">
            <header>
              <div>
                <h3>{user.name || "Unnamed"}</h3>
                <div className="meta">
                  ID {user.employee_no} · Valid until {user.valid_until}
                </div>
              </div>
              <span className="badge ok">On device</span>
            </header>
            <div className="actions">
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(user)}>
                Edit
              </button>
              <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(user)}>
                Delete
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busyId === user.employee_no}
                onClick={() => setFaceUser(user)}
              >
                Face
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busyId === user.employee_no}
                onClick={() => setFpUser(user)}
              >
                Fingerprint
              </button>
            </div>
          </article>
        ))}
      </div>

      {(creating || editing) && (
        <Modal
          title={editing ? "Edit user" : "Add user"}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        >
          <UserForm
            initial={editing || undefined}
            onSubmit={onSave}
            onCancel={() => {
              setCreating(false);
              setEditing(null);
            }}
          />
        </Modal>
      )}

      {faceUser && (
        <FaceCapture
          userName={faceUser.name || faceUser.employee_no}
          busy={busyId === faceUser.employee_no}
          onClose={() => setFaceUser(null)}
          onCapture={onFace}
        />
      )}

      {fpUser && (
        <FingerprintCapture
          userName={fpUser.name || fpUser.employee_no}
          busy={busyId === fpUser.employee_no}
          onClose={() => setFpUser(null)}
          onStart={onFingerprint}
        />
      )}

      {confirmDelete && (
        <Modal
          title="Delete user?"
          onClose={() => setConfirmDelete(null)}
          footer={
            <div className="form-row two">
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={onDelete}>
                Delete {confirmDelete.employee_no}
              </button>
            </div>
          }
        >
          <p>
            Remove <strong>{confirmDelete.name}</strong> (ID {confirmDelete.employee_no}) from the
            terminal? This cannot be undone from the app.
          </p>
        </Modal>
      )}
    </div>
  );
}
