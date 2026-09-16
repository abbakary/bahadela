import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useDeviceContext } from "../context/DeviceContext";
import { useToast } from "../components/Toast";
import FaceCapture from "../components/FaceCapture";
import FingerprintCapture from "../components/FingerprintCapture";
import UserForm from "./UserForm";

export default function Register() {
  const { device } = useDeviceContext();
  const { push } = useToast();
  const [step, setStep] = useState(1);
  const [employee, setEmployee] = useState(null);
  const [faceOpen, setFaceOpen] = useState(false);
  const [fpOpen, setFpOpen] = useState(false);
  const [faceBusy, setFaceBusy] = useState(false);
  const [fpBusy, setFpBusy] = useState(false);
  const [done, setDone] = useState({ face: false, fingerprint: false });

  if (!device) {
    return (
      <div className="panel empty">
        <p>Connect a site or device IP before registering.</p>
        <Link className="btn btn-primary" to="/device">
          Open device setup
        </Link>
      </div>
    );
  }

  const onEmployee = async (form) => {
    if (!form.confirm) {
      push("Confirm that the information is correct.", "error");
      return;
    }
    try {
      await api.verifyPin(form.pin);
      const { pin, confirm, ...record } = form;
      const result = await api.createUser(device, record, { requirePin: true, pin });
      setEmployee(result.user);
      setStep(2);
      push(`Employee ${result.action} on device`, "success");
    } catch (err) {
      push(err.message, "error");
    }
  };

  const onFace = async (file) => {
    if (!file || !employee) return;
    setFaceBusy(true);
    try {
      await api.uploadFace(device, employee.employee_no, file);
      setDone((d) => ({ ...d, face: true }));
      setFaceOpen(false);
      push("Face registered successfully", "success");
    } catch (err) {
      push(err.message, "error");
    } finally {
      setFaceBusy(false);
    }
  };

  const onFingerprint = async () => {
    if (!employee) return;
    setFpBusy(true);
    try {
      const result = await api.fingerprint(device, employee.employee_no);
      setDone((d) => ({ ...d, fingerprint: true }));
      setFpOpen(false);
      push(result.message, "success");
    } catch (err) {
      push(err.message, "error");
    } finally {
      setFpBusy(false);
    }
  };

  return (
    <div>
      <div className="panel">
        <h2>Employee registration</h2>
        <p>Enter information, then register face or fingerprint on the connected terminal.</p>
        <div className="steps">
          <div className={`step-pill ${step === 1 ? "active" : ""}`}>1 · Details</div>
          <div className={`step-pill ${step === 2 ? "active" : ""}`}>2 · Biometrics</div>
        </div>

        {step === 1 ? (
          <UserForm showPin onSubmit={onEmployee} />
        ) : (
          <div className="form-grid">
            <div className="user-card">
              <strong>
                {employee.employee_no} · {employee.name}
              </strong>
              <div className="meta">Valid until {employee.valid_until}</div>
              <button type="button" className="btn btn-ghost" onClick={() => setStep(1)}>
                Change employee information
              </button>
            </div>

            <div className="panel" style={{ marginBottom: 0 }}>
              <h3>Face registration</h3>
              <p>Open the camera on this phone/PC, take a clear front-facing photo, then save it to the terminal.</p>
              <button type="button" className="btn btn-primary btn-block" onClick={() => setFaceOpen(true)}>
                {done.face ? "Face saved — capture again" : "Open camera"}
              </button>
            </div>

            <div className="panel" style={{ marginBottom: 0 }}>
              <h3>Fingerprint registration</h3>
              <p>Capture happens on the Hikvision terminal sensor. Stand beside it before starting.</p>
              <button type="button" className="btn btn-primary btn-block" onClick={() => setFpOpen(true)}>
                {done.fingerprint ? "Fingerprint saved — capture again" : "Capture fingerprint"}
              </button>
            </div>

            {(done.face || done.fingerprint) && (
              <div className="panel" style={{ marginBottom: 0 }}>
                <p className="badge ok">Registration saved on the device.</p>
                <button
                  type="button"
                  className="btn btn-secondary btn-block"
                  onClick={() => {
                    setEmployee(null);
                    setDone({ face: false, fingerprint: false });
                    setStep(1);
                  }}
                >
                  Finish and register another
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {faceOpen && (
        <FaceCapture
          userName={employee?.name}
          busy={faceBusy}
          onClose={() => setFaceOpen(false)}
          onCapture={onFace}
        />
      )}

      {fpOpen && (
        <FingerprintCapture
          userName={employee?.name}
          busy={fpBusy}
          onClose={() => setFpOpen(false)}
          onStart={onFingerprint}
        />
      )}
    </div>
  );
}
