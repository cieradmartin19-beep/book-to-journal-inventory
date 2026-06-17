"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import { Barcode, Camera, RefreshCw, Square } from "lucide-react";
import { createIsbnBarcodeReader, scannedValueToIsbn } from "@/lib/book-lookup";

type ScannerDiagnostics = {
  currentUrl: string;
  isHttps: boolean;
  mediaDevicesExists: boolean;
  getUserMediaExists: boolean;
  cameraPermissionState: string;
  availableDevices: MediaDeviceInfo[];
  selectedDeviceId: string;
  startError: string;
  decodeError: string;
};

type LiveBarcodeScannerProps = {
  disabled?: boolean;
  onDetected: (isbn: string) => void;
};

function describeError(error: unknown) {
  if (error instanceof DOMException) return `${error.name}: ${error.message}`;
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error || "Unknown error");
}

function cameraHelp(error: string) {
  if (!error) return "";
  if (/NotAllowedError|SecurityError|PermissionDeniedError|denied/i.test(error)) {
    return "Camera permission was denied. In Safari, tap AA or the lock icon in the address bar, open Website Settings, and allow Camera. In Chrome, click the lock icon beside the URL, allow Camera, then reload.";
  }
  if (/NotFoundError|DevicesNotFoundError|OverconstrainedError|No camera/i.test(error)) {
    return "No camera was found. Use manual ISBN entry or upload a barcode photo.";
  }
  if (/https|secure|mediaDevices|getUserMedia/i.test(error)) {
    return "Live camera scanning requires HTTPS in production or localhost during development.";
  }
  return "Use manual ISBN entry or upload a barcode photo if live scanning is blocked.";
}

function initialDiagnostics(): ScannerDiagnostics {
  return {
    currentUrl: "",
    isHttps: false,
    mediaDevicesExists: false,
    getUserMediaExists: false,
    cameraPermissionState: "unknown",
    availableDevices: [],
    selectedDeviceId: "",
    startError: "",
    decodeError: ""
  };
}

export default function LiveBarcodeScanner({ disabled = false, onDetected }: LiveBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const activeModeRef = useRef<"idle" | "test" | "scan">("idle");
  const [mode, setMode] = useState<"idle" | "test" | "scan">("idle");
  const [status, setStatus] = useState("Camera diagnostics are ready.");
  const [detectedIsbn, setDetectedIsbn] = useState("");
  const [diagnostics, setDiagnostics] = useState<ScannerDiagnostics>(() => initialDiagnostics());

  const updateDiagnostics = useCallback((patch: Partial<ScannerDiagnostics>) => {
    setDiagnostics((current) => ({ ...current, ...patch }));
  }, []);

  const refreshDiagnostics = useCallback(async () => {
    const mediaDevicesExists = Boolean(navigator.mediaDevices);
    const getUserMediaExists = Boolean(navigator.mediaDevices?.getUserMedia);
    let cameraPermissionState = "unsupported";
    let availableDevices: MediaDeviceInfo[] = [];

    try {
      const permissionStatus = await navigator.permissions?.query?.({ name: "camera" as PermissionName });
      cameraPermissionState = permissionStatus?.state ?? "unknown";
    } catch (error) {
      cameraPermissionState = `unavailable (${describeError(error)})`;
    }

    try {
      if (mediaDevicesExists && navigator.mediaDevices.enumerateDevices) {
        availableDevices = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "videoinput");
      }
    } catch (error) {
      updateDiagnostics({ startError: `Could not list cameras: ${describeError(error)}` });
    }

    updateDiagnostics({
      currentUrl: window.location.href,
      isHttps: window.location.protocol === "https:" || window.location.hostname === "localhost",
      mediaDevicesExists,
      getUserMediaExists,
      cameraPermissionState,
      availableDevices
    });
  }, [updateDiagnostics]);

  const stopCamera = useCallback((nextStatus = "Camera stopped.", refreshAfterStop = true) => {
    activeModeRef.current = "idle";
    scannerControlsRef.current?.stop();
    scannerControlsRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setMode("idle");
    setStatus(nextStatus);
    if (refreshAfterStop) {
      void refreshDiagnostics();
    }
  }, [refreshDiagnostics]);

  useEffect(() => {
    void refreshDiagnostics();
    return () => {
      stopCamera("Camera stopped while leaving the page.", false);
    };
  }, [refreshDiagnostics, stopCamera]);

  async function openCameraStream() {
    updateDiagnostics({ startError: "", decodeError: "" });

    if (!navigator.mediaDevices) {
      throw new Error("navigator.mediaDevices does not exist in this browser.");
    }

    if (!navigator.mediaDevices.getUserMedia) {
      throw new Error("navigator.mediaDevices.getUserMedia does not exist in this browser.");
    }

    const preferredDevice = diagnostics.availableDevices.find((device) => /back|rear|environment/i.test(device.label));
    const selectedDeviceId = diagnostics.selectedDeviceId || preferredDevice?.deviceId || "";
    const videoConstraints: MediaTrackConstraints = selectedDeviceId
      ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
      : { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } };

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: videoConstraints
    });

    streamRef.current = stream;
    const track = stream.getVideoTracks()[0];
    const settings = track?.getSettings?.();
    const nextDeviceId = settings?.deviceId || selectedDeviceId;
    updateDiagnostics({ selectedDeviceId: nextDeviceId });
    await refreshDiagnostics();

    const video = videoRef.current;
    if (!video) throw new Error("Camera preview element is missing.");
    video.setAttribute("playsinline", "true");
    video.srcObject = stream;
    await video.play();

    return stream;
  }

  async function testCamera() {
    setDetectedIsbn("");
    setStatus("Opening camera preview...");
    stopCamera("Opening camera preview...");
    setMode("test");
    activeModeRef.current = "test";

    try {
      await openCameraStream();
      setStatus("Camera preview is open. If you see video, camera permission is working.");
      setMode("test");
    } catch (error) {
      const message = describeError(error);
      updateDiagnostics({ startError: message });
      setStatus(message);
      setMode("idle");
      activeModeRef.current = "idle";
    }
  }

  async function startBarcodeScan() {
    setDetectedIsbn("");
    setStatus("Starting barcode scanner...");
    stopCamera("Starting barcode scanner...");
    setMode("scan");
    activeModeRef.current = "scan";

    try {
      const stream = await openCameraStream();
      const video = videoRef.current;
      if (!video) throw new Error("Camera preview element is missing.");

      const codeReader = createIsbnBarcodeReader();
      const controls = await codeReader.decodeFromStream(stream, video, (result, error) => {
        if (activeModeRef.current !== "scan") return;

        if (error) {
          const message = describeError(error);
          updateDiagnostics({ decodeError: message });
        }

        if (!result) return;

        const raw = result.getText();
        const isbn = scannedValueToIsbn(raw);
        if (!isbn) {
          updateDiagnostics({ decodeError: `Barcode detected, but not an ISBN: ${raw}` });
          setStatus("Barcode found, but it was not an ISBN. Try the ISBN barcode or enter it manually.");
          return;
        }

        setDetectedIsbn(isbn);
        setStatus(`Detected ISBN ${isbn}. Looking up book details...`);
        stopCamera(`Detected ISBN ${isbn}.`);
        onDetected(isbn);
      });

      scannerControlsRef.current = controls;
      setMode("scan");
      setStatus("Scanning... hold the ISBN barcode inside the frame.");
    } catch (error) {
      const message = describeError(error);
      updateDiagnostics({ startError: message });
      setStatus(message);
      stopCamera(message);
    }
  }

  const hasNoCamera =
    (diagnostics.cameraPermissionState === "granted" && diagnostics.availableDevices.length === 0) ||
    /NotFoundError|DevicesNotFoundError|No camera/i.test(diagnostics.startError);
  const helpText = cameraHelp(diagnostics.startError || diagnostics.decodeError);

  return (
    <div className="grid gap-3">
      <div className="grid gap-2 sm:grid-cols-3">
        <button className="btn-secondary w-full" disabled={disabled || mode !== "idle"} onClick={testCamera}>
          <Camera size={20} aria-hidden />
          Test Camera
        </button>
        <button className="btn-primary w-full" disabled={disabled || mode !== "idle"} onClick={startBarcodeScan}>
          <Barcode size={20} aria-hidden />
          Start Barcode Scan
        </button>
        <button className="btn-secondary w-full" disabled={mode === "idle"} onClick={() => stopCamera()}>
          <Square size={20} aria-hidden />
          Stop Camera
        </button>
      </div>

      {detectedIsbn ? (
        <p className="rounded-lg bg-mint/30 p-3 text-sm font-black text-ink">Detected ISBN: {detectedIsbn}</p>
      ) : null}

      <div className="grid gap-3 rounded-lg border-2 border-ink/10 bg-white p-3">
        <div className="relative overflow-hidden rounded-lg bg-ink">
          <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
          {mode === "scan" ? (
            <div className="pointer-events-none absolute inset-x-8 top-1/2 h-20 -translate-y-1/2 rounded-lg border-2 border-honey shadow-[0_0_0_999px_rgba(0,0,0,0.25)]" />
          ) : null}
        </div>
        <p className="text-sm font-bold text-ink/75">{status}</p>
        {hasNoCamera ? (
          <p className="rounded-lg bg-rose/15 p-3 text-sm font-bold text-ink">
            No camera found. Use manual ISBN entry.
          </p>
        ) : null}
        {helpText ? <p className="rounded-lg bg-honey/25 p-3 text-sm font-bold text-ink/75">{helpText}</p> : null}
      </div>

      <div className="rounded-lg border-2 border-ink/10 bg-white p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-black uppercase tracking-wide text-marigold">Scanner diagnostics</p>
          <button className="inline-flex items-center gap-1 text-sm font-black text-ink/70" onClick={refreshDiagnostics}>
            <RefreshCw size={15} aria-hidden />
            Refresh
          </button>
        </div>
        <dl className="grid gap-2 text-xs font-bold text-ink/70">
          <div className="grid gap-1 sm:grid-cols-[170px_minmax(0,1fr)]">
            <dt>Current URL</dt>
            <dd className="break-all text-ink">{diagnostics.currentUrl || "unknown"}</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[170px_minmax(0,1fr)]">
            <dt>HTTPS or localhost?</dt>
            <dd className="text-ink">{diagnostics.isHttps ? "yes" : "no"}</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[170px_minmax(0,1fr)]">
            <dt>mediaDevices exists?</dt>
            <dd className="text-ink">{diagnostics.mediaDevicesExists ? "yes" : "no"}</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[170px_minmax(0,1fr)]">
            <dt>getUserMedia exists?</dt>
            <dd className="text-ink">{diagnostics.getUserMediaExists ? "yes" : "no"}</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[170px_minmax(0,1fr)]">
            <dt>Camera permission</dt>
            <dd className="break-words text-ink">{diagnostics.cameraPermissionState}</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[170px_minmax(0,1fr)]">
            <dt>Selected camera deviceId</dt>
            <dd className="break-all text-ink">{diagnostics.selectedDeviceId || "none"}</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[170px_minmax(0,1fr)]">
            <dt>Video input devices</dt>
            <dd className="grid gap-1 text-ink">
              {diagnostics.availableDevices.length
                ? diagnostics.availableDevices.map((device, index) => (
                    <span className="break-all" key={device.deviceId || index}>
                      {device.label || `Camera ${index + 1}`} ({device.deviceId || "no deviceId"})
                    </span>
                  ))
                : "none listed"}
            </dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[170px_minmax(0,1fr)]">
            <dt>Scanner start errors</dt>
            <dd className="break-words text-ink">{diagnostics.startError || "none"}</dd>
          </div>
          <div className="grid gap-1 sm:grid-cols-[170px_minmax(0,1fr)]">
            <dt>Scanner decode errors</dt>
            <dd className="break-words text-ink">{diagnostics.decodeError || "none"}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
