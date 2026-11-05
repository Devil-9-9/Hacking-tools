import { useEffect, useState } from "react";

/**
 * Returns true once we know the viewport is narrower than Tailwind's `md`
 * breakpoint (768px). Starts false on the server and during the first
 * client render to avoid hydration mismatches, then updates on resize.
 */
export default function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setIsMobile(mql.matches);
    update();

    if (mql.addEventListener) {
      mql.addEventListener("change", update);
      return () => mql.removeEventListener("change", update);
    }
    // Safari < 14 fallback
    mql.addListener(update);
    return () => mql.removeListener(update);
  }, [breakpoint]);

  return isMobile;
}
