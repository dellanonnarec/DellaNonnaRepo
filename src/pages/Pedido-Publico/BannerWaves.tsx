/**
 * Animated wave overlay for the hero banner.
 * The SVG `d` attribute itself is morphed via CSS keyframes (see styles.css),
 * so the curve changes shape organically instead of just sliding sideways.
 */
export function BannerWaves() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1200 600"
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* dark panel carrying the banner copy — wavy edge on desktop */}
      
      {/* mobile: soft scrim so the copy stays readable over the photo */}
      

      {/* top wave */}
      <path
        className="animate-wave-top fill-[#F8F4E8]"
        d="M0,0 H1200 V70 C1000,130 820,40 600,90 C400,135 180,60 0,110 Z"
      />

      {/* bottom wave — independent, slower rhythm */}
      <path
        className="animate-wave-bottom fill-[#F8F4E8]"
        d="M0,600 H1200 V520 C1000,470 820,560 600,515 C400,475 180,555 0,505 Z"
      />
    </svg>
  );
}
