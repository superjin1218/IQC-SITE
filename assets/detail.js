/* IQC ATLAS — Detail panel + PnL sparkline */
(function () {
  const Atlas = (window.Atlas = window.Atlas || {});

  const els = {};
  function $(id) { return (els[id] = els[id] || document.getElementById(id)); }

  function fmt(v, digits = 2) {
    if (v === null || v === undefined || isNaN(v)) return "—";
    return Number(v).toFixed(digits);
  }
  function signedTone(v) { return v > 0 ? "pos" : v < 0 ? "neg" : ""; }

  function drawPnlChart(canvas, points) {
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
    const W2 = W - pad * 2, H2 = H - pad * 2;

    if (min < 0 && max > 0) {
      const zy = pad + H2 * (max / (max - min));
      ctx.strokeStyle = "rgba(122, 117, 99, 0.4)";
      ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(pad, zy); ctx.lineTo(W - pad, zy); ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.beginPath();
    series.forEach((s, i) => {
      const x = pad + (i / (series.length - 1)) * W2;
      const y = pad + H2 - ((s.c - min) / (max - min || 1)) * H2;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#c89455";
    ctx.lineWidth = 1.4;
    ctx.stroke();

    ctx.lineTo(W - pad, H - pad);
    ctx.lineTo(pad, H - pad);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, pad, 0, H - pad);
    grad.addColorStop(0, "rgba(200, 148, 85, 0.22)");
    grad.addColorStop(1, "rgba(200, 148, 85, 0.0)");
    ctx.fillStyle = grad;
    ctx.fill();

    const last = series[series.length - 1];
    const lx = pad + W2;
    const ly = pad + H2 - ((last.c - min) / (max - min || 1)) * H2;
    ctx.fillStyle = "#e6a86b";
    ctx.beginPath(); ctx.arc(lx, ly, 2.5, 0, Math.PI * 2); ctx.fill();
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
    $("metric-sharpe").setAttribute("data-tone", signedTone(node.sharpe));
    $("metric-fitness").textContent = fmt(node.fitness);
    $("metric-fitness").setAttribute("data-tone", signedTone(node.fitness));
    $("metric-turnover").textContent = node.turnover != null ? (node.turnover * 100).toFixed(1) + "%" : "—";
    $("metric-returns").textContent = node.returns != null ? (node.returns * 100).toFixed(2) + "%" : "—";
    $("metric-returns").setAttribute("data-tone", signedTone(node.returns));
    $("metric-drawdown").textContent = node.drawdown != null ? (node.drawdown * 100).toFixed(2) + "%" : "—";
    $("metric-ls").textContent = `${node.longCount ?? "—"} / ${node.shortCount ?? "—"}`;

    $("detail-expr").textContent = node.expr || "—";
    $("detail-alpha-id").textContent = node.alpha_id || "—";

    const nbList = $("neighbor-list");
    nbList.innerHTML = "";
    const neighbors = Atlas.data.neighborsOf(id).slice(0, 10);
    if (!neighbors.length) {
      nbList.innerHTML = `<li style="color:var(--ink-faint); font-family:Fraunces; font-style:italic; padding:6px 0;">— no constellation —</li>`;
    } else {
      neighbors.forEach((nb, i) => {
        const li = document.createElement("li");
        li.className = "neighbor";
        li.innerHTML = `
          <span class="neighbor-num">${String(i + 1).padStart(2, "0")}</span>
          <span class="neighbor-id">${nb.id}</span>
          <span class="neighbor-corr">${nb.r.toFixed(3)}</span>
        `;
        li.addEventListener("click", () => open(nb.id));
        nbList.appendChild(li);
      });
    }

    const canvas = document.getElementById("pnl-chart");
    const wrap = canvas.parentElement;
    const series = await Atlas.data.pnl(id);
    if (series && series.length) {
      wrap.setAttribute("data-empty", "0");
      requestAnimationFrame(() => drawPnlChart(canvas, series));
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
      const closeBtn = document.getElementById("detail-close");
      if (closeBtn) closeBtn.addEventListener("click", close);
    },
    open, close,
  };
})();
