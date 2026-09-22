import clsx from "clsx";

/**
 * Official ROMZ lockup: the geometric "R" mark from the brand book
 * (extracted from ROMZ BRANDING VOL1) next to the wordmark.
 *
 * The mark is rendered as a CSS mask filled with `currentColor`, so the mark
 * and the wordmark always share the exact same color (and recolor together on
 * hover) instead of the mark being a fixed-color image.
 */
export default function Logo({
  className,
  light = false,
  markClassName = "h-[1.15em] w-auto",
  withMark = true,
}: {
  className?: string;
  light?: boolean;
  markClassName?: string;
  withMark?: boolean;
}) {
  return (
    <span
      className={clsx(
        "logo-3d group inline-flex items-center gap-[0.3em] font-display uppercase leading-none tracking-wide transition-colors duration-300 hover:text-brand",
        light ? "text-white" : "text-navy",
        className
      )}
    >
      {withMark && (
        <span
          aria-hidden
          className={clsx(
            "logo-3d-mark inline-block shrink-0 select-none",
            markClassName
          )}
          style={{
            aspectRatio: "668 / 372",
            backgroundColor: "currentColor",
            WebkitMaskImage: "url(/brand/romz-mark.png)",
            maskImage: "url(/brand/romz-mark.png)",
            WebkitMaskSize: "contain",
            maskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            maskPosition: "center",
          }}
        />
      )}
      <Wordmark />
    </span>
  );
}

/**
 * "ROMZ" wordmark drawn as vector glyphs (squared letters with rounded outer
 * corners, wide tracking) so it matches the brand artwork exactly instead of
 * depending on a web font. Filled with `currentColor` like the mark.
 */
function Wordmark() {
  return (
    <svg
      role="img"
      aria-label="ROMZ"
      viewBox="193 794 1461 216"
      className="h-[0.7em] w-auto shrink-0"
      fill="currentColor"
      fillRule="evenodd"
    >
      {/* R */}
      <path d="M193 794H367a43 43 0 0 1 43 43V880a43 43 0 0 1-43 43H323L367 967H410V1010H358Q350 1010 344 1004L263 923H236V1010H193ZM236 837V880H367V837Z" />
      {/* O */}
      <path d="M691 794H821a43 43 0 0 1 43 43V967a43 43 0 0 1-43 43H691a43 43 0 0 1-43-43V837a43 43 0 0 1 43-43ZM691 837V967H821V837Z" />
      {/* M */}
      <path d="M1043 794H1108L1146 962L1184 794H1249V1010H1208V829L1167 1010H1124L1085 829V1010H1043Z" />
      {/* Z */}
      <path d="M1438 794H1632Q1652 794 1652 812Q1652 822 1645 829L1512 967H1654V1010H1460Q1440 1010 1440 992Q1440 982 1447 975L1580 837H1438Z" />
    </svg>
  );
}
