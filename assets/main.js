/* IQC ATLAS — Main controller
   Boot order:
     1. load all assets/data/*.json
     2. populate stats + dataset legend + filter handlers
     3. initialize each view lazily on tab switch
*/
(function () {
  const Atlas = (window.Atlas = window.Atlas || {});

  const PLATE_TITLES = {
    graph:   { mark: "PLATE I",   meta: "Network",   title: "Alpha Correlation" },
    map:     { mark: "PLATE II",  meta: "UMAP",      title: "Embedding Space" },
    heatmap: { mark: "PLATE III", meta: "Matrix",    title: "Cluster Correlation" },
    groups:  { mark: "PLATE IV",  meta: "Clusters",  title: "Constellations" },
  };

  const viewInits = {};
  let currentView = "graph";

  function setView(v) {
    currentView = v;
    document.querySelectorAll(".view-container").forEach((c) => {
      c.classList.toggle("hidden", c.dataset.view !== v);
    });
    document.querySelectorAll(".tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.view === v);
    });
    const meta = PLATE_TITLES[v] || {};
    document.getElementById("overline-mark").textContent = meta.mark || "—";
    document.getElementById("overline-title").textContent = meta.title || "—";
    document.getElementById("overline-meta").textContent = meta.meta || "—";

    if (!viewInits[v]) {
      viewInits[v] = true;
      if (Atlas[v] && Atlas[v].init) Atlas[v].init();
    } else {
      if (Atlas[v] && Atlas[v].redraw) Atlas[v].redraw();
    }
  }

  function setupStatsAndLegend(data) {
    const { nodes, datasets } = data;
    document.querySelector('[data-stat="n_fields"]').textContent = nodes.length.toLocaleString();
    document.querySelector('[data-stat="n_sim"]').textContent =
      nodes.filter((n) => n.alpha_id).length.toLocaleString();
    document.querySelector('[data-stat="n_clusters"]').textContent =
      (data.groups && data.groups.cluster_heatmap && data.groups.cluster_heatmap.labels.length) || "—";

    const legend = document.getElementById("dataset-legend");
    legend.innerHTML = "";
    const sorted = [...datasets].sort((a, b) => b.count - a.count);
    for (const d of sorted) {
      const li = document.createElement("li");
      li.className = "legend-row";
      li.dataset.dataset = d.id;
      li.dataset.active = "1";
      li.innerHTML = `
        <span class="legend-swatch" style="background:${d.color}"></span>
        <span class="legend-name">${d.name}</span>
        <span class="legend-count">${d.count}</span>
      `;
      li.addEventListener("click", () => {
        const wasActive = li.dataset.active === "1";
        li.dataset.active = wasActive ? "0" : "1";
        Atlas.search.toggleDataset(d.id);
        broadcastFilters();
      });
      legend.appendChild(li);
    }
  }

  function setupFilters() {
    document.querySelectorAll('[data-filter-type]').forEach((b) => {
      b.addEventListener("click", () => {
        const t = b.dataset.filterType;
        const on = b.classList.toggle("active");
        Atlas.search.setType(t, on);
        broadcastFilters();
      });
    });
    const sharpe = document.getElementById("sharpe-min");
    const sharpeRO = document.getElementById("sharpe-min-readout");
    sharpe.addEventListener("input", () => {
      Atlas.search.setSharpeMin(sharpe.value);
      sharpeRO.textContent = Number(sharpe.value).toFixed(1).replace("-", "−");
      broadcastFilters();
    });
    const corr = document.getElementById("corr-min");
    const corrRO = document.getElementById("corr-min-readout");
    corr.addEventListener("input", () => {
      Atlas.search.setCorrMin(corr.value);
      corrRO.textContent = Number(corr.value).toFixed(2);
      if (Atlas.graph && Atlas.graph.rebuildEdges) {
        Atlas.graph.rebuildEdges(+corr.value);
      }
    });
  }

  function broadcastFilters() {
    if (viewInits.graph && Atlas.graph) Atlas.graph.applyFilters();
    if (viewInits.map && Atlas.umap) Atlas.umap.applyFilters();
    if (viewInits.heatmap && Atlas.heatmap) Atlas.heatmap.applyFilters();
    if (viewInits.groups && Atlas.groups) Atlas.groups.applyFilters();
  }

  function setupSearch() {
    const input = document.getElementById("search-input");
    const results = document.getElementById("search-results");
    let focused = -1, current = [];

    function render() {
      results.innerHTML = "";
      current.forEach((r, i) => {
        const div = document.createElement("div");
        div.className = "search-result" + (i === focused ? " focused" : "");
        div.innerHTML = `
          <span class="search-result-id">${r.id}</span>
          <span class="search-result-meta">${r.dataset || ""} · sharpe ${Number(r.sharpe || 0).toFixed(2)}</span>
          <span class="search-result-desc">${(r.desc || "").slice(0, 120)}</span>
        `;
        div.addEventListener("mousedown", (e) => {
          e.preventDefault();
          Atlas.detail.open(r.id);
          results.classList.remove("open");
          input.value = r.id;
        });
        results.appendChild(div);
      });
      results.classList.toggle("open", current.length > 0);
    }

    input.addEventListener("input", () => {
      current = Atlas.search.query(input.value);
      focused = -1;
      render();
    });
    input.addEventListener("focus", () => { if (current.length) results.classList.add("open"); });
    input.addEventListener("blur", () => { setTimeout(() => results.classList.remove("open"), 120); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") { focused = Math.min(current.length - 1, focused + 1); render(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { focused = Math.max(0, focused - 1); render(); e.preventDefault(); }
      else if (e.key === "Enter" && focused >= 0) {
        Atlas.detail.open(current[focused].id);
        results.classList.remove("open");
        e.preventDefault();
      } else if (e.key === "Escape") { results.classList.remove("open"); input.blur(); }
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "/" && document.activeElement !== input) { e.preventDefault(); input.focus(); }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); input.focus(); }
    });
  }

  function setupTabs() {
    document.querySelectorAll(".tab").forEach((t) => {
      t.addEventListener("click", () => setView(t.dataset.view));
    });
  }

  async function boot() {
    let data;
    try {
      data = await Atlas.data.load();
    } catch (err) {
      console.error(err);
      document.getElementById("graph-overlay").innerHTML = `
        <div class="loading">
          <div class="loading-mark" style="color: var(--rust)">!</div>
          <div class="loading-text">Atlas data not yet generated. Run the pipeline first.</div>
        </div>`;
      return;
    }
    Atlas.search.init(data.nodes);
    setupStatsAndLegend(data);
    setupFilters();
    setupSearch();
    setupTabs();
    Atlas.detail.init();
    setView("graph");
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
