"use client";

import { CalendarDays, Mail, Phone, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { fetchCustomOrders, orderStatuses, updateCustomOrder, type CustomOrder } from "@/lib/custom-orders";

export default function OrdersPage() {
  const [orders, setOrders] = useState<CustomOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [savingId, setSavingId] = useState("");

  useEffect(() => {
    let active = true;
    fetchCustomOrders()
      .then((items) => { if (active) setOrders(items); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "Orders could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  function changeOrder(id: string, patch: Partial<CustomOrder>) {
    setOrders((current) => current.map((order) => order.id === id ? { ...order, ...patch } : order));
  }

  async function saveOrder(order: CustomOrder) {
    setSavingId(order.id);
    setError("");
    setMessage("");
    try {
      const saved = await updateCustomOrder(order.id, {
        status: order.status,
        quoted_price: order.quoted_price,
        internal_notes: order.internal_notes
      });
      setOrders((current) => current.map((item) => item.id === saved.id ? saved : item));
      setMessage(`${saved.customer_name}'s order was saved.`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Order changes could not be saved.");
    } finally {
      setSavingId("");
    }
  }

  return (
    <AppShell>
      <section className="py-4">
        <p className="page-kicker">Private</p>
        <h1 className="font-serif text-3xl font-black sm:text-5xl">Custom Orders</h1>
        <p className="page-subtitle mt-2">Review requests, prepare quotes, and track handmade journal orders.</p>
      </section>

      {message ? <p className="mb-4 rounded-lg bg-mint/25 p-3 font-bold">{message}</p> : null}
      {error ? <p className="mb-4 rounded-lg bg-red-50 p-3 font-bold text-red-800">{error}</p> : null}
      {loading ? <div className="panel p-5 font-bold text-ink/65">Loading custom orders...</div> : null}

      {!loading && !error && orders.length === 0 ? (
        <div className="panel grid min-h-64 place-items-center p-8 text-center">
          <div><h2 className="font-serif text-2xl font-black">No custom order requests yet</h2><p className="mt-2 font-semibold text-ink/65">New requests will appear here after customers submit the public form.</p></div>
        </div>
      ) : null}

      <section className="grid gap-4">
        {orders.map((order) => (
          <article className="panel grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.7fr)]" key={order.id}>
            <div className="min-w-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-marigold">{order.status}</p>
                  <h2 className="mt-1 break-words font-serif text-2xl font-black">{order.customer_name}</h2>
                </div>
                <p className="flex items-center gap-2 text-sm font-bold text-ink/60"><CalendarDays size={17} aria-hidden />{new Date(order.created_at).toLocaleString()}</p>
              </div>

              <div className="mt-4 grid gap-2 text-sm font-semibold text-ink/75 sm:grid-cols-2">
                <a className="flex items-center gap-2 break-all" href={`tel:${order.customer_phone}`}><Phone size={17} aria-hidden />{order.customer_phone || "No phone"}</a>
                <a className="flex items-center gap-2 break-all" href={`mailto:${order.customer_email}`}><Mail size={17} aria-hidden />{order.customer_email || "No email"}</a>
                <p><strong>Preferred contact:</strong> {order.preferred_contact}</p>
                <p><strong>Pages:</strong> {order.page_count === "Custom amount" ? `${order.custom_page_count} pages` : order.page_count}</p>
                <p className="sm:col-span-2"><strong>Book:</strong> {order.books?.title || "Customer has their own book"}{order.books?.author ? ` — ${order.books.author}` : ""}</p>
              </div>

              <div className="mt-4">
                <p className="label">Customization options</p>
                <div className="mt-2 flex flex-wrap gap-2">{order.customization_options.length ? order.customization_options.map((option) => <span className="archive-label bg-honey/35" key={option}>{option}</span>) : <span className="text-sm font-semibold text-ink/55">No options selected</span>}</div>
              </div>
              <div className="mt-4 rounded-lg bg-white p-3"><p className="label">Customer notes</p><p className="mt-2 whitespace-pre-wrap text-sm font-semibold text-ink/75">{order.customer_notes || "No customer notes."}</p></div>
            </div>

            <div className="grid content-start gap-3">
              <label className="grid gap-2"><span className="label">Order status</span><select aria-label={`Order status for ${order.customer_name}`} className="field" value={order.status} onChange={(event) => changeOrder(order.id, { status: event.target.value as CustomOrder["status"] })}>{orderStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
              <label className="grid gap-2"><span className="label">Quoted price</span><input className="field" type="number" min="0" step="0.01" value={order.quoted_price ?? ""} onChange={(event) => changeOrder(order.id, { quoted_price: event.target.value === "" ? null : Number(event.target.value) })} /></label>
              <label className="grid gap-2"><span className="label">Internal notes</span><textarea className="field min-h-28" value={order.internal_notes} onChange={(event) => changeOrder(order.id, { internal_notes: event.target.value })} /></label>
              <button className="btn-primary w-full" disabled={savingId === order.id} onClick={() => saveOrder(order)}><Save size={19} aria-hidden />{savingId === order.id ? "Saving..." : "Save Order"}</button>
            </div>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
