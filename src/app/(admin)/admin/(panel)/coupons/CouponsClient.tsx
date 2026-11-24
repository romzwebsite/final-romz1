"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, Plus, Trash2, X } from "lucide-react";
import clsx from "clsx";
import { createCoupon, deleteCoupon, updateCoupon } from "@/lib/adminApi";
import type { Coupon } from "@/lib/types";

const inputCls =
  "w-full border-2 border-navy/15 bg-white px-3 py-2.5 text-sm text-navy outline-none focus:border-brand transition-colors";
const labelCls =
  "mb-1.5 block text-[11px] font-extrabold uppercase tracking-wider text-muted";

interface FormState {
  code: string;
  type: "percent" | "fixed" | "bogo";
  value: number;
  buyQuantity: number;
  freeQuantity: number;
  minOrderTotal: number;
  usageLimit: number;
}

const emptyForm: FormState = {
  code: "",
  type: "percent",
  value: 10,
  buyQuantity: 2,
  freeQuantity: 1,
  minOrderTotal: 0,
  usageLimit: 0,
};

export default function CouponsClient({ coupons }: { coupons: Coupon[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (form.type === "bogo") {
      if (form.buyQuantity < 1 || form.freeQuantity < 1) {
        setError("Buy and free quantities must be at least 1.");
        return;
      }
    } else {
      if (!form.code.trim()) {
        setError("Coupon code is required.");
        return;
      }
      if (form.value <= 0) {
        setError("Value must be above zero.");
        return;
      }
      if (form.type === "percent" && form.value > 100) {
        setError("A percentage discount cannot exceed 100.");
        return;
      }
    }
    setBusy(true);
    setError(null);
    try {
      await createCoupon({
        type: form.type,
        // bogo promos run automatically with no customer code; the server
        // generates an internal one.
        ...(form.type === "bogo"
          ? { buyQuantity: form.buyQuantity, freeQuantity: form.freeQuantity }
          : { code: form.code.trim().toUpperCase(), value: form.value }),
        ...(form.minOrderTotal > 0 ? { minOrderTotal: form.minOrderTotal } : {}),
        ...(form.usageLimit > 0 ? { usageLimit: form.usageLimit } : {}),
        isActive: true,
      });
      setCreating(false);
      setForm(emptyForm);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (coupon: Coupon) => {
    if (!coupon.id) return;
    setBusy(true);
    try {
      await updateCoupon(coupon.id, { isActive: !coupon.isActive });
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (coupon: Coupon) => {
    if (!coupon.id) return;
    if (!window.confirm(`Delete coupon ${coupon.code}? Customers will no longer be able to use it.`)) return;
    setBusy(true);
    try {
      await deleteCoupon(coupon.id);
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display uppercase text-2xl text-navy">
          Coupons
        </h1>
        <button
          onClick={() => {
            setForm(emptyForm);
            setError(null);
            setCreating((c) => !c);
          }}
          className="skew-cta flex items-center gap-2 bg-brand px-5 py-2.5 text-sm font-display uppercase tracking-wider text-white hover:bg-brand-dark transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Plus size={16} /> New Coupon
          </span>
        </button>
      </div>

      {creating && (
        <div className="mt-6 border-2 border-brand/30 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h2 className="font-display uppercase text-lg text-navy">
              New Coupon
            </h2>
            <button
              onClick={() => setCreating(false)}
              aria-label="Close form"
              className="text-muted hover:text-brand cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
            {form.type !== "bogo" && (
              <div>
                <label className={labelCls}>Code</label>
                <input
                  value={form.code}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))
                  }
                  placeholder="SUMMER26"
                  className={clsx(inputCls, "font-mono uppercase")}
                />
              </div>
            )}
            <div>
              <label className={labelCls}>Type</label>
              <select
                value={form.type}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    type: e.target.value as FormState["type"],
                  }))
                }
                className={inputCls}
              >
                <option value="percent">Percent (%)</option>
                <option value="fixed">Fixed (EGP)</option>
                <option value="bogo">Buy X Get Y (free)</option>
              </select>
            </div>
            {form.type === "bogo" ? (
              <>
                <div>
                  <label className={labelCls}>Buy (qty)</label>
                  <input
                    type="number"
                    min={1}
                    value={form.buyQuantity}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, buyQuantity: +e.target.value }))
                    }
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Get Free (qty)</label>
                  <input
                    type="number"
                    min={1}
                    value={form.freeQuantity}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, freeQuantity: +e.target.value }))
                    }
                    className={inputCls}
                  />
                </div>
              </>
            ) : (
              <div>
                <label className={labelCls}>
                  Value {form.type === "percent" ? "(%)" : "(EGP)"}
                </label>
                <input
                  type="number"
                  value={form.value}
                  onChange={(e) => setForm((f) => ({ ...f, value: +e.target.value }))}
                  className={inputCls}
                />
              </div>
            )}
            <div>
              <label className={labelCls}>Min Order (0 = none)</label>
              <input
                type="number"
                value={form.minOrderTotal}
                onChange={(e) =>
                  setForm((f) => ({ ...f, minOrderTotal: +e.target.value }))
                }
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Usage Limit (0 = unlimited)</label>
              <input
                type="number"
                value={form.usageLimit}
                onChange={(e) =>
                  setForm((f) => ({ ...f, usageLimit: +e.target.value }))
                }
                className={inputCls}
              />
            </div>
          </div>
          {form.type === "bogo" && (
            <p className="mt-3 text-xs text-muted">
              No code needed — this promo applies automatically to every cart while
              active (only one Buy X Get Y promo runs at a time). Buy{" "}
              {form.buyQuantity || 0} &amp; get {form.freeQuantity || 0} free: the
              customer pays for the most expensive items and the cheapest{" "}
              {form.freeQuantity || 0} of every {(form.buyQuantity || 0) + (form.freeQuantity || 0)}{" "}
              item(s) are free.
            </p>
          )}
          {error && <p className="mt-3 text-xs font-bold text-brand">{error}</p>}
          <button
            onClick={submit}
            disabled={busy}
            className={clsx(
              "skew-cta mt-4 bg-brand px-6 py-2.5 text-sm font-display uppercase tracking-wider text-white hover:bg-brand-dark transition-colors cursor-pointer",
              busy && "opacity-60"
            )}
          >
            <span>{busy ? "Saving…" : "Create Coupon"}</span>
          </button>
        </div>
      )}

      <div className="mt-6 overflow-x-auto bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b-2 border-navy text-[11px] font-extrabold uppercase tracking-wider text-muted">
              <th className="px-4 py-3 text-start">Code</th>
              <th className="px-4 py-3 text-start">Type</th>
              <th className="px-4 py-3 text-end">Value</th>
              <th className="px-4 py-3 text-end">Min Order</th>
              <th className="px-4 py-3 text-end">Uses</th>
              <th className="px-4 py-3 text-start">Status</th>
              <th className="px-4 py-3 text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id ?? c.code} className="border-b border-navy/5 hover:bg-brand/5">
                <td className="px-4 py-3">
                  <span
                    className={clsx(
                      "px-2.5 py-1 text-xs font-extrabold text-white",
                      c.isActive ? "bg-navy" : "bg-muted"
                    )}
                  >
                    {c.type === "bogo" ? "AUTO" : c.code}
                  </span>
                </td>
                <td className="px-4 py-3 uppercase text-muted">{c.type}</td>
                <td className="px-4 py-3 text-end font-extrabold text-navy">
                  {c.type === "percent"
                    ? `${c.value}%`
                    : c.type === "bogo"
                      ? `Buy ${c.buyQuantity ?? "-"} Get ${c.freeQuantity ?? "-"}`
                      : `${c.value} EGP`}
                </td>
                <td className="px-4 py-3 text-end text-muted">
                  {c.minOrderTotal.toLocaleString()} EGP
                </td>
                <td className="px-4 py-3 text-end font-display text-navy">
                  {c.usedCount}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={clsx(
                      "px-2 py-1 text-[10px] font-extrabold uppercase",
                      c.isActive
                        ? "bg-success/10 text-success"
                        : "bg-surface text-muted"
                    )}
                  >
                    {c.isActive ? "Active" : "Paused"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={() => toggleActive(c)}
                      disabled={busy || !c.id}
                      aria-label={c.isActive ? `Pause ${c.code}` : `Activate ${c.code}`}
                      title={c.isActive ? "Pause" : "Activate"}
                      className="p-2 text-muted hover:text-navy transition-colors cursor-pointer disabled:opacity-40"
                    >
                      {c.isActive ? <Pause size={15} /> : <Play size={15} />}
                    </button>
                    <button
                      onClick={() => remove(c)}
                      disabled={busy || !c.id}
                      aria-label={`Delete ${c.code}`}
                      className="p-2 text-muted hover:text-brand transition-colors cursor-pointer disabled:opacity-40"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
