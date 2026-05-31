/* IQC ATLAS — Groups (cluster cards by threshold) */
(function () {
  const Atlas = (window.Atlas = window.Atlas || {});
  let thr = "0.35";

  function render() {
    const { groups, datasets } = Atlas.data.get();
    const dsColor = new Map(datasets.map((d) => [d.id, d.color]));
    const grid = document.getElementById("groups-grid");
    grid.innerHTML = "";
    const list = (groups && groups.by_threshold && groups.by_threshold[thr]) || [];

    document.querySelectorAll('[data-thr]').forEach((b) => {
      b.classList.toggle("active", b.dataset.thr === thr);
    });

    if (!list.length) {
      grid.innerHTML = `<div style="grid-column: 1/-1; padding: 32px; text-align:center;
        font-family:Fraunces; font-style:italic; color:var(--ink-dim);">
        No clusters at threshold ${thr}.</div>`;
      return;
    }

    for (const g of list) {
      const card = document.createElement("div");
      card.className = "group-card";
      const topDS = (g.top_dataset || "");
      card.style.setProperty("--group-color", dsColor.get(topDS) || "#c89455");
      const sharpeStr = (g.mean_sharpe ?? 0).toFixed(2);
      const fieldsHTML = (g.sample_fields || []).slice(0, 6)
        .map((f) => `<div class="group-card-field">${f}</div>`).join("");
      card.innerHTML = `
        <div class="group-card-head">
          <span class="group-card-num mono">${g.id}</span>
          <span class="group-card-size">${g.n}</span>
        </div>
        <div class="group-card-stats">
          <span>μ sharpe</span><span class="mono">${sharpeStr}</span>
          <span>dataset</span><span class="mono">${topDS || "—"}</span>
        </div>
        <div class="group-card-fields">${fieldsHTML}</div>
      `;
      card.addEventListener("click", () => {
        if (g.sample_fields && g.sample_fields[0]) {
          Atlas.detail.open(g.sample_fields[0]);
        }
      });
      grid.appendChild(card);
    }
  }

  Atlas.groups = {
    init() {
      document.querySelectorAll('[data-thr]').forEach((b) => {
        b.addEventListener("click", () => { thr = b.dataset.thr; render(); });
      });
      render();
    },
    redraw: render,
    applyFilters: render,
  };
})();
