/* IQC ATLAS — Graph view (Sigma.js v3 WebGL) with chunked loading + progress */
(function () {
  const Atlas = (window.Atlas = window.Atlas || {});
  let sigma = null;
  let graph = null;
  let allEdges = [];
  let selected = null;

  const NODE_CHUNK = 500;
  const EDGE_CHUNK = 1500;

  // ── progress helpers ────────────────────────────────────────────
  function setProgress(pct, stage) {
    const fill = document.getElementById("loading-bar-fill");
    const txt  = document.getElementById("loading-pct");
    const stg  = document.getElementById("loading-stage");
    if (fill) fill.style.width = `${(pct * 100).toFixed(1)}%`;
    if (txt)  txt.textContent  = `${Math.round(pct * 100)}%`;
    if (stg && stage) stg.textContent = stage;
  }
  function yieldFrame() { return new Promise((r) => requestAnimationFrame(r)); }

  // ── build ───────────────────────────────────────────────────────
  async function build(container) {
    const { nodes, edges, datasets } = Atlas.data.get();
    const dsColor = new Map(datasets.map((d) => [d.id, d.color]));

    graph = new graphology.Graph({ type: "undirected" });
    allEdges = edges;

    const N = nodes.length;
    const NODE_W = 0.55;
    const EDGE_W = 0.35;

    setProgress(0, "loading nodes");
    await yieldFrame();

    for (let i = 0; i < N; i += NODE_CHUNK) {
      const end = Math.min(i + NODE_CHUNK, N);
      for (let j = i; j < end; j++) {
        const n = nodes[j];
        const r = Math.max(1.5, Math.min(7,
          1.5 + Math.log10(1 + Math.abs(n.sharpe || 0) * 4)));
        graph.addNode(n.id, {
          x: n.x ?? (Math.random() - 0.5) * 100,
          y: n.y ?? (Math.random() - 0.5) * 100,
          size: r,
          color: dsColor.get(n.dataset) || "#c89455",
          zIndex: Math.abs(n.sharpe || 0),
          label: "",
          _id: n.id,
          _dataset: n.dataset,
          _sharpe: n.sharpe,
        });
      }
      setProgress((end / N) * NODE_W,
        `loading nodes · ${end.toLocaleString()} / ${N.toLocaleString()}`);
      await yieldFrame();
    }

    setProgress(NODE_W, "loading edges");
    await yieldFrame();
    const minAbs = Atlas.search.state.corrMin;
    await rebuildEdgesAsync(minAbs, NODE_W, EDGE_W);

    setProgress(NODE_W + EDGE_W, "rendering");
    await yieldFrame();

    sigma = new Sigma(graph, container, {
      renderEdgeLabels: false,
      labelFont: "JetBrains Mono",
      labelSize: 11,
      labelColor: { color: "#ebe3cf" },
      labelDensity: 0.3,
      labelGridCellSize: 80,
      labelRenderedSizeThreshold: 6,
      defaultEdgeColor: "rgba(200, 148, 85, 0.18)",
      minCameraRatio: 0.05,
      maxCameraRatio: 12,
      stagePadding: 60,
    });

    setProgress(1.0, "ready");

    const hud = document.getElementById("graph-hud");
    sigma.on("enterNode", ({ node }) => {
      const a = graph.getNodeAttributes(node);
      hud.textContent = `${a._id}  ·  ${a._dataset}  ·  sharpe ${(a._sharpe || 0).toFixed(2)}`;
      graph.setNodeAttribute(node, "highlighted", true);
      sigma.refresh();
    });
    sigma.on("leaveNode", ({ node }) => {
      hud.textContent = "drag · zoom · click a node";
      graph.setNodeAttribute(node, "highlighted", false);
      sigma.refresh();
    });
    sigma.on("clickNode", ({ node }) => {
      select(node);
      Atlas.detail.open(node);
    });
    sigma.on("clickStage", () => {
      select(null);
      Atlas.detail.close();
    });

    await new Promise((r) => setTimeout(r, 180));
    document.getElementById("graph-overlay").classList.add("hidden");
  }

  async function rebuildEdgesAsync(minAbs, baseProgress, weight) {
    if (!graph) return;
    graph.forEachEdge((e) => graph.dropEdge(e));
    let added = 0;
    const total = allEdges.length;

    for (let i = 0; i < total; i += EDGE_CHUNK) {
      const end = Math.min(i + EDGE_CHUNK, total);
      for (let j = i; j < end; j++) {
        const [s, t, w] = allEdges[j];
        if (Math.abs(w) < minAbs) continue;
        if (!graph.hasNode(s) || !graph.hasNode(t)) continue;
        graph.addEdge(s, t, {
          size: 0.4 + Math.abs(w) * 1.2,
          color: w >= 0
            ? `rgba(200, 148, 85, ${0.12 + 0.55 * (Math.abs(w) - minAbs) / (1 - minAbs)})`
            : `rgba(184, 85, 58, ${0.12 + 0.55 * (Math.abs(w) - minAbs) / (1 - minAbs)})`,
          _w: w,
        });
        added++;
      }
      if (baseProgress != null && weight != null) {
        setProgress(baseProgress + (end / total) * weight,
          `loading edges · ${added.toLocaleString()} kept`);
        await yieldFrame();
      }
    }
    const eEl = document.querySelector('[data-stat="n_edges"]');
    if (eEl) eEl.textContent = added.toLocaleString();
    if (sigma) sigma.refresh();
    return added;
  }

  function rebuildEdges(minAbs) {
    if (!graph) return;
    graph.forEachEdge((e) => graph.dropEdge(e));
    let added = 0;
    for (const [s, t, w] of allEdges) {
      if (Math.abs(w) < minAbs) continue;
      if (!graph.hasNode(s) || !graph.hasNode(t)) continue;
      graph.addEdge(s, t, {
        size: 0.4 + Math.abs(w) * 1.2,
        color: w >= 0
          ? `rgba(200, 148, 85, ${0.12 + 0.55 * (Math.abs(w) - minAbs) / (1 - minAbs)})`
          : `rgba(184, 85, 58, ${0.12 + 0.55 * (Math.abs(w) - minAbs) / (1 - minAbs)})`,
        _w: w,
      });
      added++;
    }
    const eEl = document.querySelector('[data-stat="n_edges"]');
    if (eEl) eEl.textContent = added.toLocaleString();
    if (sigma) sigma.refresh();
  }

  function select(nodeId) {
    if (!graph) return;
    selected = nodeId;
    const { datasets } = Atlas.data.get();
    const dsColor = new Map(datasets.map((d) => [d.id, d.color]));
    if (!nodeId) {
      graph.forEachNode((n) => {
        const node = Atlas.data.byId(n);
        graph.setNodeAttribute(n, "color", dsColor.get(node?.dataset) || "#c89455");
      });
      sigma && sigma.refresh();
      return;
    }
    const neighbors = new Set(Atlas.data.neighborsOf(nodeId).map((x) => x.id));
    neighbors.add(nodeId);
    graph.forEachNode((n) => {
      if (neighbors.has(n)) {
        graph.setNodeAttribute(n, "color", n === nodeId ? "#e6a86b" : "#c89455");
        graph.setNodeAttribute(n, "zIndex", 100);
      } else {
        graph.setNodeAttribute(n, "color", "rgba(255, 240, 220, 0.10)");
        graph.setNodeAttribute(n, "zIndex", 0);
      }
    });
    sigma.refresh();
  }

  function focus(nodeId) {
    if (!sigma || !graph || !graph.hasNode(nodeId)) return;
    const a = graph.getNodeAttributes(nodeId);
    sigma.getCamera().animate({ x: a.x, y: a.y, ratio: 0.4 }, { duration: 480 });
    select(nodeId);
  }

  function applyFilters() {
    if (!graph) return;
    const { datasets } = Atlas.data.get();
    const dsColor = new Map(datasets.map((d) => [d.id, d.color]));
    graph.forEachNode((id) => {
      const n = Atlas.data.byId(id);
      if (!n) return;
      graph.setNodeAttribute(id, "hidden", !Atlas.search.passes(n));
      graph.setNodeAttribute(id, "color", dsColor.get(n.dataset) || "#c89455");
    });
    sigma && sigma.refresh();
  }

  Atlas.graph = {
    init() {
      const wrap = document.getElementById("view-graph");
      const oldCanvas = document.getElementById("graph-canvas");
      if (oldCanvas) oldCanvas.remove();
      const container = document.createElement("div");
      container.id = "graph-canvas";
      container.style.cssText = "position:absolute;inset:0;";
      wrap.insertBefore(container, wrap.firstChild);
      build(container).catch((err) => {
        console.error("graph build failed", err);
        const txt = document.getElementById("loading-text");
        if (txt) {
          txt.textContent = "Atlas data could not be drawn.";
          txt.style.color = "var(--rust)";
        }
      });
    },
    rebuildEdges,
    applyFilters,
    focus,
    select,
  };
})();
