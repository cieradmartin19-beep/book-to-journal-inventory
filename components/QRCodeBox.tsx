"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { QrCode } from "lucide-react";

export function QRCodeBox({ value }: { value: string }) {
  const [src, setSrc] = useState("");

  useEffect(() => {
    if (!value) {
      setSrc("");
      return;
    }

    QRCode.toDataURL(value, {
      margin: 1,
      width: 360,
      color: { dark: "#2B2118", light: "#FFF9EC" }
    }).then(setSrc);
  }, [value]);

  return (
    <div className="panel grid gap-4 p-4 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-lg bg-honey/50">
        <QrCode size={24} aria-hidden />
      </div>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="QR code for public library" className="mx-auto w-44 rounded-lg border-2 border-ink/10 sm:w-48" />
      ) : (
        <div className="mx-auto h-44 w-44 animate-pulse rounded-lg bg-ink/10 sm:h-48 sm:w-48" />
      )}
      <p className="break-all text-sm font-bold text-ink/70">{value || "Preparing share link..."}</p>
    </div>
  );
}
