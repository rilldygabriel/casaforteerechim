"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const REVEAL_SELECTORS = [
  ".home-hero-panel",
  ".home-entry-grid",
  ".home-block",
  ".home-footer",
  ".family-hero",
  ".family-leadership-access",
  ".family-profile-section",
  ".family-serve-cta",
  ".family-menu",
  ".family-permissions",
  ".family-discipler-choice",
  ".birthday-carousel",
].join(",");

const STAGGER_SELECTORS = [
  ".home-entry-grid > a",
  ".home-generosity-grid > article",
  ".home-program-carousel > article",
  ".home-gallery > a",
  ".home-useful-links-grid > a",
  ".home-pastor-grid > a",
  ".home-pastor-grid > article",
  ".testimonial-grid > article",
  ".family-menu > article",
  ".family-discipler-grid > article",
  ".family-permissions-grid > *",
].join(",");

export default function MotionExperience() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    root.classList.add("motion-ready");

    const revealElements = Array.from(
      document.querySelectorAll<HTMLElement>(REVEAL_SELECTORS),
    );
    const staggerElements = Array.from(
      document.querySelectorAll<HTMLElement>(STAGGER_SELECTORS),
    );

    staggerElements.forEach((element, index) => {
      element.classList.add("motion-stagger");
      element.style.setProperty("--motion-order", String(index % 8));
    });

    if (reducedMotion || !("IntersectionObserver" in window)) {
      revealElements.forEach((element) => element.classList.add("is-revealed"));
      return () => root.classList.remove("motion-ready");
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        });
      },
      {
        rootMargin: "0px 0px -7% 0px",
        threshold: 0.08,
      },
    );

    revealElements.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
      root.classList.remove("motion-ready");
    };
  }, [pathname]);

  return null;
}
