"use client";

import { useEffect, useRef } from "react";
import styles from "./page.module.css";

export default function SignalCursor() {
  const dotRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const precisePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (!precisePointer.matches || reducedMotion.matches) return;

    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let ringX = targetX;
    let ringY = targetY;
    let frame = 0;

    const animate = () => {
      ringX += (targetX - ringX) * 0.18;
      ringY += (targetY - ringY) * 0.18;
      ringRef.current?.style.setProperty(
        "transform",
        `translate3d(${ringX - 19}px, ${ringY - 19}px, 0)`,
      );
      frame = window.requestAnimationFrame(animate);
    };

    const onPointerMove = (event: PointerEvent) => {
      targetX = event.clientX;
      targetY = event.clientY;
      dotRef.current?.style.setProperty(
        "transform",
        `translate3d(${targetX - 3}px, ${targetY - 3}px, 0)`,
      );
      dotRef.current?.setAttribute("data-visible", "true");
      ringRef.current?.setAttribute("data-visible", "true");
    };

    const onPointerOver = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const interactive = Boolean(target?.closest("a, button, summary, [role='button']"));
      ringRef.current?.setAttribute("data-active", String(interactive));
      if (labelRef.current) labelRef.current.textContent = interactive ? "SELECT" : "SIGNAL";
    };

    const onPointerLeave = () => {
      dotRef.current?.setAttribute("data-visible", "false");
      ringRef.current?.setAttribute("data-visible", "false");
    };

    frame = window.requestAnimationFrame(animate);
    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerover", onPointerOver, { passive: true });
    document.documentElement.addEventListener("mouseleave", onPointerLeave);

    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerover", onPointerOver);
      document.documentElement.removeEventListener("mouseleave", onPointerLeave);
    };
  }, []);

  return (
    <>
      <div ref={ringRef} className={styles.cursorRing} aria-hidden="true">
        <span />
        <small ref={labelRef}>SIGNAL</small>
      </div>
      <div ref={dotRef} className={styles.cursorDot} aria-hidden="true" />
    </>
  );
}
