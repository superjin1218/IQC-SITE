/* IQC ATLAS — Map view (canvas-rendered UMAP scatter) */
(function () {
  const Atlas = (window.Atlas = window.Atlas || {});
  let canvas, ctx, pts = [], dsColor, dpr = 1;
  let view = { x: 0, y: 0, scale: 1 };
  let isDragging = false, dragStart = null;
  let hover = null;

  function fit() {
    const wrap = canvas.parentElement;
    dpr = window.devicePixelRatio || 1;
    canvas.width = wrap.clientWidth * dpr;
    canvas.height = wrap.clientHeight * dpr;
    canvas.style.width = wrap.clientWidth + "px";
    canvas.style.height = wrap.clientHeight + "px";
    fitView();
    draw();
  }

  function fitView() {
    if (!pts.length) return;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    }
    const pad = 40;
    const w = canvas.width - pad * 2, h = canvas.height - pad * 2;
    const sx = w / (maxX - minX), sy = h / (maxY - minY);
    view.scale = Math.min(sx, sy);
    view.x = pad - minX * view.scale + (w - (maxX - minX) * view.scale) / 2;
    view.y = pad - minY * view.scale + (h - (maxY - minY) * view.scale) / 2;
  }

  function toScreen(p) {
    return { sx: p.x * view.scale + view.x, sy: p.y * view.scale + view.y };
  }

  function draw() {
    if (!ctx) return;
    ctx.fillStyle = "#0a0d12";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // subtle grid
    ctx.strokeStyle = "rgba(28, 34, 48, 0.6)";
    ctx.lineWidth = 1;
    const grid = 60 * dpr;
    for (let x = view.x % grid; x < canvas.width; x += grid) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = view.y % grid; y < canvas.height; y += grid) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    // points
    for (const p of pts) {
      const node = Atlas.data.byId(p.id);
      if (!node || !Atlas.search.passes(node)) continue;
      const { sx, sy } = toScreen(p);
      if (sx < -10 || sy < -10 || sx > canvas.width + 10 || sy > canvas.height + 10) continue;
      const r = (Math.max(1.5, 1.5 + Math.log10(1 + Math.abs(node.sharpe || 0) * 4))) * dpr;
      ctx.fillStyle = dsColor.get(node.dataset) || "#c89455";
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (hover) {
      const { sx, sy } = toScreen(hover);
      ctx.strokeStyle = "#e6a86b";
      ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath();
      ctx.arc(sx, sy, 9 * dpr, 0, Math.PI * 2);
      ctx.stroke();

      // label
      const node = Atlas.data.byId(hover.id);
      if (node) {
        ctx.font = `${11 * dpr}px JetBrains Mono`;
        ctx.fillStyle = "#ebe3cf";
        ctx.fillText(node.id, sx + 14 * dpr, sy + 4 * dpr);
      }
    }
  }

  function hitTest(mx, my) {
    let best = null, bestD = 12 * dpr;
    for (const p of pts) {
      const node = Atlas.data.byId(p.id);
      if (!node || !Atlas.search.passes(node)) continue;
      const { sx, sy } = toScreen(p);
      const d = Math.hypot(sx - mx, sy - my);
      if (d < bestD) { bestD = d; best = p; }
    }
    return best;
  }

  function onMouse(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) * dpr;
    const my = (e.clientY - rect.top) * dpr;
    if (isDragging) {
      view.x += (e.clientX - dragStart.x) * dpr;
      view.y += (e.clientY - dragStart.y) * dpr;
      dragStart = { x: e.clientX, y: e.clientY };
      draw();
      return;
    }
    const hit = hitTest(mx, my);
    if (hit !== hover) {
      hover = hit;
      const hud = document.getElementById("map-hud");
      if (hit) {
        const n = Atlas.data.byId(hit.id);
        hud.textContent = `${n.id}  ·  ${n.dataset}  ·  sharpe ${(n.sharpe || 0).toFixed(2)}`;
      } else {
        hud.textContent = "UMAP n=30 · 1 − |PnL corr|";
      }
      draw();
    }
  }

  Atlas.map = Atlas.umap = {
    init() {
      canvas = document.getElementById("map-canvas");
      ctx = canvas.getContext("2d");
      const data = Atlas.data.get();
      pts = data.umap.map((u) => ({ id: u.id, x: u.x, y: u.y }));
      dsColor = new Map(data.datasets.map((d) => [d.id, d.color]));
      fit();
      window.addEventListener("resize", fit);
      canvas.addEventListener("mousedown", (e) => { isDragging = true; dragStart = { x: e.clientX, y: e.clientY }; });
      window.addEventListener("mouseup", () => { isDragging = false; });
      canvas.addEventListener("mousemove", onMouse);
      canvas.addEventListener("wheel", (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) * dpr;
        const my = (e.clientY - rect.top) * dpr;
        const factor = e.deltaY < 0 ? 1.12 : 0.89;
        const newScale = Math.max(0.05, Math.min(20, view.scale * factor));
        const wx = (mx - view.x) / view.scale;
        const wy = (my - view.y) / view.scale;
        view.scale = newScale;
        view.x = mx - wx * view.scale;
        view.y = my - wy * view.scale;
        draw();
      }, { passive: false });
      canvas.addEventListener("click", (e) => {
        const rect = canvas.getBoundingClientRect();
        const hit = hitTest((e.clientX - rect.left) * dpr, (e.clientY - rect.top) * dpr);
        if (hit) Atlas.detail.open(hit.id);
      });
    },
    redraw: draw,
    applyFilters: draw,
  };
})();
