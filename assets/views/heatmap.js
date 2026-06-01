/* IQC · FIELD ATLAS — Heatmap (yellow gradient on near-black) */
(function () {
  const Atlas = (window.Atlas = window.Atlas || {});
  let canvas, ctx, dpr = 1;
  let mode = "cluster";

  function fit() {
    const wrap = canvas.parentElement;
    dpr = window.devicePixelRatio || 1;
    canvas.width = wrap.clientWidth * dpr;
    canvas.height = wrap.clientHeight * dpr;
    canvas.style.width = wrap.clientWidth + "px";
    canvas.style.height = wrap.clientHeight + "px";
    draw();
  }

  /* yellow gradient: 0 → black; 1 → bright yellow #ffd600 */
  function colorFor(v) {
    const a = Math.min(1, Math.abs(v));
    return `rgba(255, 214, 0, ${0.04 + 0.96 * a})`;
  }

  function draw() {
    if (!ctx) return;
    const { groups } = Atlas.data.get();
    const heatmap = (groups && groups.cluster_heatmap) || null;
    ctx.fillStyle = "#0a0a0a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (mode === "cluster" && heatmap && heatmap.matrix) {
      const M = heatmap.matrix;
      const labels = heatmap.labels;
      const n = M.length;
      const PAD = 56 * dpr, RIGHT_PAD = 18 * dpr;
      const w = canvas.width - PAD - RIGHT_PAD;
      const h = canvas.height - PAD - PAD;
      const cell = Math.min(w/n, h/n);
      const x0 = PAD;
      const y0 = PAD;

      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const v = M[i][j];
          ctx.fillStyle = colorFor(v);
          ctx.fillRect(x0 + j*cell, y0 + i*cell, cell, cell);
        }
      }
      ctx.strokeStyle = "rgba(42, 42, 42, 0.5)";
      ctx.lineWidth = 1;
      for (let i = 0; i <= n; i++) {
        ctx.beginPath(); ctx.moveTo(x0, y0+i*cell); ctx.lineTo(x0+n*cell, y0+i*cell); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x0+i*cell, y0); ctx.lineTo(x0+i*cell, y0+n*cell); ctx.stroke();
      }

      ctx.fillStyle = "#6b6b6b";
      ctx.font = `500 ${10*dpr}px JetBrains Mono`;
      for (let i = 0; i < n; i++) {
        const lab = labels[i] ?? `C${i}`;
        ctx.save();
        ctx.translate(x0 + i*cell + cell*0.5, y0 - 8*dpr);
        ctx.rotate(-Math.PI/4);
        ctx.fillText(lab, 0, 0);
        ctx.restore();
        ctx.fillText(lab, x0 - 32*dpr, y0 + i*cell + cell*0.65);
      }

      ctx.fillStyle = "#f0f0f0";
      ctx.font = `500 ${12*dpr}px JetBrains Mono`;
      ctx.fillText("CLUSTER × CLUSTER  ·  mean |r|", x0, y0 - 24*dpr);
    } else {
      ctx.fillStyle = "#6b6b6b";
      ctx.font = `500 ${12*dpr}px JetBrains Mono`;
      ctx.textAlign = "center";
      ctx.fillText("Subset matrix — search-filter ≤500 fields to render.",
        canvas.width/2, canvas.height/2);
      ctx.textAlign = "start";
    }
  }

  Atlas.heatmap = {
    init() {
      canvas = document.getElementById("heatmap-canvas");
      ctx = canvas.getContext("2d");
      fit();
      window.addEventListener("resize", fit);
      document.querySelectorAll('[data-heatmap-mode]').forEach((b) => {
        b.addEventListener("click", () => {
          document.querySelectorAll('[data-heatmap-mode]').forEach((x) => x.classList.remove("on"));
          b.classList.add("on");
          mode = b.dataset.heatmapMode;
          draw();
        });
      });
    },
    redraw: draw,
    applyFilters: draw,
  };
})();
