import { useEffect, useRef, useState } from "react";
import { BrowserQRCodeReader, type IScannerControls } from "@zxing/browser";

export function QrScanner({ onResult, onClose }: { onResult: (value: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<IScannerControls | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!video.current) return;
    const reader = new BrowserQRCodeReader();
    reader.decodeFromConstraints({ video: { facingMode: "environment" } }, video.current, (result, scanError) => {
      if (result) {
        controls.current?.stop();
        onResult(result.getText());
      } else if (scanError && scanError.name !== "NotFoundException") {
        setError(scanError.message);
      }
    }).then((value) => { controls.current = value; }).catch((reason: Error) => setError(reason.message));
    return () => controls.current?.stop();
  }, [onResult]);

  return (
    <div className="scanner">
      <video ref={video} muted playsInline />
      {error && <p className="error" role="alert">{error}</p>}
      <button type="button" className="secondary" onClick={onClose}>Close camera</button>
    </div>
  );
}
