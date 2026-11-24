"use client";

import { useEffect } from "react";

/** Progressive enhancement: content is never hidden while waiting for JS. */
export default function HomeSectionMotion() {
  useEffect(() => {
    const root = document.querySelector(".home-page");
    if (!root || !("IntersectionObserver" in window) || !("animate" in Element.prototype)) return;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const animations = new Set<Animation>();
    let observer: IntersectionObserver | undefined;

    const stop = () => {
      observer?.disconnect();
      animations.forEach((animation) => animation.cancel());
      animations.clear();
    };
    const start = () => {
      stop();
      if (preference.matches) return;
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer?.unobserve(entry.target);
          // Do not replay elements already visible on load or history restoration.
          if (entry.target.hasAttribute("data-home-seen")) return;
          entry.target.setAttribute("data-home-seen", "true");
          const animation = entry.target.animate(
            [{ opacity: 0.3, transform: "translateY(22px)" }, { opacity: 1, transform: "translateY(0)" }],
            { duration: 650, easing: "cubic-bezier(.22,1,.36,1)" },
          );
          animations.add(animation);
          animation.onfinish = () => animations.delete(animation);
        });
      }, { threshold: 0.12 });
      root.querySelectorAll(".home-section-heading, .home-entry-grid > a, .home-generosity-grid > article, .home-resources > article, .home-pastor-grid > a, .home-pastor-grid > article").forEach((element) => {
        if (element.getBoundingClientRect().top < window.innerHeight) {
          element.setAttribute("data-home-seen", "true");
        } else {
          observer?.observe(element);
        }
      });
    };
    start();
    preference.addEventListener("change", start);
    return () => {
      stop();
      preference.removeEventListener("change", start);
    };
  }, []);
  return null;
}
