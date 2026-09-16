import { Modal } from "./Modal";

export default function FingerprintCapture({ userName, busy, onClose, onStart }) {
  return (
    <Modal title={`Fingerprint · ${userName || "employee"}`} onClose={busy ? undefined : onClose}>
      <div className="form-grid">
        <p>
          Fingerprints are captured on the <strong>Hikvision terminal sensor</strong>, not on this
          phone/PC.
        </p>
        <ol style={{ margin: 0, paddingLeft: "1.2rem", color: "var(--muted)", lineHeight: 1.55 }}>
          <li>Stand next to the terminal for this site.</li>
          <li>Tap <strong>Start capture</strong> below.</li>
          <li>Immediately place one finger on the sensor and keep it still until it beeps/finishes.</li>
        </ol>
        {busy ? (
          <div className="empty">
            <div className="spinner" aria-hidden />
            <p>Waiting for the terminal sensor… place your finger now.</p>
          </div>
        ) : (
          <>
            <button type="button" className="btn btn-primary btn-block" onClick={onStart}>
              Start capture
            </button>
            <button type="button" className="btn btn-ghost btn-block" onClick={onClose}>
              Cancel
            </button>
          </>
        )}
      </div>
    </Modal>
  );
}
