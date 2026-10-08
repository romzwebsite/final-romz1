import Script from "next/script";

// Meta (Facebook) Pixel for the storefront. The ID is public (it ships in the
// page source); NEXT_PUBLIC_META_PIXEL_ID can override it without a code change.
export const META_PIXEL_ID =
  process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim() || "1113903534429259";

// The base code sends the first PageView; fbevents.js tracks later client-side
// navigations itself (it hooks history.pushState), so no manual PageView is
// needed. The flush at the end sends events that fired before the pixel loaded
// (see trackPixel in lib/pixel).
export default function MetaPixel() {
  return (
    <>
      <Script
        id="meta-pixel"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');
(window.__romzPixelQueue || []).forEach(function (a) { fbq.apply(null, a); });
window.__romzPixelQueue = [];`,
        }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          alt=""
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
