
(function() {
  const params = new URLSearchParams(location.search);
  const fid = params.get('fid');
  const titleEl = document.getElementById('detail-title');
  const metaEl = document.getElementById('detail-meta');
  const bodyEl = document.getElementById('detail-table-body');
  const headEl = document.getElementById('detail-table-head');
  const loadingEl = document.getElementById('detail-loading');
  const errorEl = document.getElementById('detail-error');
  const tableEl = document.getElementById('detail-table');
  const filterEl = document.getElementById('detail-filter');
  const countEl = document.getElementById('detail-count');

  if (!fid) {
    errorEl.textContent = 'no field_id in URL. use detail.html?fid=...';
    errorEl.style.display = 'block';
    loadingEl.style.display = 'none';
    return;
  }
  titleEl.textContent = fid;
  document.title = fid + ' — Field Detail';

  // 컬럼 정의: [key, label, formatter, class]
  const COLS = [
    { key: 'field_id', label: 'field',      fmt: function(v, row) {
        const a = document.createElement('a');
        a.href = 'detail.html?fid=' + encodeURIComponent(v);
        a.textContent = v;
        return a;
      }, cls: 'fid' },
    { key: 'combined', label: 'combined',   fmt: function(v) { return v.toFixed(4); }, num: true },
    { key: 'pnl',      label: 'pnl corr',   fmt: function(v) { return v.toFixed(4); }, num: true },
    { key: 'text',     label: 'text sim',   fmt: function(v) { return v.toFixed(4); }, num: true },
    { key: 'fitness',  label: 'fitness',    fmt: function(v) { return (v || 0).toFixed(2); }, num: true },
    { key: 'sharpe',   label: 'sharpe',     fmt: function(v) { return (v || 0).toFixed(2); }, num: true },
    { key: 'turnover', label: 'turnover',   fmt: function(v) { return (v || 0).toFixed(3); }, num: true },
    { key: 'category', label: 'category',   fmt: function(v) { return v || '—'; }, cls: 'cat' },
    { key: 'subcategory', label: 'subcategory', fmt: function(v) { return v || '—'; }, cls: 'cat' },
    { key: 'alpha_count', label: 'α count', fmt: function(v) { return String(v || 0); }, num: true },
  ];

  let rows = [];
  let sortKey = 'combined';
  let sortDir = -1;  // -1 desc, 1 asc
  let filterQ = '';

  function renderHead() {
    headEl.innerHTML = '';
    const tr = document.createElement('tr');
    COLS.forEach(function(c) {
      const th = document.createElement('th');
      th.textContent = c.label;
      if (c.key === sortKey) {
        th.classList.add('sorted');
        const arrow = document.createElement('span');
        arrow.className = 'arrow';
        arrow.textContent = sortDir < 0 ? '▼' : '▲';
        th.appendChild(arrow);
      }
      th.addEventListener('click', function() {
        if (sortKey === c.key) sortDir *= -1;
        else { sortKey = c.key; sortDir = c.num ? -1 : 1; }
        renderHead();
        renderBody();
      });
      tr.appendChild(th);
    });
    headEl.appendChild(tr);
  }

  function renderBody() {
    const filtered = filterQ
      ? rows.filter(function(r) {
          return (r.field_id || '').toLowerCase().includes(filterQ) ||
                 (r.category || '').toLowerCase().includes(filterQ) ||
                 (r.subcategory || '').toLowerCase().includes(filterQ);
        })
      : rows;

    const sorted = filtered.slice().sort(function(a, b) {
      const va = a[sortKey], vb = b[sortKey];
      if (va === undefined || va === null) return 1;
      if (vb === undefined || vb === null) return -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * sortDir;
      return String(va).localeCompare(String(vb)) * sortDir;
    });

    countEl.textContent = sorted.length + ' / ' + rows.length + ' rows';
    bodyEl.innerHTML = '';
    const frag = document.createDocumentFragment();
    sorted.forEach(function(r) {
      const tr = document.createElement('tr');
      COLS.forEach(function(c) {
        const td = document.createElement('td');
        const v = r[c.key];
        const out = c.fmt(v, r);
        if (typeof out === 'string') td.textContent = out;
        else td.appendChild(out);
        if (c.cls) td.classList.add(c.cls);
        if (c.num && typeof v === 'number') {
          if (v > 0.001) td.classList.add('num-pos');
          else if (v < -0.001) td.classList.add('num-neg');
        }
        tr.appendChild(td);
      });
      frag.appendChild(tr);
    });
    bodyEl.appendChild(frag);
  }

  filterEl.addEventListener('input', function() {
    filterQ = filterEl.value.trim().toLowerCase();
    renderBody();
  });

  // fetch neighbor data
  fetch('assets/neighbors/' + encodeURIComponent(fid) + '.json')
    .then(function(r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function(data) {
      loadingEl.style.display = 'none';
      tableEl.style.display = '';
      const self = data.self || {};
      const metaParts = [
        ['category', self.category || '—'],
        ['subcategory', self.subcategory || '—'],
        ['dataset', self.dataset || '—'],
        ['fitness', self.fitness !== undefined ? Number(self.fitness).toFixed(3) : '—'],
        ['sharpe', self.sharpe !== undefined ? Number(self.sharpe).toFixed(3) : '—'],
        ['turnover', self.turnover !== undefined ? Number(self.turnover).toFixed(4) : '—'],
        ['α count', self.alpha_count || 0],
        ['neighbors', (data.rows || []).length],
      ];
      metaEl.innerHTML = '';
      metaParts.forEach(function(p) {
        const span = document.createElement('span');
        const l = document.createElement('span');
        l.className = 'label'; l.textContent = p[0] + ':';
        const v = document.createElement('span');
        v.className = 'val'; v.textContent = p[1];
        span.appendChild(l); span.appendChild(v);
        metaEl.appendChild(span);
      });

      rows = (data.rows || []).map(function(row) {
        return {
          field_id: row[0],
          combined: row[1],
          pnl: row[2],
          text: row[3],
          sharpe: row[4],
          fitness: row[5],
          turnover: row[6],
          category: row[7],
          subcategory: row[8],
          alpha_count: row[9],
        };
      });
      renderHead();
      renderBody();
    })
    .catch(function(e) {
      loadingEl.style.display = 'none';
      errorEl.textContent = 'failed to load neighbors: ' + e.message;
      errorEl.style.display = 'block';
    });
})();
