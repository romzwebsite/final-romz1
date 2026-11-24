import type { ActivePromo } from "@/lib/api";
import type { Locale } from "@/lib/types";

// Auto-generated announcement for the active Buy X Get Y promo. Unlike PromoBar
// (manual text in settings), this reflects the live promo and disappears when
// none is active.
export default function BogoBanner({
  locale,
  promo,
}: {
  locale: Locale;
  promo: ActivePromo | null;
}) {
  if (!promo || promo.type !== "bogo") return null;

  const ar = locale === "ar";
  const headline = ar
    ? `اشترِ ${promo.buyQuantity} والأرخص ${promo.freeQuantity} ببلاش`
    : `Buy ${promo.buyQuantity}, get ${promo.freeQuantity} free`;
  const sub = ar
    ? "بيتطبّق تلقائيًا على السلة — من غير كود"
    : "Applied automatically at checkout — no code needed";

  return (
    <div className="bg-brand px-4 py-1.5 text-center text-white">
      <p className="whitespace-nowrap text-[10px] font-extrabold uppercase tracking-wide md:text-[11px]">
        🎁 {headline}
        <span className="mx-1 opacity-70">·</span>
        <span className="font-semibold normal-case opacity-90">{sub}</span>
      </p>
    </div>
  );
}
