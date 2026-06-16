"use client";

import { useEffect, useState } from "react";
import { Hash } from "lucide-react";
import { prefixChoices, sanitizePrefix } from "@/lib/mock-data";
import { loadInventoryPrefix, saveInventoryPrefix } from "@/lib/books-store";

export function InventoryPrefixSettings({
  value,
  onChange
}: {
  value: string;
  onChange: (prefix: string) => void;
}) {
  const [mode, setMode] = useState<"GB" | "BK" | "JRN" | "CUSTOM">("BK");
  const [customPrefix, setCustomPrefix] = useState("");

  useEffect(() => {
    const stored = loadInventoryPrefix();
    onChange(stored);
    if (stored === "GB" || stored === "BK" || stored === "JRN") {
      setMode(stored);
    } else {
      setMode("CUSTOM");
      setCustomPrefix(stored);
    }
  }, [onChange]);

  function update(nextValue: string) {
    const cleanPrefix = saveInventoryPrefix(nextValue);
    onChange(cleanPrefix);
  }

  return (
    <div className="rounded-lg border-2 border-ink/10 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <Hash size={20} aria-hidden />
        <h2 className="font-black">Inventory ID prefix</h2>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="grid gap-2">
          <span className="label">Prefix type</span>
          <select
            className="field"
            value={mode}
            onChange={(event) => {
              const next = event.target.value as typeof mode;
              setMode(next);
              if (next === "CUSTOM") {
                if (customPrefix) update(customPrefix);
              } else {
                update(next);
              }
            }}
          >
            {prefixChoices.map((choice) => (
              <option key={choice} value={choice}>
                {choice === "CUSTOM" ? "Custom prefix" : choice}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2">
          <span className="label">Custom prefix</span>
          <input
            className="field"
            placeholder="BK"
            disabled={mode !== "CUSTOM"}
            value={mode === "CUSTOM" ? customPrefix : value}
            onChange={(event) => {
              const cleanPrefix = sanitizePrefix(event.target.value);
              setCustomPrefix(cleanPrefix);
              update(cleanPrefix);
            }}
          />
        </label>
      </div>
    </div>
  );
}
