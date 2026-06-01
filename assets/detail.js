/* IQC · FIELD ATLAS — Detail slide-in panel + PnL spark */
(function () {
  const Atlas = (window.Atlas = window.Atlas || {});
  const els = {};
  function $(id) { return (els[id] = els[id] || document.getElementById(id)); }

  function fmt(v, d = 2) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    return Number(v).toFixed(d);
  }
  function tone(v) { return v > 0 ? "pos" : v < 0 ? "neg" : ""; }

  function drawPnl(canvas, points) {
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth, H = canvas.offsetHeight;
    canvas.width = W * dpr; canvas.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);
    if (!points || !points.length) return;

    let acc = 0;
    const series = points.map((p) => { acc += p.v; return { d: p.d, c: acc }; });
    const min = Math.min(...series.map((s) => s.c));
    const max = Math.max(...series.map((s) => s.c));
    const pad = 8;
    const W2 = W - pad*2, H2 = H - pad*2;

    // dotted zero rule
    if (min < 0 && max > 0) {
      const zy = pad + H2 * (max / (max - min));
      ctx.strokeStyle = "rgba(107, 107, 107, 0.4)";
      ctx.setLineDash([1, 3]);
      ctx.beginPath(); ctx.moveTo(pad, zy); ctx.lineTo(W - pad, zy); ctx.stroke();
      ctx.setLineDash([]);
    }

    // line — thin yellow, no fill
    ctx.beginPath();
    series.forEach((s, i) => {
      const x = pad + (i / (series.length - 1)) * W2;
      const y = pad + H2 - ((s.c - min) / (max - min || 1)) * H2;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#ffd600";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // endpoint dot
    const last = series[series.length - 1];
    const lx = pad + W2;
    const ly = pad + H2 - ((last.c - min) / (max - min || 1)) * H2;
    ctx.fillStyle = "#ffd600";
    ctx.beginPath(); ctx.arc(lx, ly, 2.2, 0, Math.PI * 2); ctx.fill();
  }

  async function open(id) {
    const node = Atlas.data.byId(id);
    if (!node) return;

    document.getElementById("app").setAttribute("data-detail-open", "1");
    window.dispatchEvent(new Event("resize"));

    const allNodes = Atlas.data.get().nodes;
    const idx = allNodes.findIndex((n) => n.id === id);
    $("detail-num").textContent = String(idx + 1).padStart(4, "0");
    $("detail-total").textContent = String(allNodes.length).padStart(4, "0");

    $("detail-id").textContent = node.id;
    $("detail-type").textContent = node.type || "—";
    $("detail-type").setAttribute("data-tone", (node.type || "").toLowerCase());
    $("detail-dataset").textContent = node.dataset || "—";
    $("detail-dataset").setAttribute("data-tone", "dataset");
    $("detail-reducer").textContent = node.reducer || "—";
    $("detail-desc").textContent = node.desc || "— no description —";

    $("metric-sharpe").textContent = fmt(node.sharpe);
    $("metric-sharpe").setAttribute("data-tone", tone(node.sharpe));
    $("metric-fitness").textContent = fmt(node.fitness);
    $("metric-fitness").setAttribute("data-tone", tone(node.fitness));
    $("metric-turnover").textContent = node.turnover != null ? (node.turnover*100).toFixed(1) + "%" : "—";
    $("metric-returns").textContent = node.returns != null ? (node.returns*100).toFixed(2) + "%" : "—";
    $("metric-returns").setAttribute("data-tone", tone(node.returns));
    $("metric-drawdown").textContent = node.drawdown != null ? (node.drawdown*100).toFixed(2) + "%" : "—";
    $("metric-ls").textContent = `${node.longCount ?? "—"} / ${node.shortCount ?? "—"}`;

    $("detail-expr").textContent = node.expr || "—";
    $("detail-alpha-id").textContent = node.alpha_id || "—";

    // neighbors
    const list = $("neighbor-list");
    list.innerHTML = "";
    const neighbors = Atlas.data.neighborsOf(id).slice(0, 10);
    if (!neighbors.length) {
      list.innerHTML = `<li style="padding:8px 0; color:var(--text-mute); font-size:11px; letter-spacing:0.06em;">— no neighbors —</li>`;
    } else {
      neighbors.forEach((nb, i) => {
        const li = document.createElement("li");
        li.className = "nb";
        li.innerHTML = `
          <span class="nb-num">${String(i + 1).padStart(2, "0")}</span>
          <span class="nb-id">${nb.id}</span>
          <span class="nb-r">${nb.r.toFixed(3)}</span>
        `;
        li.addEventListener("click", () => open(nb.id));
        list.appendChild(li);
      });
    }

    // pnl chart (lazy load)
    const canvas = document.getElementById("pnl-chart");
    const wrap = canvas.parentElement;
    const series = await Atlas.data.pnl(id);
    if (series && series.length) {
      wrap.setAttribute("data-empty", "0");
      requestAnimationFrame(() => drawPnl(canvas, series));
    } else {
      wrap.setAttribute("data-empty", "1");
      const ctx = canvas.getContext("2d"); ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    if (Atlas.graph) Atlas.graph.select(id);
  }

  function close() {
    document.getElementById("app").removeAttribute("data-detail-open");
    if (Atlas.graph) Atlas.graph.select(null);
    window.dispatchEvent(new Event("resize"));
  }

  Atlas.detail = {
    init() {
      const btn = document.getElementById("detail-close");
      if (btn) btn.addEventListener("click", close);
    },
    open, close,
  };
})();
