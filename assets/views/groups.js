/* IQC · FIELD ATLAS — Groups (terminal cards) + CSV export */
(function () {
  const Atlas = (window.Atlas = window.Atlas || {});
  let thr = "0.35";
  let topN = "10";

  function ds(id) { return Atlas.palette ? Atlas.palette(id) : "#888"; }

  function render() {
    const { groups } = Atlas.data.get();
    const grid = document.getElementById("groups-grid");
    grid.innerHTML = "";
    const list = (groups && groups.by_threshold && groups.by_threshold[thr]) || [];

    document.querySelectorAll('[data-thr]').forEach((b) => {
      b.classList.toggle("on", b.dataset.thr === thr);
    });

    if (!list.length) {
      grid.innerHTML = `<div style="grid-column:1/-1; padding:32px; text-align:center;
        font-size:11px; color:var(--text-mute); letter-spacing:0.1em;">
        NO CLUSTERS AT THRESHOLD ${thr}.</div>`;
      return;
    }

    for (const g of list) {
      const card = document.createElement("div");
      card.className = "gcard";
      const topDS = g.top_dataset || "";
      card.style.setProperty("--group-color", ds(topDS));
      const sharpe = (g.mean_sharpe ?? 0).toFixed(2);
      const fieldsHTML = (g.sample_fields || []).slice(0, 6)
        .map((f) => `<div class="gcard-field">${f}</div>`).join("");
      card.innerHTML = `
        <div class="gcard-head">
          <span class="gcard-id">${g.id}</span>
          <span class="gcard-n">${g.n}<em>fields</em></span>
        </div>
        <div class="gcard-meta">
          <span>μ sharpe</span><span class="gcard-meta-val">${sharpe}</span>
          <span>dataset</span><span class="gcard-meta-val">${topDS || "—"}</span>
        </div>
        <div class="gcard-fields">${fieldsHTML}</div>
      `;
      card.addEventListener("click", () => {
        // open detail for top-fitness member of this cluster
        const cid = parseInt(String(g.id).replace(/^C/i, ""), 10);
        const members = (Atlas.data.get().nodes || [])
          .filter((n) => n.cluster === cid)
          .sort((a, b) => (b.fitness ?? -1e18) - (a.fitness ?? -1e18));
        const target = members[0] || { id: (g.sample_fields || [])[0] };
        if (target && target.id) Atlas.detail.open(target.id);
      });
      grid.appendChild(card);
    }
  }

  // ── CSV ───────────────────────────────────────────────────────
  const COLS = [
    "threshold", "group_id", "group_size", "top_dataset",
    "rank", "field_id",
    "fitness", "sharpe", "turnover", "returns", "drawdown",
    "long_count", "short_count",
    "type", "reducer",
    "category", "subcategory", "dataset",
    "alpha_id", "expr",
  ];
  function csvEscape(v) {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  }
  function membersOfCluster(cid, nodes) {
    return nodes.filter((n) => n.cluster === cid)
      .sort((a, b) => (b.fitness ?? -Infinity) - (a.fitness ?? -Infinity));
  }
  function buildCSV() {
    const { nodes, groups } = Atlas.data.get();
    const cards = (groups && groups.by_threshold && groups.by_threshold[thr]) || [];
    const limit = topN === "all" ? Infinity : parseInt(topN, 10);
    const lines = [COLS.join(",")];
    for (const g of cards) {
      const cid = parseInt(String(g.id).replace(/^C/i, ""), 10);
      if (!Number.isFinite(cid)) continue;
      const members = membersOfCluster(cid, nodes).slice(0, limit);
      members.forEach((m, i) => {
        const row = [
          thr, g.id, g.n, g.top_dataset || "",
          i + 1, m.id,
          (m.fitness ?? "").toString(),
          (m.sharpe ?? "").toString(),
          (m.turnover ?? "").toString(),
          (m.returns ?? "").toString(),
          (m.drawdown ?? "").toString(),
          (m.longCount ?? "").toString(),
          (m.shortCount ?? "").toString(),
          m.type || "", m.reducer || "",
          m.category || "", m.subcategory || "", m.dataset || "",
          m.alpha_id || "", m.expr || "",
        ].map(csvEscape);
        lines.push(row.join(","));
      });
    }
    return lines.join("\n");
  }
  function downloadBlob(content, filename) {
    const blob = new Blob(["﻿" + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }
  function exportNow() {
    const btn = document.getElementById("export-csv-btn");
    btn.classList.add("firing");
    setTimeout(() => btn.classList.remove("firing"), 280);
    const csv = buildCSV();
    const rows = csv.split("\n").length - 1;
    if (rows <= 0) return;
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "");
    const fname = `iqc_atlas_groups_thr${thr}_top${topN}_${ts}.csv`;
    downloadBlob(csv, fname);
  }

  Atlas.groups = {
    init() {
      document.querySelectorAll('[data-thr]').forEach((b) => {
        b.addEventListener("click", () => { thr = b.dataset.thr; render(); });
      });
      document.querySelectorAll('[data-topn]').forEach((b) => {
        b.addEventListener("click", () => {
          document.querySelectorAll('[data-topn]').forEach((x) => x.classList.remove("on"));
          b.classList.add("on");
          topN = b.dataset.topn;
        });
      });
      const exp = document.getElementById("export-csv-btn");
      if (exp) exp.addEventListener("click", exportNow);
      render();
    },
    redraw: render,
    applyFilters: render,
    exportNow,
  };
})();
