/* IQC ATLAS — Heatmap (cluster-mean by default; subset on toggle) */
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

  function colorFor(v) {
    // copper for positive, rust for negative, dim in middle
    const a = Math.abs(v);
    if (v >= 0) return `rgba(230, 168, 107, ${0.06 + 0.94 * a})`;
    return `rgba(184, 85, 58, ${0.06 + 0.94 * a})`;
  }

  function draw() {
    if (!ctx) return;
    const { groups } = Atlas.data.get();
    const heatmap = (groups && groups.cluster_heatmap) || null;
    ctx.fillStyle = "#0a0d12";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (mode === "cluster" && heatmap && heatmap.matrix) {
      const M = heatmap.matrix;
      const labels = heatmap.labels;
      const n = M.length;
      const PAD = 60 * dpr, RIGHT_PAD = 24 * dpr;
      const w = canvas.width - PAD - RIGHT_PAD;
      const h = canvas.height - PAD - PAD;
      const cell = Math.min(w / n, h / n);
      const x0 = PAD;
      const y0 = PAD;

      // cells
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const v = M[i][j];
          ctx.fillStyle = colorFor(v);
          ctx.fillRect(x0 + j * cell, y0 + i * cell, cell, cell);
        }
      }
      // grid
      ctx.strokeStyle = "rgba(28,34,48,0.5)";
      ctx.lineWidth = 1;
      for (let i = 0; i <= n; i++) {
        ctx.beginPath(); ctx.moveTo(x0, y0 + i * cell); ctx.lineTo(x0 + n * cell, y0 + i * cell); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x0 + i * cell, y0); ctx.lineTo(x0 + i * cell, y0 + n * cell); ctx.stroke();
      }

      // axis labels (small caps style — mono)
      ctx.fillStyle = "#7a7563";
      ctx.font = `${10 * dpr}px JetBrains Mono`;
      for (let i = 0; i < n; i++) {
        const lab = labels[i] ?? `C${i}`;
        ctx.save();
        ctx.translate(x0 + i * cell + cell * 0.5, y0 - 8 * dpr);
        ctx.rotate(-Math.PI / 4);
        ctx.fillText(lab, 0, 0);
        ctx.restore();
        ctx.fillText(lab, x0 - 36 * dpr, y0 + i * cell + cell * 0.65);
      }

      // title
      ctx.fillStyle = "#b2ab98";
      ctx.font = `italic ${13 * dpr}px Fraunces`;
      ctx.fillText("Cluster × Cluster · mean |r|", x0, y0 - 28 * dpr);
    } else {
      ctx.fillStyle = "#7a7563";
      ctx.font = `italic ${14 * dpr}px Fraunces`;
      ctx.textAlign = "center";
      ctx.fillText("Select a search subset to render its correlation submatrix.",
                   canvas.width / 2, canvas.height / 2);
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
          document.querySelectorAll('[data-heatmap-mode]').forEach((x) => x.classList.remove("active"));
          b.classList.add("active");
          mode = b.dataset.heatmapMode;
          draw();
        });
      });
    },
    redraw: draw,
    applyFilters: draw,
  };
})();
