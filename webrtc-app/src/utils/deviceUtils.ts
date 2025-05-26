/**
 * Device detection utilities
 */

/**
 * Detects if the current device is a mobile device
 * @returns {boolean} true if mobile device, false otherwise
 */
export const isMobileDevice = (): boolean => {
  // Check user agent for mobile indicators
  const userAgent = navigator.userAgent.toLowerCase();
  const mobileKeywords = [
    "android",
    "webos",
    "iphone",
    "ipad",
    "ipod",
    "blackberry",
    "windows phone",
    "mobile",
    "tablet",
  ];

  const isMobileUserAgent = mobileKeywords.some((keyword) =>
    userAgent.includes(keyword)
  );

  // Check for touch capability
  const isTouchDevice =
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    (navigator as any).msMaxTouchPoints > 0;

  // Check screen size (mobile-like dimensions)
  const isSmallScreen =
    window.screen.width <= 768 || window.screen.height <= 768;

  // Check if screen orientation API exists (typically mobile)
  const hasOrientationAPI =
    "orientation" in window ||
    ("screen" in window && "orientation" in window.screen);

  // Combine checks - device is considered mobile if it meets multiple criteria
  return (
    (isMobileUserAgent && isTouchDevice) ||
    (isTouchDevice && isSmallScreen) ||
    (isMobileUserAgent && hasOrientationAPI)
  );
};

/**
 * Detects if the current device is a tablet
 * @returns {boolean} true if tablet device, false otherwise
 */
export const isTabletDevice = (): boolean => {
  const userAgent = navigator.userAgent.toLowerCase();
  const tabletKeywords = ["ipad", "tablet", "kindle", "playbook", "silk"];

  const isTabletUserAgent = tabletKeywords.some((keyword) =>
    userAgent.includes(keyword)
  );

  // Check for tablet-like screen dimensions
  const isTabletScreen =
    (window.screen.width >= 768 && window.screen.width <= 1024) ||
    (window.screen.height >= 768 && window.screen.height <= 1024);

  const isTouchDevice =
    "ontouchstart" in window || navigator.maxTouchPoints > 0;

  return isTabletUserAgent || (isTouchDevice && isTabletScreen);
};

/**
 * Detects if the current device is a desktop/laptop
 * @returns {boolean} true if desktop device, false otherwise
 */
export const isDesktopDevice = (): boolean => {
  return !isMobileDevice() && !isTabletDevice();
};

/**
 * Checks if screen sharing is supported on the current device
 * Screen sharing is typically not supported or not practical on mobile devices
 * @returns {boolean} true if screen sharing should be available, false otherwise
 */
export const isScreenShareSupported = (): boolean => {
  // Check if getDisplayMedia API exists
  const hasDisplayMediaAPI =
    navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === "function";

  // Don't show screen share on mobile devices even if API exists
  // as it's not practical and often not functional
  const isDesktop = isDesktopDevice();

  return hasDisplayMediaAPI && isDesktop;
};
