/* IQC · FIELD ATLAS — Main controller (terminal aesthetic) */
(function () {
  const Atlas = (window.Atlas = window.Atlas || {});

  /* --- desaturated dark-friendly 17-color palette --- */
  /* Override whatever colors live in datasets.json with these terminal-safe tones. */
  const PALETTE = {
    analyst4:      "#6b8a90",
    fundamental2:  "#7d8a6b",
    fundamental6:  "#9b6b54",
    model16:       "#a8895c",
    model51:       "#6b7990",
    model53:       "#8a6b8a",
    model77:       "#94855e",
    news12:        "#5e8a7d",
    news18:        "#9b7d7d",
    option8:       "#7a8a9b",
    option9:       "#98896b",
    pv1:           "#aa7a5e",
    pv13:          "#6b8a6b",
    sentiment1:    "#9b7a85",
    socialmedia12: "#888a6b",
    socialmedia8:  "#6b8a98",
    univ1:         "#888888",
  };
  const PALETTE_DEFAULT = "#888888";
  Atlas.palette = (id) => PALETTE[id] || PALETTE_DEFAULT;

  const viewInits = {};

  function setView(v) {
    document.querySelectorAll(".vc").forEach((c) => {
      c.classList.toggle("hidden", c.dataset.view !== v);
    });
    document.querySelectorAll(".vl-row").forEach((row) => {
      row.classList.toggle("active", row.dataset.view === v);
    });

    const target = Atlas[v];
    if (!viewInits[v]) {
      viewInits[v] = true;
      if (target && target.init) target.init();
    } else {
      if (target && target.redraw) target.redraw();
    }
  }

  function setupHeaderStats(data) {
    document.querySelector('[data-stat="n_fields"]').textContent =
      data.nodes.length.toLocaleString();
    document.querySelector('[data-stat="n_sim"]').textContent =
      data.nodes.filter((n) => n.alpha_id).length.toLocaleString();
    document.querySelector('[data-stat="n_clusters"]').textContent =
      (data.groups && data.groups.cluster_heatmap && data.groups.cluster_heatmap.labels.length) || "—";
  }

  function setupLegend(data) {
    const legend = document.getElementById("dataset-legend");
    legend.innerHTML = "";
    // override colors with terminal palette
    data.datasets.forEach((d) => { d.color = Atlas.palette(d.id); });
    const sorted = [...data.datasets].sort((a, b) => b.count - a.count);
    for (const d of sorted) {
      const li = document.createElement("li");
      li.className = "legend-row";
      li.dataset.dataset = d.id;
      li.dataset.active = "1";
      li.innerHTML = `
        <span class="legend-swatch" style="background:${d.color}"></span>
        <span class="legend-name">${d.id}</span>
        <span class="legend-count">${d.count.toLocaleString()}</span>
      `;
      li.addEventListener("click", () => {
        const on = li.dataset.active === "1";
        li.dataset.active = on ? "0" : "1";
        Atlas.search.toggleDataset(d.id);
        broadcastFilters();
      });
      legend.appendChild(li);
    }
  }

  function setupViewList() {
    document.querySelectorAll(".vl-row").forEach((row) => {
      row.addEventListener("click", () => setView(row.dataset.view));
    });
  }

  function setupFilters() {
    document.querySelectorAll('[data-filter-type]').forEach((b) => {
      b.addEventListener("click", () => {
        const t = b.dataset.filterType;
        const on = b.classList.toggle("on");
        Atlas.search.setType(t, on);
        broadcastFilters();
      });
    });

    const sharpe = document.getElementById("sharpe-min");
    const sharpeRO = document.getElementById("sharpe-min-readout");
    sharpe.addEventListener("input", () => {
      Atlas.search.setSharpeMin(sharpe.value);
      sharpeRO.textContent = (+sharpe.value).toFixed(1).replace("-", "−");
      broadcastFilters();
    });

    const corr = document.getElementById("corr-min");
    const corrRO = document.getElementById("corr-min-readout");
    corr.addEventListener("input", () => {
      Atlas.search.setCorrMin(corr.value);
      corrRO.textContent = (+corr.value).toFixed(2);
      if (Atlas.graph && Atlas.graph.rebuildEdges) {
        Atlas.graph.rebuildEdges(+corr.value);
      }
    });
  }

  function broadcastFilters() {
    if (viewInits.graph && Atlas.graph) Atlas.graph.applyFilters();
    if (viewInits.map && Atlas.map) Atlas.map.applyFilters();
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
        div.className = "sr-result" + (i === focused ? " focused" : "");
        div.innerHTML = `
          <span class="sr-result-id">${r.id}</span>
          <span class="sr-result-meta">${r.dataset || ""} · ${(+r.sharpe || 0).toFixed(2)}</span>
          <span class="sr-result-desc">${(r.desc || "").slice(0, 120)}</span>
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
    input.addEventListener("blur", () => { setTimeout(() => results.classList.remove("open"), 130); });
    input.addEventListener("keydown", (e) => {
      if (e.key === "ArrowDown") {
        focused = Math.min(current.length - 1, focused + 1); render(); e.preventDefault();
        scrollFocused(results);
      } else if (e.key === "ArrowUp") {
        focused = Math.max(0, focused - 1); render(); e.preventDefault();
        scrollFocused(results);
      } else if (e.key === "Enter" && focused >= 0) {
        Atlas.detail.open(current[focused].id);
        results.classList.remove("open");
        e.preventDefault();
      } else if (e.key === "Escape") {
        results.classList.remove("open");
        input.blur();
      }
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "/" && document.activeElement !== input) {
        e.preventDefault(); input.focus();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault(); input.focus();
      }
      if (e.key === "Escape") {
        Atlas.detail && Atlas.detail.close && Atlas.detail.close();
      }
    });
  }

  function scrollFocused(parent) {
    const f = parent.querySelector(".sr-result.focused");
    if (f) f.scrollIntoView({ block: "nearest" });
  }

  async function boot() {
    let data;
    try {
      data = await Atlas.data.load();
    } catch (err) {
      console.error(err);
      const el = document.getElementById("loading-stage");
      if (el) { el.textContent = "data load failed"; el.style.color = "var(--neg)"; }
      return;
    }
    Atlas.search.init(data.nodes);
    setupHeaderStats(data);
    setupLegend(data);
    setupViewList();
    setupFilters();
    setupSearch();
    Atlas.detail.init();
    setView("graph");
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
