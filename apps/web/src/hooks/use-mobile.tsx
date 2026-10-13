import * as React from "react";

const MOBILE_BREAKPOINT = 768;

/** True below `breakpoint` px (768 by default; the app shell uses 1024 so tablets get the phone layout). */
export function useIsMobile(breakpoint: number = MOBILE_BREAKPOINT) {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < breakpoint);
    return () => mql.removeEventListener("change", onChange);
  }, [breakpoint]);

  return !!isMobile;
}

/** Width below which the app shell (sidebar → top bar + bottom tabs) switches to its compact layout. */
export const SHELL_BREAKPOINT = 1024;
