(function() {
  const metaEl = document.getElementById('catalog-meta');
  const bodyEl = document.getElementById('catalog-table-body');
  const headEl = document.getElementById('catalog-table-head');
  const loadingEl = document.getElementById('catalog-loading');
  const errorEl = document.getElementById('catalog-error');
  const wrapEl = document.getElementById('catalog-table-wrap');
  const filterEl = document.getElementById('catalog-filter');
  const countEl = document.getElementById('catalog-count');
  const downloadCurrentEl = document.getElementById('catalog-download-current');
  const downloadAllEl = document.getElementById('catalog-download-all');

  const COLS = [
    {
      key: 'field_id',
      label: 'field',
      cls: 'fid',
      fmt: function(v) {
        const a = document.createElement('a');
        a.href = 'detail.html?fid=' + encodeURIComponent(v);
        a.textContent = v;
        return a;
      },
    },
    {
      key: 'expr',
      label: 'expr',
      cls: 'expr',
      fmt: function(v) {
        const code = document.createElement('code');
        code.className = 'catalog-expr';
        code.textContent = v || '—';
        return code;
      },
    },
    { key: 'sharpe', label: 'sharpe', num: true, fmt: fmtNumber(2) },
    { key: 'fitness', label: 'fitness', num: true, fmt: fmtNumber(2) },
    { key: 'turnover', label: 'turnover', num: true, fmt: fmtNumber(4) },
    { key: 'alpha_count', label: 'α count', num: true, fmt: fmtInteger },
    { key: 'category', label: 'category', cls: 'cat', fmt: fmtText },
    { key: 'subcategory', label: 'subcategory', cls: 'cat', fmt: fmtText },
    { key: 'dataset', label: 'dataset', cls: 'cat', fmt: fmtText },
    { key: 'status', label: 'status', fmt: fmtText },
    {
      key: 'actions',
      label: 'actions',
      sortable: false,
      cls: 'actions',
      fmt: function(_, row) {
        const actions = document.createElement('div');
        actions.className = 'catalog-actions';

        const detail = document.createElement('a');
        detail.className = 'catalog-mini-btn';
        detail.href = 'detail.html?fid=' + encodeURIComponent(row.field_id);
        detail.textContent = 'detail';
        actions.appendChild(detail);

        const copyExpr = document.createElement('button');
        copyExpr.type = 'button';
        copyExpr.className = 'catalog-mini-btn';
        copyExpr.textContent = 'copy expr';
        copyExpr.addEventListener('click', function() {
          navigator.clipboard.writeText(row.expr || '');
          copyExpr.textContent = 'copied';
          setTimeout(function() {
            copyExpr.textContent = 'copy expr';
          }, 1000);
        });
        actions.appendChild(copyExpr);

        return actions;
      },
    },
  ];

  let rows = [];
  let filterQ = '';
  let sortKey = 'fitness';
  let sortDir = -1;
  const BASE_DATA_URL = 'assets/data.json';
  const VEC_AVG_FIELDS = new Set([
    'snt_buzz_bfl',
    'snt_buzz_bfl_fast_d1',
    'snt_buzz_fast_d1',
    'snt_buzz_ret',
    'snt_buzz_ret_fast_d1',
    'snt_social_value',
    'snt_social_volume',
    'snt_value',
    'snt_value_fast_d1',
    'scl12_sentiment',
    'scl12_sentiment_fast_d1',
    'scl12_buzz_fast_d1',
  ]);

  function fmtNumber(decimals) {
    return function(v) {
      return typeof v === 'number' ? v.toFixed(decimals) : '—';
    };
  }

  function fmtInteger(v) {
    return v === null || v === undefined ? '0' : String(v);
  }

  function fmtText(v) {
    return v || '—';
  }

  function csvEscape(v) {
    if (v === null || v === undefined) return '';
    const s = String(v);
    if (/[",\n\r]/.test(s)) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function compareValues(a, b, numeric) {
    if (a === undefined || a === null || a === '') return 1;
    if (b === undefined || b === null || b === '') return -1;
    if (numeric) return a - b;
    return String(a).localeCompare(String(b));
  }

  function getVisibleRows() {
    const filtered = filterQ
      ? rows.filter(function(row) {
          const haystack = [
            row.field_id,
            row.expr,
            row.category,
            row.subcategory,
            row.dataset,
            row.status,
          ].join(' ').toLowerCase();
          return haystack.includes(filterQ);
        })
      : rows.slice();

    const col = COLS.find(function(item) { return item.key === sortKey; });
    const numeric = Boolean(col && col.num);
    return filtered.sort(function(a, b) {
      return compareValues(a[sortKey], b[sortKey], numeric) * sortDir;
    });
  }

  function renderHead() {
    headEl.innerHTML = '';
    const tr = document.createElement('tr');
    COLS.forEach(function(col) {
      const th = document.createElement('th');
      th.textContent = col.label;
      if (col.sortable === false) {
        tr.appendChild(th);
        return;
      }
      if (col.key === sortKey) {
        th.classList.add('sorted');
        const arrow = document.createElement('span');
        arrow.className = 'arrow';
        arrow.textContent = sortDir < 0 ? '▼' : '▲';
        th.appendChild(arrow);
      }
      th.addEventListener('click', function() {
        if (sortKey === col.key) sortDir *= -1;
        else {
          sortKey = col.key;
          sortDir = col.num ? -1 : 1;
        }
        renderHead();
        renderBody();
      });
      tr.appendChild(th);
    });
    headEl.appendChild(tr);
  }

  function renderBody() {
    const visibleRows = getVisibleRows();
    countEl.textContent = visibleRows.length + ' / ' + rows.length + ' rows';
    bodyEl.innerHTML = '';
    const frag = document.createDocumentFragment();

    visibleRows.forEach(function(row) {
      const tr = document.createElement('tr');
      COLS.forEach(function(col) {
        const td = document.createElement('td');
        const rendered = col.fmt(col.key === 'actions' ? null : row[col.key], row);
        if (typeof rendered === 'string') td.textContent = rendered;
        else td.appendChild(rendered);
        if (col.cls) td.classList.add(col.cls);
        if (col.num && typeof row[col.key] === 'number') {
          if (row[col.key] > 0.001) td.classList.add('num-pos');
          else if (row[col.key] < -0.001) td.classList.add('num-neg');
        }
        tr.appendChild(td);
      });
      frag.appendChild(tr);
    });

    bodyEl.appendChild(frag);
  }

  function downloadCsv(filename, sourceRows) {
    const columns = [
      'field_id',
      'expr',
      'sharpe',
      'fitness',
      'turnover',
      'alpha_count',
      'category',
      'subcategory',
      'dataset',
      'status',
    ];
    const lines = [columns.join(',')];
    sourceRows.forEach(function(row) {
      const values = columns.map(function(key) {
        return csvEscape(row[key]);
      });
      lines.push(values.join(','));
    });
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }

  filterEl.addEventListener('input', function() {
    filterQ = filterEl.value.trim().toLowerCase();
    renderBody();
  });

  downloadCurrentEl.addEventListener('click', function() {
    downloadCsv('field_catalog_current.csv', getVisibleRows());
  });

  downloadAllEl.addEventListener('click', function() {
    downloadCsv('field_catalog_all.csv', rows.slice());
  });

  fetch(BASE_DATA_URL)
    .then(function(response) {
      if (!response.ok) throw new Error('base data HTTP ' + response.status);
      return response.json();
    })
    .then(function(baseData) {
      rows = (baseData.fields || []).map(function(row) {
        return {
          field_id: row.field_id,
          expr: buildExpr(row.field_id),
          sharpe: toNumber(row.sharpe),
          fitness: toNumber(row.fitness),
          turnover: toNumber(row.turnover),
          alpha_count: toNumber(row.alpha_count),
          category: row.category || '',
          subcategory: row.subcategory || '',
          dataset: row.dataset || '',
          status: row.status || '',
        };
      });

      const metaParts = [
        ['fields', baseData.n_fields_total || rows.length],
        ['simulated', baseData.n_fields_simulated || rows.length],
        ['sortable metrics', 'sharpe / fitness / turnover'],
        ['csv', 'current + all'],
      ];
      metaEl.innerHTML = '';
      metaParts.forEach(function(item) {
        const span = document.createElement('span');
        const label = document.createElement('span');
        label.className = 'label';
        label.textContent = item[0] + ':';
        const value = document.createElement('span');
        value.className = 'val';
        value.textContent = item[1];
        span.appendChild(label);
        span.appendChild(value);
        metaEl.appendChild(span);
      });

      loadingEl.style.display = 'none';
      wrapEl.style.display = '';
      renderHead();
      renderBody();
    })
    .catch(function(error) {
      loadingEl.style.display = 'none';
      errorEl.textContent = 'failed to load field catalog: ' + error.message;
      errorEl.style.display = 'block';
    });

  function toNumber(value) {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  function buildExpr(fieldId) {
    const inner = 'ts_backfill(' + fieldId + ', 20)';
    return VEC_AVG_FIELDS.has(fieldId) ? 'rank(vec_avg(' + inner + '))' : 'rank(' + inner + ')';
  }
})();
