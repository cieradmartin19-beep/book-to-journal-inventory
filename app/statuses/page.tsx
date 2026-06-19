"use client";

import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { createStatus, deleteStatus, fetchStatuses, updateStatus } from "@/lib/statuses";
import type { CustomStatus } from "@/lib/types";

export default function ManageStatusesPage() {
  const [statuses, setStatuses] = useState<CustomStatus[]>([]);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#E9E1D2");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadStatuses() {
    setError("");
    try {
      setStatuses(await fetchStatuses());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Statuses could not be loaded.");
    }
  }

  useEffect(() => {
    void loadStatuses();
  }, []);

  async function addStatus() {
    setError("");
    setMessage("");
    try {
      const created = await createStatus(name, color, statuses.length);
      setStatuses((current) => [...current, created].sort((a, b) => a.sort_order - b.sort_order));
      setName("");
      setMessage(`${created.name} created.`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Status could not be created.");
    }
  }

  async function saveStatus(status: CustomStatus) {
    setError("");
    setMessage("");
    try {
      const saved = await updateStatus(status.id, {
        name: status.name,
        color: status.color,
        sort_order: status.sort_order
      });
      setStatuses((current) => current.map((item) => (item.id === saved.id ? saved : item)).sort((a, b) => a.sort_order - b.sort_order));
      setMessage(`${saved.name} saved.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Status could not be saved.");
    }
  }

  async function moveStatus(index: number, direction: -1 | 1) {
    const swapIndex = index + direction;
    if (swapIndex < 0 || swapIndex >= statuses.length) return;

    const next = [...statuses];
    const current = next[index];
    const swap = next[swapIndex];
    next[index] = { ...swap, sort_order: index };
    next[swapIndex] = { ...current, sort_order: swapIndex };
    const previous = statuses;
    setStatuses(next);
    setError("");
    try {
      await Promise.all([updateStatus(next[index].id, next[index]), updateStatus(next[swapIndex].id, next[swapIndex])]);
    } catch (moveError) {
      setStatuses(previous);
      setError(moveError instanceof Error ? moveError.message : "Statuses could not be reordered.");
    }
  }

  async function removeStatus(status: CustomStatus) {
    if (!window.confirm(`Delete ${status.name}? Books assigned to it will keep their text status until reassigned.`)) return;
    setError("");
    setMessage("");
    try {
      await deleteStatus(status.id);
      setStatuses((current) => current.filter((item) => item.id !== status.id));
      setMessage(`${status.name} deleted.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Status could not be deleted.");
    }
  }

  return (
    <AppShell>
      <div className="mb-5">
        <Link href="/library" className="btn-secondary">
          <ArrowLeft size={20} aria-hidden />
          Library
        </Link>
      </div>

      <section className="grid gap-5 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
        <div className="panel p-4 sm:p-5">
          <p className="text-sm font-black uppercase tracking-wide text-marigold">Manage Statuses</p>
          <h1 className="mt-1 font-serif text-3xl font-black sm:text-4xl">Custom workflow statuses</h1>
          <p className="mt-3 text-sm font-semibold text-ink/65">Statuses are user-specific and drive dashboard counts and filters.</p>

          <div className="mt-5 grid gap-3">
            <label className="grid gap-2">
              <span className="label">New status name</span>
              <input className="field" value={name} onChange={(event) => setName(event.target.value)} />
            </label>
            <label className="grid gap-2">
              <span className="label">Color</span>
              <input className="h-12 w-full rounded-lg border-2 border-ink/15 bg-white p-1" type="color" value={color} onChange={(event) => setColor(event.target.value)} />
            </label>
            <button className="btn-primary w-full" onClick={addStatus}>
              <Plus size={20} aria-hidden />
              Create Status
            </button>
          </div>

          {message ? <p className="mt-4 rounded-lg bg-mint/25 p-3 text-sm font-bold text-ink">{message}</p> : null}
          {error ? <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm font-bold text-red-800">{error}</p> : null}
        </div>

        <div className="panel grid gap-3 p-4 sm:p-5">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-marigold">Your statuses</p>
            <p className="mt-1 text-sm font-semibold text-ink/65">Rename, recolor, delete, or reorder statuses.</p>
          </div>

          {statuses.map((status, index) => (
            <div className="grid gap-3 rounded-lg border-2 border-ink/10 bg-white p-3 sm:grid-cols-[auto_auto_minmax(0,1fr)_80px_auto_auto] sm:items-center" key={status.id}>
              <button className="btn-secondary" disabled={index === 0} onClick={() => moveStatus(index, -1)}>
                <ArrowUp size={18} aria-hidden />
              </button>
              <button className="btn-secondary" disabled={index === statuses.length - 1} onClick={() => moveStatus(index, 1)}>
                <ArrowDown size={18} aria-hidden />
              </button>
              <input
                className="field"
                value={status.name}
                onChange={(event) => {
                  const nextName = event.target.value;
                  setStatuses((current) => current.map((item) => item.id === status.id ? { ...item, name: nextName } : item));
                }}
              />
              <input
                className="h-11 w-full rounded-lg border-2 border-ink/15 bg-white p-1"
                type="color"
                value={status.color}
                onChange={(event) => {
                  const nextColor = event.target.value;
                  setStatuses((current) => current.map((item) => item.id === status.id ? { ...item, color: nextColor } : item));
                }}
              />
              <button className="btn-secondary" onClick={() => saveStatus(status)}>
                <Save size={18} aria-hidden />
                Save
              </button>
              <button className="btn-secondary" onClick={() => removeStatus(status)}>
                <Trash2 size={18} aria-hidden />
                Delete
              </button>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
