/* IQC ATLAS — search & filter
   minisearch index over field id + description + dataset + subcategory
*/
(function () {
  const Atlas = (window.Atlas = window.Atlas || {});

  let mini = null;
  const state = {
    types: new Set(["MATRIX", "VECTOR"]),
    sharpeMin: -3,
    corrMin: 0.35,
    datasets: new Set(),       // empty = all
  };

  function buildIndex(nodes) {
    mini = new MiniSearch({
      fields: ["id", "desc", "dataset", "subcategory"],
      storeFields: ["id", "dataset", "type", "sharpe", "desc"],
      searchOptions: {
        boost: { id: 3, dataset: 1.5 },
        prefix: true,
        fuzzy: 0.15,
      },
    });
    mini.addAll(
      nodes.map((n) => ({
        id: n.id,
        desc: n.desc || "",
        dataset: n.dataset || "",
        subcategory: n.subcategory || "",
        type: n.type || "",
        sharpe: n.sharpe ?? 0,
      }))
    );
  }

  function passes(node) {
    if (!state.types.has(node.type)) return false;
    if ((node.sharpe ?? -99) < state.sharpeMin) return false;
    if (state.datasets.size > 0 && !state.datasets.has(node.dataset)) return false;
    return true;
  }

  Atlas.search = {
    init(nodes) {
      buildIndex(nodes);
    },
    query(q, limit = 24) {
      if (!q || q.trim().length === 0) return [];
      return mini.search(q.trim(), { combineWith: "AND" }).slice(0, limit);
    },
    state,
    passes,
    setType(type, on) {
      if (on) state.types.add(type);
      else state.types.delete(type);
    },
    setSharpeMin(v) {
      state.sharpeMin = +v;
    },
    setCorrMin(v) {
      state.corrMin = +v;
    },
    toggleDataset(name) {
      if (state.datasets.has(name)) state.datasets.delete(name);
      else state.datasets.add(name);
    },
    clearDatasets() {
      state.datasets.clear();
    },
  };
})();
