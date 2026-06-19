"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import { Barcode, Camera, Square, Upload } from "lucide-react";
import {
  createIsbnBarcodeReader,
  decodeBarcodeFromImage,
  fileToDataUrl,
  scannedValueToIsbn
} from "@/lib/book-lookup";

type ScannerDiagnostics = {
  currentUrl: string;
  isHttps: boolean;
  mediaDevicesExists: boolean;
  getUserMediaExists: boolean;
  cameraPermissionState: string;
  availableDevices: MediaDeviceInfo[];
  selectedDeviceId: string;
  detectedBarcode: string;
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

const SCANNER_FALLBACK_MESSAGE = "Scanner couldn't read the barcode. Try again, upload a barcode photo, or type the ISBN.";

function initialDiagnostics(): ScannerDiagnostics {
  return {
    currentUrl: "",
    isHttps: false,
    mediaDevicesExists: false,
    getUserMediaExists: false,
    cameraPermissionState: "unknown",
    availableDevices: [],
    selectedDeviceId: "",
    detectedBarcode: "",
    startError: "",
    decodeError: ""
  };
}

export default function LiveBarcodeScanner({ disabled = false, onDetected }: LiveBarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scannerControlsRef = useRef<IScannerControls | null>(null);
  const scanTimeoutRef = useRef<number | null>(null);
  const activeModeRef = useRef<"idle" | "test" | "scan">("idle");
  const [mode, setMode] = useState<"idle" | "test" | "scan">("idle");
  const [status, setStatus] = useState("Ready to scan a barcode.");
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

  async function applyContinuousFocus(stream: MediaStream) {
    const track = stream.getVideoTracks()[0];
    if (!track?.getCapabilities || !track.applyConstraints) return;

    try {
      const capabilities = track.getCapabilities() as MediaTrackCapabilities & { focusMode?: string[] };
      if (capabilities.focusMode?.includes("continuous")) {
        await track.applyConstraints({
          advanced: [{ focusMode: "continuous" } as unknown as MediaTrackConstraintSet]
        });
      }
    } catch (error) {
      updateDiagnostics({ decodeError: `Continuous autofocus unavailable: ${describeError(error)}` });
    }
  }

  const stopCamera = useCallback((nextStatus = "Camera stopped.", refreshAfterStop = true) => {
    if (scanTimeoutRef.current) {
      window.clearTimeout(scanTimeoutRef.current);
      scanTimeoutRef.current = null;
    }
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
      activeModeRef.current = "idle";
      scannerControlsRef.current?.stop();
      scannerControlsRef.current = null;
      if (scanTimeoutRef.current) window.clearTimeout(scanTimeoutRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [refreshDiagnostics]);

  async function openCameraStream() {
    updateDiagnostics({ startError: "", decodeError: "", detectedBarcode: "" });

    if (!navigator.mediaDevices) {
      throw new Error("navigator.mediaDevices does not exist in this browser.");
    }

    if (!navigator.mediaDevices.getUserMedia) {
      throw new Error("navigator.mediaDevices.getUserMedia does not exist in this browser.");
    }

    const preferredDevice = diagnostics.availableDevices.find((device) => /back|rear|environment/i.test(device.label));
    const selectedDeviceId = diagnostics.selectedDeviceId || preferredDevice?.deviceId || "";
    const sharpVideoConstraints = {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 30, max: 60 }
    } satisfies MediaTrackConstraints;
    const videoConstraints: MediaTrackConstraints = selectedDeviceId
      ? { ...sharpVideoConstraints, deviceId: { exact: selectedDeviceId } }
      : { ...sharpVideoConstraints, facingMode: { ideal: "environment" } };

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: videoConstraints
    });

    streamRef.current = stream;
    await applyContinuousFocus(stream);
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
    updateDiagnostics({ detectedBarcode: "", decodeError: "" });
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
      setStatus("Camera couldn't start. Try again, upload a barcode photo, or type the ISBN.");
      setMode("idle");
      activeModeRef.current = "idle";
    }
  }

  async function startBarcodeScan() {
    setDetectedIsbn("");
    updateDiagnostics({ detectedBarcode: "", decodeError: "" });
    setStatus("Starting barcode scanner...");
    stopCamera("Starting barcode scanner...");
    try {
      const stream = await openCameraStream();
      const video = videoRef.current;
      if (!video) throw new Error("Camera preview element is missing.");

      const codeReader = createIsbnBarcodeReader();
      activeModeRef.current = "scan";
      setMode("scan");
      scanTimeoutRef.current = window.setTimeout(() => {
        if (activeModeRef.current === "scan") {
          stopCamera("No barcode detected. Try uploading a barcode photo or typing the ISBN.");
        }
      }, 15000);
      const controls = await codeReader.decodeFromStream(stream, video, (result, error) => {
        if (activeModeRef.current !== "scan") return;

        if (error) {
          const message = describeError(error);
          updateDiagnostics({ decodeError: message });
        }

        if (!result) return;

        const raw = result.getText();
        updateDiagnostics({ detectedBarcode: raw, decodeError: "" });
        const isbn = scannedValueToIsbn(raw);
        if (!isbn) {
          updateDiagnostics({ decodeError: `Barcode detected, but not an ISBN: ${raw}` });
          setStatus(SCANNER_FALLBACK_MESSAGE);
          return;
        }

        setDetectedIsbn(isbn);
        setStatus(`Detected ISBN ${isbn}. Looking up book details...`);
        stopCamera(`Detected ISBN ${isbn}.`);
        onDetected(isbn);
      });

      scannerControlsRef.current = controls;
      setStatus("Scanning... hold the ISBN barcode inside the frame.");
    } catch (error) {
      const message = describeError(error);
      updateDiagnostics({ startError: message });
      setStatus(SCANNER_FALLBACK_MESSAGE);
      stopCamera(SCANNER_FALLBACK_MESSAGE);
    }
  }

  async function decodeUploadedBarcodePhoto(file: File) {
    setDetectedIsbn("");
    setStatus("Decoding uploaded barcode photo...");
    updateDiagnostics({ detectedBarcode: "", startError: "", decodeError: "" });

    try {
      const dataUrl = await fileToDataUrl(file);
      const result = await decodeBarcodeFromImage(dataUrl);
      updateDiagnostics({
        detectedBarcode: result.raw,
        decodeError: result.isbn ? "" : `Barcode detected, but not an ISBN: ${result.raw}`
      });

      if (!result.isbn) {
        setStatus(SCANNER_FALLBACK_MESSAGE);
        return;
      }

      setDetectedIsbn(result.isbn);
      setStatus(`Detected ISBN ${result.isbn}. Looking up book details...`);
      onDetected(result.isbn);
    } catch (error) {
      const message = describeError(error);
      updateDiagnostics({ decodeError: message });
      setStatus(SCANNER_FALLBACK_MESSAGE);
    } finally {
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  }

  function handleBarcodePhotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    void decodeUploadedBarcodePhoto(file);
  }

  return (
    <div className="grid gap-3">
      <div className="grid gap-2 sm:grid-cols-4">
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
        <button
          className="btn-secondary w-full"
          disabled={disabled}
          onClick={() => uploadInputRef.current?.click()}
          type="button"
        >
          <Upload size={20} aria-hidden />
          Upload Barcode Photo
        </button>
        <input
          ref={uploadInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleBarcodePhotoUpload}
          type="file"
        />
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
      </div>
    </div>
  );
}
