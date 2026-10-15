"use client";

import { useEffect, useId, useRef, useState } from "react";

/** Below this, labels drop under ~10px; scroll instead of shrinking further. */
const MIN_SCALE = 0.72;

type RenderState = { status: "loading" } | { status: "ready"; svg: string } | { status: "error"; message: string };

/** Mermaid touches the DOM, so it loads only in the browser and renders each chart once. */
export function Mermaid({ chart }: { chart: string }) {
  const id = `m${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [state, setState] = useState<RenderState>({ status: "loading" });
  const dialog = useRef<HTMLDialogElement>(null);
  const [zoomed, setZoomed] = useState(false);
  const frame = useRef<HTMLDivElement>(null);

  /* Shrink a diagram to fit the column only while text stays readable; wider ones scroll. */
  useEffect(() => {
    if (state.status !== "ready" || !frame.current) return;
    const host = frame.current;
    const svg = host.querySelector("svg");
    if (!svg) return;
    const natural = svg.viewBox.baseVal?.width || svg.getBoundingClientRect().width;
    function fit() {
      if (!svg) return;
      const available = host.clientWidth;
      const scale = Math.max(Math.min(available / natural, 1), MIN_SCALE);
      svg.style.width = `${natural * scale}px`;
      svg.style.maxWidth = "none";
    }
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(host);
    return () => observer.disconnect();
  }, [state]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        fontFamily: '"SN Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        themeVariables: {
          fontSize: "14px",
          background: "#ffffff",
          primaryColor: "#f4f4f2",
          primaryBorderColor: "#d9d9d6",
          primaryTextColor: "#111211",
          secondaryColor: "#eaf1fd",
          secondaryBorderColor: "#b9d1f7",
          tertiaryColor: "#fbfaf7",
          tertiaryBorderColor: "#e8e8e7",
          lineColor: "#86868b",
          textColor: "#111211",
          clusterBkg: "#fbfaf7",
          clusterBorder: "#e8e8e7",
          edgeLabelBackground: "#ffffff",
          noteBkgColor: "#fffbeb",
          noteBorderColor: "#fee685",
          noteTextColor: "#953d00",
          actorBkg: "#111211",
          actorBorder: "#111211",
          actorTextColor: "#ffffff",
          actorLineColor: "#d9d9d6",
          signalColor: "#6e6e73",
          signalTextColor: "#111211",
          labelBoxBkgColor: "#eaf1fd",
          labelBoxBorderColor: "#b9d1f7",
          labelTextColor: "#1f6fe5",
          loopTextColor: "#1f6fe5",
          activationBkgColor: "#eaf1fd",
          sequenceNumberColor: "#ffffff",
        },
        flowchart: { curve: "basis", padding: 14, useMaxWidth: false },
        sequence: { mirrorActors: false, actorMargin: 60, useMaxWidth: false },
        state: { useMaxWidth: false },
      });
      try {
        const { svg } = await mermaid.render(id, chart);
        if (!cancelled) setState({ status: "ready", svg });
      } catch (error) {
        if (!cancelled) setState({ status: "error", message: error instanceof Error ? error.message : String(error) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (state.status === "error") {
    return (
      <div className="my-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        <p className="font-semibold">Sơ đồ không render được</p>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs">{state.message}</pre>
      </div>
    );
  }

  return (
    <figure className="diagram group/diagram relative my-8 rounded-3xl border border-line bg-bg-raised">
      {state.status === "ready" ? (
        <>
          <div className="overflow-x-auto p-5 sm:p-8">
            <div ref={frame} className="w-full">
              {/* Mermaid output, rendered with securityLevel "strict". */}
              <div className="mx-auto w-max [&_svg]:h-auto" dangerouslySetInnerHTML={{ __html: state.svg }} />
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setZoomed(true);
              dialog.current?.showModal();
            }}
            className="absolute top-3 right-3 rounded-full bg-bg px-3 py-1 text-xs font-medium text-muted shadow-sm ring-1 ring-line transition-colors hover:text-fg"
          >
            Phóng to
          </button>
          <dialog
            ref={dialog}
            onClose={() => setZoomed(false)}
            onClick={(event) => {
              if (event.target === dialog.current) dialog.current?.close();
            }}
            className="m-auto h-[92vh] w-[96vw] max-w-none rounded-3xl border border-line bg-bg p-0 backdrop:bg-black/40 backdrop:backdrop-blur-sm"
          >
            <div className="sticky top-0 flex justify-end bg-bg/80 p-3 backdrop-blur">
              <button
                type="button"
                onClick={() => dialog.current?.close()}
                className="rounded-full bg-fg px-3.5 py-1.5 text-xs font-semibold text-bg hover:bg-fg-soft"
              >
                Đóng
              </button>
            </div>
            {/* The copy mounts only while open so the page never holds two SVGs with one id. */}
            {zoomed ? (
              <div className="flex min-w-max justify-center p-8 [&_svg]:h-auto [&_svg]:min-w-[min(100%,1100px)]" dangerouslySetInnerHTML={{ __html: state.svg }} />
            ) : null}
          </dialog>
        </>
      ) : (
        <div className="m-5 h-48 animate-pulse rounded-2xl bg-surface sm:m-8" aria-label="Đang vẽ sơ đồ" />
      )}
    </figure>
  );
}
