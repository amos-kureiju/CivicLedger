"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import Image from "next/image";
import { Pause, Play } from "lucide-react";
import frame from "./AuthHeading.module.css";
import styles from "./AuthShowcase.module.css";

const DESKTOP = "(min-width: 881px) and (hover: hover) and (prefers-reduced-motion: no-preference)";

export default function AuthShowcase({ en }: { en: boolean }) {
  const [paused, setPaused] = useState(false);
  const [enhanced, setEnhanced] = useState(false);
  const scene = useRef<HTMLElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const motion = useRef({ paused: false, resume: () => {} });

  useEffect(() => {
    const panel = scene.current;
    const artwork = image.current;
    const surface = canvas.current;
    const shell = panel?.closest("main");
    if (!panel || !artwork || !surface || !shell) return;

    const desktop = window.matchMedia(DESKTOP);
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    let generation = 0;
    let cleanup = () => {};

    function start() {
      generation++;
      cleanup();
      setEnhanced(false);
      if (!desktop.matches || connection?.saveData || (navigator.hardwareConcurrency > 0 && navigator.hardwareConcurrency < 4)) return;

      const current = generation;
      void Promise.all([artwork!.decode(), import("./auth-showcase-webgl")]).then(([, { createShowcaseRenderer }]) => {
        if (current !== generation) return;
        const renderer = createShowcaseRenderer(surface!, artwork!);
        if (!renderer) return;

        let frameId = 0;
        let visible = true;
        let last = 0;
        let elapsed = 0;
        let x = 0;
        let y = 0;
        let slideStart = -Infinity;
        let slideDirection = 0;

        function canAnimate() {
          return visible && !document.hidden && !motion.current.paused;
        }

        function draw(now: number) {
          frameId = 0;
          if (!canAnimate()) return;
          const delta = last ? Math.min(now - last, 50) : 16;
          elapsed += delta;
          last = now;
          const blend = 1 - Math.exp(-delta / 180);
          x += (pointer.current.x - x) * blend;
          y += (pointer.current.y - y) * blend;
          const slide = Math.sin(Math.PI * Math.min((now - slideStart) / 800, 1)) * slideDirection;
          const progress = 1 - Math.pow(1 - Math.min(elapsed / 1400, 1), 3);
          renderer!.draw(x + slide * .38, y - Math.abs(slide) * .12, progress, elapsed / 1000);
          frameId = requestAnimationFrame(draw);
        }

        function resume() {
          if (canAnimate() && !frameId) {
            last = 0;
            frameId = requestAnimationFrame(draw);
          } else if (!canAnimate() && frameId) {
            cancelAnimationFrame(frameId);
            frameId = 0;
          }
        }

        function resize() {
          if (!panel!.clientWidth || !panel!.clientHeight) return;
          renderer!.resize(panel!.clientWidth, panel!.clientHeight);
          renderer!.draw(x, y, 1, elapsed / 1000);
        }

        const size = new ResizeObserver(resize);
        size.observe(panel!);
        const viewport = new IntersectionObserver(([entry]) => {
          visible = entry.isIntersecting;
          resume();
        });
        viewport.observe(panel!);
        const transition = new MutationObserver(() => {
          slideStart = performance.now();
          slideDirection = shell!.dataset.register === "true" ? 1 : -1;
          pointer.current = { x: 0, y: 0 };
        });
        transition.observe(shell!, { attributes: true, attributeFilter: ["data-register"] });

        function fallback() {
          cleanup();
          setEnhanced(false);
        }

        cleanup = () => {
          cancelAnimationFrame(frameId);
          size.disconnect();
          viewport.disconnect();
          transition.disconnect();
          document.removeEventListener("visibilitychange", resume);
          surface!.removeEventListener("webglcontextlost", fallback);
          renderer.dispose();
          motion.current.resume = () => {};
          cleanup = () => {};
        };

        surface!.addEventListener("webglcontextlost", fallback);
        document.addEventListener("visibilitychange", resume);
        motion.current.resume = resume;
        resize();
        setEnhanced(true);
        resume();
      }).catch(() => {
        if (current === generation) {
          cleanup();
          setEnhanced(false);
        }
      });
    }

    start();
    desktop.addEventListener("change", start);
    return () => {
      generation++;
      cleanup();
      desktop.removeEventListener("change", start);
    };
  }, []);

  function resetPointer() {
    pointer.current = { x: 0, y: 0 };
  }

  function movePointer(event: PointerEvent<HTMLElement>) {
    if (!enhanced || paused || event.pointerType !== "mouse") return;
    const { left, top, width, height } = event.currentTarget.getBoundingClientRect();
    pointer.current = {
      x: Math.max(-1, Math.min(1, 2 * (event.clientX - left) / width - 1)),
      y: Math.max(-1, Math.min(1, 2 * (event.clientY - top) / height - 1)),
    };
  }

  return (
    <aside
      ref={scene}
      className={`${frame.showcase} ${styles.scene}`}
      aria-label={en ? "CivicLedger product preview" : "Pratinjau produk CivicLedger"}
      data-enhanced={enhanced}
      onPointerMove={movePointer}
      onPointerLeave={resetPointer}
    >
      <Image
        ref={image}
        src="/images/auth/civicledger-showcase.webp"
        alt={en ? "CivicLedger tablet dashboard and red food voucher. All figures are demo data." : "Dasbor CivicLedger pada tablet dan kupon sembako merah. Semua angka adalah data demo."}
        fill
        priority
        unoptimized
        className={styles.artwork}
      />
      <canvas ref={canvas} className={styles.canvas} aria-hidden="true" />
      {enhanced && (
        <button
          className={styles.pause}
          type="button"
          aria-pressed={paused}
          aria-label={en ? "Pause showcase animation" : "Jeda animasi pratinjau"}
          title={paused ? (en ? "Resume animation" : "Lanjutkan animasi") : (en ? "Pause animation" : "Jeda animasi")}
          onClick={() => {
            resetPointer();
            motion.current.paused = !motion.current.paused;
            setPaused(motion.current.paused);
            motion.current.resume();
          }}
        >
          {paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}
        </button>
      )}
    </aside>
  );
}
