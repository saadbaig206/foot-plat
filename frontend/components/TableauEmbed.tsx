"use client";
import { useEffect, useRef, useState } from "react";

const SCRIPT = "https://public.tableau.com/javascripts/api/tableau.embedding.3.latest.min.js";

/** Embeds a published Tableau viz via the Embedding API v3 web component. */
export default function TableauEmbed({ src, filters }: { src: string; filters?: Record<string, string> }) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const mount = () => {
      if (cancelled || !host.current) return;
      host.current.innerHTML = "";
      const viz = document.createElement("tableau-viz");
      viz.setAttribute("src", src);
      viz.setAttribute("toolbar", "bottom");
      viz.setAttribute("hide-tabs", "true");
      viz.style.width = "100%";
      viz.style.height = "820px";
      for (const [field, value] of Object.entries(filters ?? {})) {
        const f = document.createElement("viz-filter");
        f.setAttribute("field", field);
        f.setAttribute("value", value);
        viz.appendChild(f);
      }
      host.current.appendChild(viz);
    };
    if (customElements.get("tableau-viz")) { mount(); return () => { cancelled = true; }; }
    const s = document.createElement("script");
    s.type = "module"; s.src = SCRIPT;
    s.onload = mount; s.onerror = () => setFailed(true);
    document.head.appendChild(s);
    return () => { cancelled = true; };
  }, [src, filters]);

  if (failed) return <p role="alert" className="text-sm text-neg">The Tableau embedding script could not be loaded.</p>;
  return <div ref={host} className="min-h-[200px] w-full" />;
}
