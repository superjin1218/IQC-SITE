/* IQC ATLAS — Graph view (Sigma.js v3 WebGL) */
(function () {
  const Atlas = (window.Atlas = window.Atlas || {});
  let sigma = null;
  let graph = null;
  let allEdges = [];
  let selected = null;

  function build(container) {
    const { nodes, edges, datasets } = Atlas.data.get();

    graph = new graphology.Graph({ type: "undirected" });

    const dsColor = new Map(datasets.map((d) => [d.id, d.color]));

    // node positions from pre-computed layout (umap also OK as fallback)
    for (const n of nodes) {
      const r = Math.max(1.5, Math.min(7, 1.5 + Math.log10(1 + Math.abs(n.sharpe || 0) * 4)));
      graph.addNode(n.id, {
        x: n.x ?? (Math.random() - 0.5) * 100,
        y: n.y ?? (Math.random() - 0.5) * 100,
        size: r,
        color: dsColor.get(n.dataset) || "#c89455",
        zIndex: Math.abs(n.sharpe || 0),
        // hide label by default; show on hover/select
        label: "",
        _id: n.id,
        _dataset: n.dataset,
        _sharpe: n.sharpe,
      });
    }

    allEdges = edges;
    rebuildEdges(Atlas.search.state.corrMin);

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

    // hover
    const hud = document.getElementById("graph-hud");
    sigma.on("enterNode", ({ node }) => {
      const attrs = graph.getNodeAttributes(node);
      hud.textContent = `${attrs._id}  ·  ${attrs._dataset}  ·  sharpe ${(attrs._sharpe || 0).toFixed(2)}`;
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

    document.getElementById("graph-overlay").classList.add("hidden");
  }

  function rebuildEdges(minAbs) {
    if (!graph) return;
    // remove all edges
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
    document.querySelector('[data-stat="n_edges"]').textContent = added.toLocaleString();
    if (sigma) sigma.refresh();
  }

  function select(nodeId) {
    if (!graph) return;
    selected = nodeId;
    if (!nodeId) {
      graph.forEachNode((n, attrs) => {
        graph.setNodeAttribute(n, "color", Atlas.data.byId(n)?._color || attrs.color);
      });
      return;
    }
    // dim all, highlight neighbors
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
    const attrs = graph.getNodeAttributes(nodeId);
    sigma.getCamera().animate({ x: attrs.x, y: attrs.y, ratio: 0.4 }, { duration: 480 });
    select(nodeId);
  }

  // filter changes — colorize / hide by passes()
  function applyFilters() {
    if (!graph) return;
    const { datasets } = Atlas.data.get();
    const dsColor = new Map(datasets.map((d) => [d.id, d.color]));
    graph.forEachNode((id) => {
      const n = Atlas.data.byId(id);
      if (!n) return;
      const pass = Atlas.search.passes(n);
      graph.setNodeAttribute(id, "hidden", !pass);
      graph.setNodeAttribute(id, "color", dsColor.get(n.dataset) || "#c89455");
    });
    if (sigma) sigma.refresh();
  }

  Atlas.graph = {
    init() {
      const wrap = document.getElementById("view-graph");
      const canvas = document.getElementById("graph-canvas");
      // Sigma uses its own canvas; replace placeholder canvas with a div container
      canvas.remove();
      const container = document.createElement("div");
      container.id = "graph-canvas";
      container.style.cssText = "position:absolute;inset:0;";
      wrap.insertBefore(container, wrap.firstChild);
      build(container);
    },
    rebuildEdges,
    applyFilters,
    focus,
    select,
  };
})();
