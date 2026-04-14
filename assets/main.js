
(function() {
  const views = {
    graph:   { file: 'views/graph.html',   kind: 'iframe' },
    map:     { file: 'views/map.html',     kind: 'iframe' },
    heatmap: { file: 'views/heatmap.png',  kind: 'image' },
    groups:  { kind: 'groups' },
  };

  const container = document.getElementById('view-container');
  const viewLinks = document.querySelectorAll('.view-list li');
  let currentIframe = null;
  let pendingHighlight = null;

  function attachPanZoom(wrap, img) {
    let scale = 1, tx = 0, ty = 0;
    let dragging = false, sx = 0, sy = 0, stx = 0, sty = 0;
    const MIN = 0.2, MAX = 20;
    function apply() {
      img.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
    }
    function reset() { scale = 1; tx = 0; ty = 0; apply(); }
    img.addEventListener('load', reset); reset();
    wrap.addEventListener('wheel', function(e) {
      e.preventDefault();
      const rect = wrap.getBoundingClientRect();
      const cx = e.clientX - rect.left - rect.width / 2;
      const cy = e.clientY - rect.top - rect.height / 2;
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.015 : 0.0025));
      const next = Math.min(MAX, Math.max(MIN, scale * factor));
      const k = next / scale;
      tx = cx - (cx - tx) * k;
      ty = cy - (cy - ty) * k;
      scale = next;
      apply();
    }, { passive: false });
    wrap.addEventListener('mousedown', function(e) {
      dragging = true; sx = e.clientX; sy = e.clientY; stx = tx; sty = ty;
      wrap.classList.add('grabbing');
      e.preventDefault();
    });
    window.addEventListener('mousemove', function(e) {
      if (!dragging) return;
      tx = stx + (e.clientX - sx); ty = sty + (e.clientY - sy); apply();
    });
    window.addEventListener('mouseup', function() {
      dragging = false; wrap.classList.remove('grabbing');
    });
    wrap.addEventListener('dblclick', reset);
    // touch
    let pd = 0, ps = 1, pcx = 0, pcy = 0;
    wrap.addEventListener('touchstart', function(e) {
      if (e.touches.length === 2) {
        const a = e.touches[0], b = e.touches[1];
        pd = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        ps = scale;
        const r = wrap.getBoundingClientRect();
        pcx = (a.clientX + b.clientX) / 2 - r.left - r.width / 2;
        pcy = (a.clientY + b.clientY) / 2 - r.top - r.height / 2;
      } else if (e.touches.length === 1) {
        dragging = true; sx = e.touches[0].clientX; sy = e.touches[0].clientY;
        stx = tx; sty = ty;
      }
    }, { passive: false });
    wrap.addEventListener('touchmove', function(e) {
      if (e.touches.length === 2) {
        e.preventDefault();
        const a = e.touches[0], b = e.touches[1];
        const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        const next = Math.min(MAX, Math.max(MIN, ps * (d / pd)));
        const k = next / scale;
        tx = pcx - (pcx - tx) * k;
        ty = pcy - (pcy - ty) * k;
        scale = next;
        apply();
      } else if (e.touches.length === 1 && dragging) {
        e.preventDefault();
        tx = stx + (e.touches[0].clientX - sx);
        ty = sty + (e.touches[0].clientY - sy);
        apply();
      }
    }, { passive: false });
    wrap.addEventListener('touchend', function() { dragging = false; });
  }

  function showView(key) {
    const v = views[key];
    if (!v) return;
    viewLinks.forEach(function(el) {
      el.classList.toggle('active', el.dataset.view === key);
    });
    container.innerHTML = '';
    currentIframe = null;
    if (v.kind === 'iframe') {
      const ifr = document.createElement('iframe');
      ifr.className = 'view-iframe';
      ifr.src = v.file;
      ifr.addEventListener('load', function() {
        if (pendingHighlight) {
          try { ifr.contentWindow.postMessage({ type: 'highlight', field_id: pendingHighlight }, '*'); } catch (e) {}
          pendingHighlight = null;
        }
      });
      container.appendChild(ifr);
      currentIframe = ifr;
    } else if (v.kind === 'image') {
      const wrap = document.createElement('div');
      wrap.className = 'view-image-wrap pan-zoom';
      const img = document.createElement('img');
      img.className = 'view-image';
      img.src = v.file;
      img.alt = key;
      img.draggable = false;
      wrap.appendChild(img);
      container.appendChild(wrap);
      attachPanZoom(wrap, img);
    } else if (v.kind === 'groups') {
      renderGroupsPanel(container);
    }
    history.replaceState({}, '', '#' + key);
  }

  // ============ GROUPS panel ============
  let groupsData = null;
  let groupsThreshold = '0.35';
  let groupsExpanded = null;

  function csvEscape(v) {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (/[",\n\r]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function exportGroupsCSV(threshold, groups, topN) {
    const cols = [
      'threshold', 'group_id', 'group_label', 'group_size', 'rank',
      'field_id', 'fitness', 'sharpe', 'turnover', 'returns', 'drawdown',
      'alpha_count', 'category', 'subcategory', 'dataset', 'alpha_id', 'expr'
    ];
    const lines = [cols.join(',')];
    groups.forEach(function(g) {
      const topMembers = (g.members || []).slice(0, topN);
      topMembers.forEach(function(m, i) {
        const row = [
          threshold, g.id, g.label, g.size, (i + 1),
          m.field_id,
          (m.fitness || 0).toFixed(4),
          (m.sharpe || 0).toFixed(4),
          (m.turnover || 0).toFixed(5),
          (m.returns || 0).toFixed(5),
          (m.drawdown || 0).toFixed(4),
          m.alpha_count || 0,
          m.category || '',
          m.subcategory || '',
          m.dataset || '',
          m.alpha_id || '',
          m.expr || ''
        ].map(csvEscape);
        lines.push(row.join(','));
      });
    });
    // UTF-8 BOM → Excel 한글 깨짐 방지
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'field_groups_thr' + threshold + '_top' + topN + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  function renderGroupsPanel(container) {
    const panel = document.createElement('div');
    panel.className = 'groups-panel';
    panel.innerHTML = '<div class="groups-loading">loading groups...</div>';
    container.appendChild(panel);

    const render = function() {
      panel.innerHTML = '';
      if (!groupsData) {
        panel.innerHTML = '<div class="groups-loading">no data</div>';
        return;
      }

      // header
      const header = document.createElement('div');
      header.className = 'groups-header';
      const title = document.createElement('div');
      title.className = 'groups-title';
      title.textContent = 'GROUPS';
      header.appendChild(title);

      const explain = document.createElement('div');
      explain.className = 'groups-explain';
      explain.textContent = 'pick minimum combined correlation — lower = fewer / larger groups, higher = more / tighter groups';
      header.appendChild(explain);

      // export CSV
      const exportBar = document.createElement('div');
      exportBar.className = 'groups-export';
      exportBar.innerHTML =
        '<span class="ex-label">export top</span>' +
        '<input type="number" id="grp-topn" class="ex-input" value="1" min="1" max="50" step="1">' +
        '<span class="ex-label">/ group (current threshold)</span>' +
        '<button class="ex-btn" id="grp-export">⬇ download CSV</button>';
      header.appendChild(exportBar);

      // threshold tabs
      const tabs = document.createElement('div');
      tabs.className = 'groups-tabs';
      const thresholds = Object.keys(groupsData).sort();
      thresholds.forEach(function(t) {
        const btn = document.createElement('button');
        btn.className = 'groups-tab' + (t === groupsThreshold ? ' active' : '');
        const count = groupsData[t].length;
        btn.innerHTML = '<span class="t">≥ ' + t + '</span><span class="c">' + count + ' groups</span>';
        btn.addEventListener('click', function() {
          groupsThreshold = t;
          groupsExpanded = null;
          render();
        });
        tabs.appendChild(btn);
      });
      header.appendChild(tabs);
      panel.appendChild(header);

      // group list
      const list = document.createElement('div');
      list.className = 'groups-list';
      const groups = groupsData[groupsThreshold] || [];
      groups.forEach(function(g) {
        const row = document.createElement('div');
        row.className = 'group-row' + (groupsExpanded === g.id ? ' expanded' : '');

        const head = document.createElement('div');
        head.className = 'group-head';
        head.addEventListener('click', function() {
          groupsExpanded = (groupsExpanded === g.id) ? null : g.id;
          render();
        });

        const arrow = document.createElement('span');
        arrow.className = 'group-arrow';
        arrow.textContent = groupsExpanded === g.id ? '▼' : '▶';

        const label = document.createElement('span');
        label.className = 'group-label';
        label.textContent = g.label || '—';

        const size = document.createElement('span');
        size.className = 'group-size';
        size.textContent = g.size + ' fields';

        const fit = document.createElement('span');
        fit.className = 'group-fit';
        fit.innerHTML = '<em>max fit </em>' + g.max_fitness.toFixed(2) +
                        '  <em>avg </em>' + g.avg_fitness.toFixed(2);

        head.appendChild(arrow);
        head.appendChild(label);
        head.appendChild(size);
        head.appendChild(fit);
        row.appendChild(head);

        if (groupsExpanded === g.id) {
          const body = document.createElement('div');
          body.className = 'group-body';

          // mini table (이미 fitness desc 로 정렬되어 있음)
          const tbl = document.createElement('table');
          tbl.className = 'group-members';
          tbl.innerHTML = '<thead><tr>' +
            '<th>field</th>' +
            '<th class="n">fitness</th>' +
            '<th class="n">sharpe</th>' +
            '<th class="n">turnover</th>' +
            '<th class="n">α</th>' +
            '<th>category</th>' +
            '<th>subcategory</th>' +
            '<th></th>' +
            '</tr></thead>';
          const tb = document.createElement('tbody');
          g.members.forEach(function(m) {
            const tr = document.createElement('tr');

            const tdF = document.createElement('td');
            tdF.className = 'fid';
            const a = document.createElement('a');
            a.href = 'detail.html?fid=' + encodeURIComponent(m.field_id);
            a.target = '_blank';
            a.textContent = m.field_id;
            tdF.appendChild(a);
            tr.appendChild(tdF);

            function numCell(v, dec, goodGt) {
              const td = document.createElement('td');
              td.className = 'n';
              td.textContent = (v || 0).toFixed(dec);
              if (goodGt !== undefined && v >= goodGt) td.classList.add('num-pos');
              return td;
            }
            tr.appendChild(numCell(m.fitness, 2, 1.0));
            tr.appendChild(numCell(m.sharpe, 2, 1.25));
            tr.appendChild(numCell(m.turnover, 3));

            const tdA = document.createElement('td');
            tdA.className = 'n';
            tdA.textContent = m.alpha_count || 0;
            tr.appendChild(tdA);

            const tdC = document.createElement('td');
            tdC.className = 'sub';
            tdC.textContent = m.category || '—';
            tr.appendChild(tdC);

            const tdS = document.createElement('td');
            tdS.className = 'sub';
            tdS.textContent = m.subcategory || '—';
            tr.appendChild(tdS);

            const tdAct = document.createElement('td');
            tdAct.className = 'act';
            const act = document.createElement('a');
            act.className = 'mini-btn';
            act.textContent = 'focus';
            act.addEventListener('click', function(ev) {
              ev.preventDefault();
              highlightOnCurrent(m.field_id);
            });
            tdAct.appendChild(act);
            tr.appendChild(tdAct);

            tb.appendChild(tr);
          });
          tbl.appendChild(tb);
          body.appendChild(tbl);
          row.appendChild(body);
        }

        list.appendChild(row);
      });
      panel.appendChild(list);

      // export CSV handler
      const exportBtn = panel.querySelector('#grp-export');
      const topnInput = panel.querySelector('#grp-topn');
      if (exportBtn) {
        exportBtn.addEventListener('click', function() {
          const n = Math.max(1, parseInt(topnInput.value || '1', 10));
          exportGroupsCSV(groupsThreshold, groupsData[groupsThreshold] || [], n);
        });
      }
    };

    if (groupsData) {
      render();
    } else {
      fetch('assets/groups.json')
        .then(function(r) { return r.json(); })
        .then(function(d) {
          groupsData = d;
          if (groupsData && !groupsData[groupsThreshold]) {
            groupsThreshold = Object.keys(groupsData).sort()[0];
          }
          render();
        })
        .catch(function(e) {
          panel.innerHTML = '<div class="groups-loading">failed: ' + e.message + '</div>';
        });
    }
  }

  function currentKey() {
    return (location.hash || '#graph').slice(1);
  }

  function highlightOnCurrent(fid) {
    const key = currentKey();
    if (views[key] && views[key].kind === 'iframe' && currentIframe) {
      try {
        currentIframe.contentWindow.postMessage({ type: 'highlight', field_id: fid }, '*');
      } catch (e) {}
    } else {
      // heatmap 활성 상태 → graph 로 스위칭 후 반영
      pendingHighlight = fid;
      showView('graph');
    }
  }

  viewLinks.forEach(function(el) {
    el.addEventListener('click', function() { showView(el.dataset.view); });
  });

  const initial = currentKey();
  showView(views[initial] ? initial : 'graph');

  fetch('assets/data.json')
    .then(function(r) { return r.json(); })
    .then(function(data) {
      window.FIELD_DATA = data;
      const input = document.getElementById('search-input');
      const results = document.getElementById('search-results');

      function render(matches) {
        results.innerHTML = '';
        if (!matches.length) {
          const e = document.createElement('div');
          e.className = 'search-empty';
          e.textContent = 'no match';
          results.appendChild(e);
          return;
        }
        matches.forEach(function(m) {
          const div = document.createElement('div');
          div.className = 'search-result';
          div.dataset.fid = m.field_id;

          const idLine = document.createElement('div');
          idLine.className = 'sr-id';
          idLine.textContent = m.field_id;
          div.appendChild(idLine);

          const meta = document.createElement('div');
          meta.className = 'sr-meta';
          const cat = document.createElement('span');
          cat.className = 'cat';
          cat.textContent = (m.category || '—') + (m.subcategory ? ' / ' + m.subcategory : '');
          const num = document.createElement('span');
          num.className = 'num';
          const parts = [];
          if (m.alpha_count) parts.push(m.alpha_count + 'α');
          num.textContent = parts.join(' · ');
          meta.appendChild(cat); meta.appendChild(num);
          div.appendChild(meta);

          const stats = document.createElement('div');
          stats.className = 'sr-stats';
          function stat(label, val, cls) {
            const s = document.createElement('span');
            s.className = 'sr-stat' + (cls ? ' ' + cls : '');
            s.innerHTML = '<em>' + label + '</em>' + val;
            return s;
          }
          const sh = m.sharpe !== undefined ? Number(m.sharpe).toFixed(2) : '—';
          const fi = m.fitness !== undefined ? Number(m.fitness).toFixed(2) : '—';
          const to = m.turnover !== undefined ? Number(m.turnover).toFixed(3) : '—';
          stats.appendChild(stat('sh ', sh, Number(m.sharpe) >= 1.25 ? 'good' : ''));
          stats.appendChild(stat('fit ', fi, Number(m.fitness) >= 1.0 ? 'good' : ''));
          stats.appendChild(stat('to ', to, ''));
          div.appendChild(stats);

          const actions = document.createElement('div');
          actions.className = 'sr-actions';
          const focusBtn = document.createElement('a');
          focusBtn.textContent = 'focus';
          focusBtn.addEventListener('click', function(ev) {
            ev.stopPropagation();
            highlightOnCurrent(m.field_id);
          });
          const detailBtn = document.createElement('a');
          detailBtn.textContent = '자세히 보기';
          detailBtn.href = 'detail.html?fid=' + encodeURIComponent(m.field_id);
          detailBtn.target = '_blank';
          detailBtn.rel = 'noopener';
          const copyBtn = document.createElement('a');
          copyBtn.textContent = 'copy';
          copyBtn.addEventListener('click', function(ev) {
            ev.stopPropagation();
            navigator.clipboard.writeText(m.field_id);
            copyBtn.textContent = '✓';
            setTimeout(function() { copyBtn.textContent = 'copy'; }, 1000);
          });
          actions.appendChild(focusBtn);
          actions.appendChild(detailBtn);
          actions.appendChild(copyBtn);
          div.appendChild(actions);

          div.addEventListener('click', function() { highlightOnCurrent(m.field_id); });
          results.appendChild(div);
        });
      }

      function score(f, q) {
        const fid = (f.field_id || '').toLowerCase();
        const sub = (f.subcategory || '').toLowerCase();
        const dset = (f.dataset || '').toLowerCase();
        const cat = (f.category || '').toLowerCase();
        if (fid === q) return 100;
        if (fid.startsWith(q)) return 80;
        if (fid.includes(q)) return 60;
        if (sub.includes(q)) return 40;
        if (dset.includes(q)) return 30;
        if (cat.includes(q)) return 20;
        return 0;
      }

      input.addEventListener('input', function() {
        const q = input.value.trim().toLowerCase();
        if (q.length < 2) { results.innerHTML = ''; return; }
        const scored = (data.fields || [])
          .map(function(f) { return { f: f, s: score(f, q) }; })
          .filter(function(x) { return x.s > 0; })
          .sort(function(a, b) { return b.s - a.s || b.f.alpha_count - a.f.alpha_count; })
          .slice(0, 30)
          .map(function(x) { return x.f; });
        render(scored);
      });
    })
    .catch(function() {});
})();
