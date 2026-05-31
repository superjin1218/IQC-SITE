/* IQC ATLAS — Groups (cluster cards by threshold) + CSV export */
(function () {
  const Atlas = (window.Atlas = window.Atlas || {});
  let thr = "0.35";
  let topN = "10";

  // ── render cards ────────────────────────────────────────────────
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

  // ── CSV export ──────────────────────────────────────────────────
  const SUMMARY_COLS = [
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

    const lines = [SUMMARY_COLS.join(",")];

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
          m.type || "",
          m.reducer || "",
          m.category || "",
          m.subcategory || "",
          m.dataset || "",
          m.alpha_id || "",
          m.expr || "",
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
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  function showToast(msg) {
    let toast = document.getElementById("export-toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "export-toast";
      toast.className = "export-toast";
      document.getElementById("view-groups").appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 1800);
  }

  function exportNow() {
    const btn = document.getElementById("export-csv-btn");
    btn.classList.add("firing");
    setTimeout(() => btn.classList.remove("firing"), 320);

    const csv = buildCSV();
    const rows = csv.split("\n").length - 1;  // minus header
    if (rows <= 0) {
      showToast("no rows to export");
      return;
    }
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "");
    const fname = `iqc_atlas_groups_thr${thr}_top${topN}_${ts}.csv`;
    downloadBlob(csv, fname);
    showToast(`exported · ${rows.toLocaleString()} rows · ${fname}`);
  }

  Atlas.groups = {
    init() {
      // threshold seg buttons
      document.querySelectorAll('[data-thr]').forEach((b) => {
        b.addEventListener("click", () => { thr = b.dataset.thr; render(); });
      });
      // topN seg buttons
      document.querySelectorAll('[data-topn]').forEach((b) => {
        b.addEventListener("click", () => {
          document.querySelectorAll('[data-topn]').forEach((x) => x.classList.remove("active"));
          b.classList.add("active");
          topN = b.dataset.topn;
        });
      });
      // export button
      const exp = document.getElementById("export-csv-btn");
      if (exp) exp.addEventListener("click", exportNow);
      render();
    },
    redraw: render,
    applyFilters: render,
    exportNow,
  };
})();
