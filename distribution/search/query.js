const nlp = require('./nlp.js');

function run(q, topK, gid, cb) {
  if (typeof gid === 'function') { cb = gid; gid = 'search'; }
  const d = globalThis.distribution;
  const terms = nlp.processQuery(q);
  if (terms.length === 0) return cb(null, []);

  const agg = {};
  let pending = terms.length;
  terms.forEach((term) => {
    const termKey = 'tfidf_' + d.util.id.getID(term);
    d[gid].store.get(termKey, (e, postings) => {
      if (!e && Array.isArray(postings)) {
        postings.forEach((p) => {
          agg[p.url] = (agg[p.url] || 0) + p.score;
        });
      }
      if (--pending === 0) {
        const results = Object.entries(agg)
            .map(([url, score]) => ({url, score}))
            .sort((a, b) => b.score - a.score)
            .slice(0, topK || 10);
        cb(null, results);
      }
    });
  });
}

module.exports = {run};