import { useEffect, useLayoutEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

const prefersReducedMotion = () =>
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * Router-level scroll reset.
 *
 * - Every PUSH/REPLACE to a new pathname starts at the top of the page.
 *   Back/forward (POP) is left alone so the browser can restore position.
 * - Hash deep links (/#demo) are skipped — the target page scrolls to its own
 *   section (see HomePage).
 * - Clicking a link to the page you're already on (e.g. the navbar logo on the
 *   home page) doesn't change the pathname, so it's handled separately by
 *   smooth-scrolling back to the top.
 */
const ScrollToTop = () => {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  // Layout effect so the new page never paints at the old scroll offset.
  useLayoutEffect(() => {
    if (hash || navigationType === "POP") return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onClick = (event) => {
      // React Router's Link calls preventDefault before this listener runs;
      // an un-prevented or modified click is a browser navigation — leave it.
      if (
        !event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = event.target.closest?.("a[href]");
      if (!anchor || anchor.target === "_blank") return;

      const url = new URL(anchor.href, window.location.href);
      if (
        url.origin === window.location.origin &&
        url.pathname === window.location.pathname &&
        !url.hash
      ) {
        window.scrollTo({
          top: 0,
          behavior: prefersReducedMotion() ? "auto" : "smooth",
        });
      }
    };

    // Bubble phase on document: runs after React Router's Link handler.
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
};

export default ScrollToTop;
