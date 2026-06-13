"use client";

import { useEffect, useState } from "react";

// True while the tab is in the foreground. Ambient animations pause when
// this goes false so a backgrounded tab spends no CPU on decorative motion.
export function usePageVisible() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const update = () => setVisible(!document.hidden);
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);

  return visible;
}
