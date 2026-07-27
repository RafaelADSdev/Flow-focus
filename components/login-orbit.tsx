"use client";

import { useEffect, useRef, useState } from "react";

const STEPS = ["Captar", "Trabalhar", "Auditar", "Liberar"] as const;

export function LoginOrbit() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(true);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    const sync = () => {
      const visible = document.visibilityState === "visible";
      const onScreen = node.getBoundingClientRect().width > 0;
      setActive(visible && onScreen);
    };

    const io = new IntersectionObserver(
      ([entry]) => setActive(document.visibilityState === "visible" && !!entry?.isIntersecting),
      { threshold: 0.15 },
    );
    io.observe(node);
    document.addEventListener("visibilitychange", sync);
    sync();

    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={`aside-orbit${active ? " is-orbiting" : ""}`}
      aria-hidden="true"
    >
      <div className="orbit-ring">
        {STEPS.map((label, index) => (
          <span key={label} className={`orbit-spoke spoke-${index + 1}`}>
            <span className="orbit-label">{label}</span>
          </span>
        ))}
      </div>
      <span className="orbit-core">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}
