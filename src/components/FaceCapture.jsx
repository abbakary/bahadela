import { useEffect, useRef, useState } from "react";
import { Modal } from "./Modal";

async function blobFromCanvas(canvas) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.92);
  });
}

export default function FaceCapture({ userName, onClose, onCapture, busy }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
        }
      } catch (err) {
        setError(
          "Camera not available on this device. You can still choose a photo file below.",
        );
      }
    }
    start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const takePhoto = async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await blobFromCanvas(canvas);
    if (!blob) {
      setError("Could not capture photo. Try again.");
      return;
    }
    const file = new File([blob], "face.jpg", { type: "image/jpeg" });
    setPreview(URL.createObjectURL(blob));
    streamRef.current?.getTracks().forEach((t) => t.stop());
    setCameraReady(false);
    await onCapture(file);
  };

  const onFile = async (file) => {
    if (!file) return;
    // Convert non-JPEG images via canvas when possible so Hikvision gets JPEG.
    if (!file.type.includes("jpeg") && !file.name.toLowerCase().endsWith(".jpg")) {
      try {
        const bitmap = await createImageBitmap(file);
        const canvas = document.createElement("canvas");
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        canvas.getContext("2d").drawImage(bitmap, 0, 0);
        const blob = await blobFromCanvas(canvas);
        file = new File([blob], "face.jpg", { type: "image/jpeg" });
      } catch {
        /* send original */
      }
    }
    setPreview(URL.createObjectURL(file));
    await onCapture(file);
  };

  return (
    <Modal title={`Face · ${userName || "employee"}`} onClose={onClose}>
      <div className="face-capture">
        <p>Use a clear front-facing photo with only one person visible.</p>
        {error ? <p className="badge warn">{error}</p> : null}

        <div className="face-capture-frame">
          {preview ? (
            <img src={preview} alt="Captured face" />
          ) : (
            <video ref={videoRef} playsInline muted autoPlay />
          )}
        </div>

        <div className="form-grid">
          {cameraReady && !preview ? (
            <button type="button" className="btn btn-primary btn-block" disabled={busy} onClick={takePhoto}>
              {busy ? "Saving to device…" : "Take photo & save"}
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-secondary btn-block"
            disabled={busy}
            onClick={() => fileRef.current?.click()}
          >
            {busy ? "Saving…" : "Choose photo from gallery"}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="user"
            hidden
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          <button type="button" className="btn btn-ghost btn-block" onClick={onClose} disabled={busy}>
            Cancel
          </button>
        </div>
      </div>
    </Modal>
  );
}
