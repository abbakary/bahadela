import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useDeviceContext } from "../context/DeviceContext";
import { useToast } from "../components/Toast";
import { useUsersDirectory, normalizeUser } from "../hooks/useUsersDirectory";
import { clearCachedFace } from "../lib/usersCache";
import { Spinner } from "../components/Spinner";
import { Modal } from "../components/Modal";
import FaceCapture from "../components/FaceCapture";
import FacePhoto from "../components/FacePhoto";
import FingerprintCapture from "../components/FingerprintCapture";
import UserForm from "./UserForm";

export default function Users() {
  const { device } = useDeviceContext();
  const { push } = useToast();
  const { users, total, complete, loading, syncing, refresh, upsertLocal, removeLocal } =
    useUsersDirectory(device, {
      onError: (err) => push(err.message, "error"),
    });
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [faceUser, setFaceUser] = useState(null);
  const [fpUser, setFpUser] = useState(null);
  const [busyId, setBusyId] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (u) => u.name.toLowerCase().includes(q) || String(u.employee_no).toLowerCase().includes(q),
    );
  }, [users, query]);

  const statusText = (() => {
    if (loading && !users.length) return "Loading first users from the terminal…";
    if (syncing && !complete) {
      return `Loaded ${users.length} of ${total || "…"} · syncing in background`;
    }
    if (syncing) return `Live list · ${total} total · refreshing…`;
    return `Live list from the Hikvision terminal · ${total} total`;
  })();

  const onSave = async (form) => {
    try {
      if (editing) {
        await api.updateUser(device, form.employee_no, form);
        upsertLocal({ ...editing, ...form });
        push("User updated on device", "success");
      } else {
        const created = await api.createUser(device, form);
        upsertLocal(normalizeUser({ ...form, employeeNo: form.employee_no, ...(created.user || {}) }));
        push("User created on device", "success");
      }
      setEditing(null);
      setCreating(false);
    } catch (err) {
      push(err.message, "error");
    }
  };

  const onDelete = async () => {
    if (!confirmDelete) return;
    setBusyId(confirmDelete.employee_no);
    try {
      await api.deleteUser(device, confirmDelete.employee_no);
      clearCachedFace(device, confirmDelete.employee_no);
      removeLocal(confirmDelete.employee_no);
      push("User deleted", "success");
      setConfirmDelete(null);
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
      clearCachedFace(device, faceUser.employee_no);
      upsertLocal({ ...faceUser, num_of_face: Math.max(1, faceUser.num_of_face || 0) });
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
      upsertLocal({
        ...fpUser,
        num_of_fingerprint: Math.max(1, (fpUser.num_of_fingerprint || 0) + 1),
      });
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
      <div className="users-sticky">
        <h2>Registered users</h2>
        <p>
          {statusText}
          {syncing ? <span className="sync-dot" aria-hidden /> : null}
        </p>
        <div className="toolbar">
          <input
            className="search"
            placeholder="Search name or employee ID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button type="button" className="btn btn-secondary" onClick={refresh} disabled={loading || syncing}>
            {syncing ? "Syncing…" : "Refresh"}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            Add
          </button>
        </div>
        {query.trim() && !complete ? (
          <p className="search-hint">
            Searching loaded users ({users.length}/{total || "…"}). Full results appear as sync finishes.
          </p>
        ) : null}
      </div>

      {loading && !users.length ? <Spinner label="Loading users from device…" /> : null}

      {!loading && filtered.length === 0 ? (
        <div className="panel empty">
          {query.trim()
            ? complete
              ? "No matching users."
              : "No matches in loaded users yet — keep typing or wait for sync."
            : "No users found on this device."}
        </div>
      ) : null}

      <div className="user-list">
        {filtered.map((user) => (
          <article key={user.employee_no} className="user-card">
            <header className="user-card-top">
              <Link to={`/users/${encodeURIComponent(user.employee_no)}`} className="user-card-identity">
                <div className="user-card-avatar">
                  <FacePhoto
                    device={device}
                    employeeNo={user.employee_no}
                    alt={user.name}
                    enabled={user.num_of_face > 0}
                  />
                </div>
                <div>
                  <h3>{user.name || "Unnamed"}</h3>
                  <div className="meta">
                    ID {user.employee_no} · Valid until {user.valid_until}
                  </div>
                  <div className="meta">
                    Face {user.num_of_face > 0 ? "yes" : "no"} · FP {user.num_of_fingerprint || 0}
                  </div>
                </div>
              </Link>
              <Link className="badge ok" to={`/users/${encodeURIComponent(user.employee_no)}`}>
                Details
              </Link>
            </header>
            <div className="user-card-actions">
              <Link
                className="btn btn-primary btn-open"
                to={`/users/${encodeURIComponent(user.employee_no)}`}
              >
                Open profile
              </Link>
              <div className="user-card-tools">
                <button type="button" className="tool-btn" onClick={() => setEditing(user)}>
                  <span className="tool-ico" aria-hidden>
                    ✎
                  </span>
                  Edit
                </button>
                <button
                  type="button"
                  className="tool-btn"
                  disabled={busyId === user.employee_no}
                  onClick={() => setFaceUser(user)}
                >
                  <span className="tool-ico" aria-hidden>
                    ◉
                  </span>
                  Face
                </button>
                <button
                  type="button"
                  className="tool-btn"
                  disabled={busyId === user.employee_no}
                  onClick={() => setFpUser(user)}
                >
                  <span className="tool-ico" aria-hidden>
                    ⌖
                  </span>
                  Finger
                </button>
              </div>
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
            terminal?
          </p>
        </Modal>
      )}
    </div>
  );
}
