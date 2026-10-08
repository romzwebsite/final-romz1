"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { btn } from "@/components/ui/Button";
import { trackOrder } from "@/lib/api";
import { pixelCartParams, trackPixel } from "@/lib/pixel";
import {
  clearPendingOrder,
  readPendingOrder,
  type PendingOrder,
} from "@/lib/payment";

type Phase = "checking" | "paid" | "failed" | "missing" | "timeout";

// Poll roughly every 3s for up to 2 minutes. Paymob webhooks usually land in a
// few seconds, but give the backend generous headroom before timing out.
const POLL_INTERVAL_MS = 3000;
const MAX_ATTEMPTS = 40;

export default function PaymentCallbackClient() {
  const t = useTranslations("payment");
  const [phase, setPhase] = useState<Phase>("checking");
  const [pending, setPending] = useState<PendingOrder | null>(null);
  const stopped = useRef(false);

  useEffect(() => {
    // localStorage can only be read after mount (server can't see it), so this
    // initial state sync legitimately lives in an effect to avoid a hydration
    // mismatch between the server ("checking") and the client's stored order.
    const order = readPendingOrder();
    /* eslint-disable react-hooks/set-state-in-effect */
    if (!order) {
      setPhase("missing");
      return;
    }
    setPending(order);
    /* eslint-enable react-hooks/set-state-in-effect */

    let attempts = 0;
    stopped.current = false;

    const poll = async () => {
      if (stopped.current) return;
      attempts += 1;
      try {
        // The backend is the single source of truth — Paymob's redirect query
        // params are intentionally ignored.
        const result = await trackOrder(order.orderNumber, order.contact);
        if (stopped.current) return;

        if (result) {
          if (result.paymentStatus === "paid") {
            stopped.current = true;
            // Meta Pixel: card orders count as a Purchase only once the backend
            // confirms payment. The pending order is cleared right after, so a
            // reload of this page can't report the same order twice.
            trackPixel(
              "Purchase",
              pixelCartParams(
                result.items.map((item) => ({
                  id: item.productId,
                  quantity: item.qty,
                  item_price: item.unitPrice,
                })),
                result.total
              ),
              { eventID: result.orderNumber }
            );
            clearPendingOrder();
            setPhase("paid");
            return;
          }
          if (result.paymentStatus === "failed" || result.status === "cancelled") {
            stopped.current = true;
            clearPendingOrder();
            setPhase("failed");
            return;
          }
        }
      } catch {
        // transient error — keep polling until we run out of attempts
      }

      if (attempts >= MAX_ATTEMPTS) {
        stopped.current = true;
        setPhase("timeout");
        return;
      }
      window.setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();
    return () => {
      stopped.current = true;
    };
  }, []);

  const orderNumber = pending?.orderNumber ?? "";

  if (phase === "checking") {
    return (
      <Shell>
        <Loader2 size={48} className="mx-auto animate-spin text-brand" />
        <h1 className="mt-6 font-display uppercase text-3xl text-navy">
          {t("checkingTitle")}
        </h1>
        <p className="mt-4 text-muted">{t("checkingBody")}</p>
        {orderNumber && (
          <OrderBadge label={t("orderNumber")} value={orderNumber} />
        )}
      </Shell>
    );
  }

  if (phase === "paid") {
    return (
      <Shell>
        <CheckCircle2 size={48} className="mx-auto text-success" />
        <h1 className="mt-6 font-display uppercase text-4xl text-navy">
          {t("paidTitle")}
        </h1>
        <p className="mt-4 text-muted">{t("paidBody", { orderNumber })}</p>
        <OrderBadge label={t("orderNumber")} value={orderNumber} />
        <Actions>
          <Link href="/track-order" className={btn("primary", "md")}>
            <span>{t("trackCta")}</span>
          </Link>
          <Link href="/" className={btn("outline", "md")}>
            <span>{t("backHome")}</span>
          </Link>
        </Actions>
      </Shell>
    );
  }

  if (phase === "failed") {
    return (
      <Shell>
        <XCircle size={48} className="mx-auto text-brand" />
        <h1 className="mt-6 font-display uppercase text-4xl text-navy">
          {t("failedTitle")}
        </h1>
        <p className="mt-4 text-muted">{t("failedBody", { orderNumber })}</p>
        <Actions>
          <Link href="/checkout" className={btn("primary", "md")}>
            <span>{t("retry")}</span>
          </Link>
          <Link href="/" className={btn("outline", "md")}>
            <span>{t("backHome")}</span>
          </Link>
        </Actions>
      </Shell>
    );
  }

  if (phase === "timeout") {
    return (
      <Shell>
        <Loader2 size={48} className="mx-auto text-muted" />
        <h1 className="mt-6 font-display uppercase text-3xl text-navy">
          {t("timeoutTitle")}
        </h1>
        <p className="mt-4 text-muted">{t("timeoutBody")}</p>
        {orderNumber && <OrderBadge label={t("orderNumber")} value={orderNumber} />}
        <Actions>
          <Link href="/track-order" className={btn("primary", "md")}>
            <span>{t("trackCta")}</span>
          </Link>
        </Actions>
      </Shell>
    );
  }

  // missing
  return (
    <Shell>
      <h1 className="font-display uppercase text-3xl text-navy">
        {t("missingTitle")}
      </h1>
      <p className="mt-4 text-muted">{t("missingBody")}</p>
      <Actions>
        <Link href="/track-order" className={btn("primary", "md")}>
          <span>{t("trackCta")}</span>
        </Link>
        <Link href="/" className={btn("outline", "md")}>
          <span>{t("backHome")}</span>
        </Link>
      </Actions>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">{children}</div>
  );
}

function OrderBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="mx-auto mt-8 max-w-xs border-2 border-navy/10 bg-white p-5">
      <p className="text-xs font-bold uppercase tracking-widest text-muted">
        {label}
      </p>
      <p className="mt-1 font-display text-2xl text-brand">{value}</p>
    </div>
  );
}

function Actions({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
      {children}
    </div>
  );
}
