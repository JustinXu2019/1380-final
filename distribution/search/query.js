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
          agg[p.docId] = (agg[p.docId] || 0) + p.score;
        });
      }
      if (--pending === 0) {
        const top = Object.entries(agg)
            .map(([docId, score]) => ({docId, score}))
            .sort((a, b) => b.score - a.score)
            .slice(0, topK || 10);
        if (top.length === 0) return cb(null, []);

        let resolved = 0;
        const results = new Array(top.length);
        top.forEach((r, i) => {
          d[gid].store.get('url_' + r.docId, (err, url) => {
            results[i] = err ? null : {url, score: r.score};
            if (++resolved === top.length) {
              cb(null, results.filter((x) => x && x.url));
            }
          });
        });
      }
    });
  });
}

module.exports = {run};
