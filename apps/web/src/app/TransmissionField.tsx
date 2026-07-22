"use client";

import { useEffect, useRef } from "react";
import styles from "./page.module.css";

type Point = { x: number; y: number };
type Link = { from: number; to: number };

const HOT_PINK = "255, 20, 147";
const CREAM = "238, 232, 218";

function seededNoise(index: number) {
  return Math.sin(index * 9283.17) * 0.5 + 0.5;
}

export default function TransmissionField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const precisePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const pointer = {
      x: window.innerWidth * 0.5,
      y: window.innerHeight * 0.45,
      visible: false,
    };
    let width = window.innerWidth;
    let height = window.innerHeight;
    let nodes: Point[] = [];
    let links: Link[] = [];
    let frame = 0;
    let lastPaint = 0;

    const buildNetwork = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const columns = Math.max(6, Math.ceil(width / 210));
      const rows = Math.max(5, Math.ceil(height / 170));
      nodes = [];
      links = [];

      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const index = row * columns + column;
          const jitterX = (seededNoise(index * 2) - 0.5) * 70;
          const jitterY = (seededNoise(index * 2 + 1) - 0.5) * 54;
          nodes.push({
            x: ((column + 0.45) / columns) * width + jitterX,
            y: ((row + 0.45) / rows) * height + jitterY,
          });

          if (column > 0) links.push({ from: index - 1, to: index });
          if (row > 0 && (column + row) % 2 === 0) {
            links.push({ from: index - columns, to: index });
          }
        }
      }
    };

    const paint = (time: number) => {
      context.clearRect(0, 0, width, height);

      for (let index = 0; index < links.length; index += 1) {
        const link = links[index];
        const start = nodes[link.from];
        const end = nodes[link.to];
        const midpointX = (start.x + end.x) * 0.5;
        const midpointY = (start.y + end.y) * 0.5;
        const distance = Math.hypot(midpointX - pointer.x, midpointY - pointer.y);
        const proximity = pointer.visible ? Math.max(0, 1 - distance / 310) : 0;

        context.beginPath();
        context.moveTo(start.x, start.y);
        context.lineTo(end.x, end.y);
        context.strokeStyle = `rgba(${HOT_PINK}, ${0.025 + proximity * 0.14})`;
        context.lineWidth = proximity > 0.25 ? 1 : 0.65;
        context.stroke();

        if (!reducedMotion.matches) {
          const progress = (time * 0.00007 + index * 0.137) % 1;
          const packetX = start.x + (end.x - start.x) * progress;
          const packetY = start.y + (end.y - start.y) * progress;
          context.fillStyle = `rgba(${HOT_PINK}, ${0.08 + proximity * 0.7})`;
          context.fillRect(packetX - 1.25, packetY - 1.25, 2.5, 2.5);
        }
      }

      for (let index = 0; index < nodes.length; index += 1) {
        const node = nodes[index];
        const distance = Math.hypot(node.x - pointer.x, node.y - pointer.y);
        const active = pointer.visible ? Math.max(0, 1 - distance / 280) : 0;
        context.fillStyle = `rgba(${CREAM}, ${0.08 + active * 0.35})`;
        context.fillRect(node.x - 1, node.y - 1, 2, 2);
      }

      if (pointer.visible && precisePointer.matches) {
        const nearest = nodes
          .map((node) => ({
            node,
            distance: Math.hypot(node.x - pointer.x, node.y - pointer.y),
          }))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 3);

        const glow = context.createRadialGradient(
          pointer.x,
          pointer.y,
          0,
          pointer.x,
          pointer.y,
          145,
        );
        glow.addColorStop(0, `rgba(${HOT_PINK}, 0.14)`);
        glow.addColorStop(1, `rgba(${HOT_PINK}, 0)`);
        context.fillStyle = glow;
        context.beginPath();
        context.arc(pointer.x, pointer.y, 145, 0, Math.PI * 2);
        context.fill();

        nearest.forEach(({ node }, index) => {
          context.beginPath();
          context.moveTo(pointer.x, pointer.y);
          context.lineTo(node.x, node.y);
          context.strokeStyle = `rgba(${HOT_PINK}, ${0.22 - index * 0.05})`;
          context.lineWidth = 0.8;
          context.stroke();

          if (!reducedMotion.matches) {
            const progress = (time * 0.0009 + index * 0.28) % 1;
            const packetX = pointer.x + (node.x - pointer.x) * progress;
            const packetY = pointer.y + (node.y - pointer.y) * progress;
            context.fillStyle = `rgba(${CREAM}, 0.88)`;
            context.fillRect(packetX - 1.5, packetY - 1.5, 3, 3);
          }
        });

        const pulse = reducedMotion.matches ? 18 : 18 + ((time * 0.045) % 34);
        context.beginPath();
        context.arc(pointer.x, pointer.y, pulse, 0, Math.PI * 2);
        context.strokeStyle = `rgba(${HOT_PINK}, ${
          reducedMotion.matches ? 0.28 : Math.max(0, 0.34 - pulse / 155)
        })`;
        context.lineWidth = 1;
        context.stroke();
      }
    };

    const animate = (time: number) => {
      if (time - lastPaint > 32 || pointer.visible) {
        paint(time);
        lastPaint = time;
      }
      frame = window.requestAnimationFrame(animate);
    };

    const onPointerMove = (event: PointerEvent) => {
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      pointer.visible = true;
      if (reducedMotion.matches) paint(performance.now());
    };

    const onPointerLeave = () => {
      pointer.visible = false;
    };

    const onResize = () => {
      buildNetwork();
      paint(performance.now());
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        window.cancelAnimationFrame(frame);
      } else if (!reducedMotion.matches) {
        frame = window.requestAnimationFrame(animate);
      }
    };

    buildNetwork();
    paint(0);
    if (!reducedMotion.matches) frame = window.requestAnimationFrame(animate);
    window.addEventListener("resize", onResize, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("mouseleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={styles.transmissionField}
      aria-hidden="true"
    />
  );
}
