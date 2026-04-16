function run(gid, cb) {
  const d = globalThis.distribution;
  const t0 = Date.now();
  const log = (msg) => console.log(`[index ${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`);

  log('loading url list...');
  d[gid].store.get('__all_urls__', (e, urls) => {
    if (e || !urls) return cb(e || new Error('no crawled urls'));
    const urlList = Array.from(new Set(urls));
    const keys = urlList.map((u) => 'doc_' + d.util.id.getID(u));
    const N = urlList.length;
    log(`found ${N} docs`);
    if (N === 0) return cb(null, {terms: 0, docs: 0});

    const shortIdOf = (u) => d.util.id.getID(u).substring(0, 12);
    const urlByShort = {};
    urlList.forEach((u) => { urlByShort[shortIdOf(u)] = u; });

    const map = function(key, value) {
      const nlp = globalThis.distribution.local.nlp;
      if (!value || !value.text) return [];
      const entries = nlp.processText(value.text);
      const shortId = key.substring(4, 16);
      return entries.map((e) => ({[e.ngram]: shortId + ':' + e.count}));
    };

    const reduce = function(key, values) {
      return {[key]: values};
    };

    log(`running mr.exec across ${keys.length} keys...`);
    d[gid].mr.exec({keys, map, reduce}, (err, results) => {
      if (err) return cb(err);
      if (!results || results.length === 0) return cb(null, {terms: 0, docs: N});
      log(`mr done: ${results.length} unique terms; computing tf-idf + storing...`);

      const jobs = [];
      for (const entry of results) {
        const ngram = Object.keys(entry)[0];
        const postings = entry[ngram];
        const df = postings.length;
        if (df >= N) continue; // idf=0, useless term
        const idf = Math.log(N / df);
        const scored = postings
            .map((p) => {
              const i = p.indexOf(':');
              const shortId = p.substring(0, i);
              const count = parseInt(p.substring(i + 1), 10);
              const tf = 1 + Math.log(count);
              return {url: urlByShort[shortId], score: tf * idf};
            })
            .filter((x) => x.url)
            .sort((a, b) => b.score - a.score);
        if (scored.length === 0) continue;
        jobs.push({ngram, scored});
      }
      log(`filtered to ${jobs.length} terms to store`);

      const CONCURRENCY = 32;
      let idx = 0;
      let inflight = 0;
      let written = 0;
      let lastLog = Date.now();

      const maybeLog = () => {
        const now = Date.now();
        if (now - lastLog >= 1000) {
          lastLog = now;
          log(`stored ${written}/${jobs.length} terms`);
        }
      };

      const pump = () => {
        while (inflight < CONCURRENCY && idx < jobs.length) {
          const job = jobs[idx++];
          inflight++;
          const termKey = 'tfidf_' + d.util.id.getID(job.ngram);
          d[gid].store.put(job.scored, termKey, () => {
            inflight--;
            written++;
            maybeLog();
            if (written === jobs.length) {
              log(`done: ${written} terms written`);
              return cb(null, {terms: written, docs: N});
            }
            pump();
          });
        }
      };
      if (jobs.length === 0) {
        log('no terms to write');
        return cb(null, {terms: 0, docs: N});
      }
      pump();
    });
  });
}

module.exports = {run};