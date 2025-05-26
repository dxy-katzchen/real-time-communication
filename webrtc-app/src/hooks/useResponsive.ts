import { useState, useEffect } from "react";
import { isMobileDevice } from "../utils/deviceUtils";

/**
 * Custom hook for responsive design detection
 * Returns true if drawer should be used (mobile device OR small viewport)
 */
export const useResponsive = (breakpoint: number = 768) => {
  const [shouldUseDrawer, setShouldUseDrawer] = useState(() => {
    // Initial check - mobile device OR small window
    return isMobileDevice() || window.innerWidth <= breakpoint;
  });

  useEffect(() => {
    const handleResize = () => {
      // Use drawer if it's a mobile device OR if window width is small
      const useDrawer = isMobileDevice() || window.innerWidth <= breakpoint;
      setShouldUseDrawer(useDrawer);
    };

    // Add event listener for window resize
    window.addEventListener("resize", handleResize);

    // Call handler right away so state gets updated with initial window size
    handleResize();

    // Cleanup
    return () => window.removeEventListener("resize", handleResize);
  }, [breakpoint]);

  return shouldUseDrawer;
};
