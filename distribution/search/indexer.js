function run(gid, cb) {
  const d = globalThis.distribution;
  const t0 = Date.now();
  const log = (msg) => console.log(`[index ${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`);

  log('gathering urls from nodes...');
  d[gid].comm.send([], {service: 'crawler', method: 'getLocalUrls'}, (errs, vals) => {
    const allUrls = new Set();
    Object.values(vals || {}).forEach((urls) => {
      if (Array.isArray(urls)) urls.forEach((u) => allUrls.add(u));
    });
    const urlList = Array.from(allUrls);
    const keys = urlList.map((u) => 'doc_' + d.util.id.getID(u));
    const N = urlList.length;
    log(`gathered ${N} unique docs across nodes`);
    if (N === 0) return cb(null, {terms: 0, docs: 0});

    const map = function(key, value) {
      const nlp = globalThis.distribution.local.nlp;
      if (!value || !value.text) return [];
      const entries = nlp.processText(value.text);
      const docId = key.substring(4);
      return entries.map((e) => ({[e.ngram]: docId + ':' + e.count}));
    };

    const reduce = eval(`(function(key, values, done) {
      const N = ${N};
      const d = globalThis.distribution;
      const df = values.length;
      if (df >= N) return done({written: 0});
      const idf = Math.log(N / df);
      const scored = values.map(function(p) {
        const i = p.indexOf(':');
        const docId = p.substring(0, i);
        const count = parseInt(p.substring(i + 1), 10);
        const tf = 1 + Math.log(count);
        return {docId: docId, score: tf * idf};
      }).sort(function(a, b) { return b.score - a.score; });
      const termKey = 'tfidf_' + d.util.id.getID(key);
      d.local.store.put(scored, {key: termKey, gid: '${gid}'}, function() {
        done({written: 1});
      });
    })`);

    log(`running mr.exec across ${keys.length} keys...`);
    d[gid].mr.exec({keys, map, reduce}, (err, results) => {
      if (err) return cb(err);
      let written = 0;
      (results || []).forEach((r) => { written += (r && r.written) || 0; });
      log(`done: ${written} terms written`);
      cb(null, {terms: written, docs: N});
    });
  });
}

module.exports = {run};
