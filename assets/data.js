/* IQC ATLAS — data loader
   pre-built JSON in assets/data/*.json + lazy per-field PnL in assets/data/pnl/{id}.json
*/
(function () {
  const Atlas = (window.Atlas = window.Atlas || {});

  const BASE = "assets/data";
  const cache = { nodes: null, edges: null, umap: null, groups: null, datasets: null, neighbors: null, pnl: new Map() };

  async function _fetch(path) {
    const r = await fetch(path, { cache: "force-cache" });
    if (!r.ok) throw new Error(`load ${path} → ${r.status}`);
    return r.json();
  }

  Atlas.data = {
    async load() {
      const [nodes, edges, umap, groups, datasets, neighbors] = await Promise.all([
        _fetch(`${BASE}/nodes.json`),
        _fetch(`${BASE}/edges.json`),
        _fetch(`${BASE}/umap.json`),
        _fetch(`${BASE}/groups.json`),
        _fetch(`${BASE}/datasets.json`),
        _fetch(`${BASE}/neighbors.json`).catch(() => ({})),
      ]);
      cache.nodes = nodes;
      cache.edges = edges;
      cache.umap = umap;
      cache.groups = groups;
      cache.datasets = datasets;
      cache.neighbors = neighbors;
      // build by-id lookup
      cache.byId = new Map(nodes.map((n) => [n.id, n]));
      return cache;
    },
    get() {
      return cache;
    },
    byId(id) {
      return cache.byId && cache.byId.get(id);
    },
    async pnl(id) {
      if (cache.pnl.has(id)) return cache.pnl.get(id);
      try {
        const d = await _fetch(`${BASE}/pnl/${encodeURIComponent(id)}.json`);
        cache.pnl.set(id, d);
        return d;
      } catch (e) {
        cache.pnl.set(id, null);
        return null;
      }
    },
    neighborsOf(id) {
      const n = cache.neighbors && cache.neighbors[id];
      return n || [];
    },
  };
})();
