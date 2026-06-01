/* IQC · FIELD ATLAS — Graph view (Sigma.js 2.4.0) chunked + yellow progress */
(function () {
  const Atlas = (window.Atlas = window.Atlas || {});
  let sigma = null;
  let graph = null;
  let allEdges = [];

  const NODE_CHUNK = 500;
  const EDGE_CHUNK = 1500;

  const COLOR_BASE_EDGE = "rgba(168, 168, 168, 0.10)";
  const COLOR_SELECTED  = "#ffffff";
  const COLOR_NEIGHBOR  = "#ffd600";
  const COLOR_DIM       = "rgba(168, 168, 168, 0.06)";

  function ds(id) { return Atlas.palette ? Atlas.palette(id) : "#888"; }

  function setProgress(pct, stage) {
    const fill = document.getElementById("loading-bar-fill");
    const txt  = document.getElementById("loading-pct");
    const stg  = document.getElementById("loading-stage");
    if (fill) fill.style.width = `${(pct * 100).toFixed(1)}%`;
    if (txt)  txt.textContent  = `${String(Math.round(pct * 100)).padStart(2, "0")}%`;
    if (stg && stage) stg.textContent = stage;
  }
  function yieldFrame() { return new Promise((r) => requestAnimationFrame(r)); }

  async function build(container) {
    const { nodes, edges } = Atlas.data.get();
    graph = new graphology.Graph({ type: "undirected" });
    allEdges = edges;

    const N = nodes.length;
    const NODE_W = 0.55;
    const EDGE_W = 0.35;

    setProgress(0, "loading nodes 0 / " + N.toLocaleString());
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
          color: ds(n.dataset),
          zIndex: Math.abs(n.sharpe || 0),
          label: "",
          _id: n.id,
          _dataset: n.dataset,
          _sharpe: n.sharpe,
        });
      }
      setProgress((end / N) * NODE_W,
        `loading nodes ${end.toLocaleString()} / ${N.toLocaleString()}`);
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
      labelColor: { color: "#f0f0f0" },
      labelDensity: 0.3,
      labelGridCellSize: 80,
      labelRenderedSizeThreshold: 6,
      defaultEdgeColor: COLOR_BASE_EDGE,
      minCameraRatio: 0.05,
      maxCameraRatio: 12,
      stagePadding: 50,
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

    await new Promise((r) => setTimeout(r, 220));
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
        const a = 0.10 + 0.55 * (Math.abs(w) - minAbs) / (1 - minAbs);
        graph.addEdge(s, t, {
          size: 0.4 + Math.abs(w) * 1.0,
          color: `rgba(168, 168, 168, ${a.toFixed(3)})`,
          _w: w,
        });
        added++;
      }
      if (baseProgress != null && weight != null) {
        setProgress(baseProgress + (end / total) * weight,
          `loading edges  ${added.toLocaleString()}`);
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
      const a = 0.10 + 0.55 * (Math.abs(w) - minAbs) / (1 - minAbs);
      graph.addEdge(s, t, {
        size: 0.4 + Math.abs(w) * 1.0,
        color: `rgba(168, 168, 168, ${a.toFixed(3)})`,
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
    if (!nodeId) {
      graph.forEachNode((n) => {
        const node = Atlas.data.byId(n);
        graph.setNodeAttribute(n, "color", ds(node?.dataset));
      });
      sigma && sigma.refresh();
      return;
    }
    const neighbors = new Set(Atlas.data.neighborsOf(nodeId).map((x) => x.id));
    neighbors.add(nodeId);
    graph.forEachNode((n) => {
      if (n === nodeId) {
        graph.setNodeAttribute(n, "color", COLOR_SELECTED);
        graph.setNodeAttribute(n, "zIndex", 100);
      } else if (neighbors.has(n)) {
        graph.setNodeAttribute(n, "color", COLOR_NEIGHBOR);
        graph.setNodeAttribute(n, "zIndex", 50);
      } else {
        graph.setNodeAttribute(n, "color", COLOR_DIM);
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
    graph.forEachNode((id) => {
      const n = Atlas.data.byId(id);
      if (!n) return;
      graph.setNodeAttribute(id, "hidden", !Atlas.search.passes(n));
      graph.setNodeAttribute(id, "color", ds(n.dataset));
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
        const stg = document.getElementById("loading-stage");
        if (stg) { stg.textContent = "render failed: " + (err.message || "").slice(0, 60); stg.style.color = "var(--neg)"; }
      });
    },
    rebuildEdges,
    applyFilters,
    focus,
    select,
  };
})();
