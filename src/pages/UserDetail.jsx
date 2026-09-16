import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import { useDeviceContext } from "../context/DeviceContext";
import { useToast } from "../components/Toast";
import { Spinner } from "../components/Spinner";
import { Modal } from "../components/Modal";
import FaceCapture from "../components/FaceCapture";
import FacePhoto from "../components/FacePhoto";
import FingerprintCapture from "../components/FingerprintCapture";
import UserForm from "./UserForm";

export default function UserDetail() {
  const { employeeNo } = useParams();
  const navigate = useNavigate();
  const { device } = useDeviceContext();
  const { push } = useToast();
  const [user, setUser] = useState(null);
  const [photoKey, setPhotoKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [faceOpen, setFaceOpen] = useState(false);
  const [fpOpen, setFpOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!device || !employeeNo) return;
    setLoading(true);
    try {
      const data = await api.getUser(device, employeeNo);
      setUser(data);
      setPhotoKey((k) => k + 1);
    } catch (err) {
      push(err.message, "error");
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [device, employeeNo]);

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

  if (loading) return <Spinner label="Loading user from device…" />;

  if (!user) {
    return (
      <div className="panel empty">
        <p>User not found on this device.</p>
        <Link className="btn btn-secondary" to="/users">
          Back to users
        </Link>
      </div>
    );
  }

  const onSave = async (form) => {
    setBusy(true);
    try {
      await api.updateUser(device, user.employee_no, form);
      push("User updated", "success");
      setEditing(false);
      await load();
    } catch (err) {
      push(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const onFace = async (file) => {
    setBusy(true);
    try {
      await api.uploadFace(device, user.employee_no, file);
      push("Face saved on device", "success");
      setFaceOpen(false);
      await load();
    } catch (err) {
      push(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const onFingerprint = async () => {
    setBusy(true);
    try {
      const result = await api.fingerprint(device, user.employee_no);
      push(
        `${result.message}${result.quality != null ? ` · quality ${result.quality}%` : ""}`,
        "success",
      );
      setFpOpen(false);
      await load();
    } catch (err) {
      push(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    setBusy(true);
    try {
      await api.deleteUser(device, user.employee_no);
      push("User deleted", "success");
      navigate("/users");
    } catch (err) {
      push(err.message, "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="toolbar" style={{ marginBottom: "0.85rem" }}>
        <Link className="btn btn-ghost" to="/users">
          ← Users
        </Link>
        <button type="button" className="btn btn-secondary" onClick={load} disabled={busy}>
          Refresh
        </button>
      </div>

      <div className="panel user-detail">
        <div className="user-detail-hero">
          <div className="user-detail-photo">
            <FacePhoto
              key={`${user.employee_no}-${photoKey}`}
              device={device}
              employeeNo={user.employee_no}
              alt={user.name || user.employee_no}
            />
          </div>
          <div className="user-detail-summary">
            <h2>{user.name || "Unnamed"}</h2>
            <p className="meta">Employee ID {user.employee_no}</p>
            <div className="chips" style={{ marginTop: "0.6rem" }}>
              <span className={`badge ${user.num_of_face > 0 ? "ok" : "warn"}`}>
                Face {user.num_of_face > 0 ? "yes" : "no"}
              </span>
              <span className={`badge ${user.num_of_fingerprint > 0 ? "ok" : "warn"}`}>
                Fingerprint {user.num_of_fingerprint || 0}
              </span>
              <span className="badge ok">Cards {user.num_of_card || 0}</span>
            </div>
          </div>
        </div>

        <div className="detail-grid">
          <div>
            <span className="detail-label">Gender</span>
            <strong>{user.gender || "—"}</strong>
          </div>
          <div>
            <span className="detail-label">User type</span>
            <strong>{user.user_type || "—"}</strong>
          </div>
          <div>
            <span className="detail-label">Valid from</span>
            <strong>{user.valid_from || "—"}</strong>
          </div>
          <div>
            <span className="detail-label">Valid until</span>
            <strong>{user.valid_until || "—"}</strong>
          </div>
          <div>
            <span className="detail-label">Access plan</span>
            <strong>{user.access_plan || "—"}</strong>
          </div>
          <div>
            <span className="detail-label">Door right</span>
            <strong>{user.door_right || "—"}</strong>
          </div>
        </div>

        <div className="actions" style={{ marginTop: "1rem" }}>
          <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>
            Edit details
          </button>
          <button type="button" className="btn btn-primary" onClick={() => setFaceOpen(true)}>
            {user.num_of_face > 0 ? "Update face" : "Add face"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => setFpOpen(true)}>
            Capture fingerprint
          </button>
          <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>
            Delete
          </button>
        </div>
      </div>

      {editing && (
        <Modal title="Edit user" onClose={() => setEditing(false)}>
          <UserForm
            initial={{
              employee_no: user.employee_no,
              name: user.name,
              gender: user.gender === "unknown" ? "unspecified" : user.gender,
              valid_from: user.valid_from,
              valid_until: user.valid_until,
              access_plan: user.access_plan,
            }}
            onSubmit={onSave}
            onCancel={() => setEditing(false)}
          />
        </Modal>
      )}

      {faceOpen && (
        <FaceCapture
          userName={user.name || user.employee_no}
          busy={busy}
          onClose={() => setFaceOpen(false)}
          onCapture={onFace}
        />
      )}

      {fpOpen && (
        <FingerprintCapture
          userName={user.name || user.employee_no}
          busy={busy}
          onClose={() => setFpOpen(false)}
          onStart={onFingerprint}
        />
      )}

      {confirmDelete && (
        <Modal
          title="Delete user?"
          onClose={() => setConfirmDelete(false)}
          footer={
            <div className="form-row two">
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={onDelete} disabled={busy}>
                Delete {user.employee_no}
              </button>
            </div>
          }
        >
          <p>
            Remove <strong>{user.name}</strong> from the Hikvision terminal?
          </p>
        </Modal>
      )}
    </div>
  );
}
