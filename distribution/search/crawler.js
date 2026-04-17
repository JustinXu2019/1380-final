const https = require('https');
const http = require('http');
const {URL} = require('url');

const STATE_KEY = 'crawler-state';
const STATE_GID = 'crawler';

// state.visited and state.queueSet are Sets at runtime but get serialized
// as arrays since JSON doesn't handle Sets. queueSet is reconstructed from
// queue on load so we don't bother persisting it separately.
let state = null;
let loopActive = false;
let opts = {};

function fetchPage(url, cb) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch (e) {
    return cb(e);
  }

  const lib = parsed.protocol === 'http:' ? http : https;
  const req = lib.get(url, {timeout: 10000}, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      res.resume();
      return fetchPage(new URL(res.headers.location, url).href, cb);
    }
    if (res.statusCode !== 200) {
      res.resume();
      return cb(new Error(`status ${res.statusCode}`));
    }

    const ctype = res.headers['content-type'] || '';
    if (!ctype.includes('text/html')) {
      res.resume();
      return cb(new Error('not html'));
    }

    let data = '';
    let done = false;
    res.setEncoding('utf8');
    res.on('data', (chunk) => {
      data += chunk;
      if (data.length > 2 * 1024 * 1024) {
        done = true;
        res.destroy();
        cb(null, data);
      }
    });
    res.on('end', () => { if (!done) cb(null, data); });
    res.on('error', (e) => { if (!done) { done = true; cb(e); } });
  });
  req.on('timeout', () => req.destroy(new Error('timeout')));
  req.on('error', (e) => cb(e));
}

function persist(cb) {
  if (!state) return cb && cb();
  const serialized = {
    visited: [...state.visited],
    queue: state.queue,
    crawledCount: state.crawledCount,
    bytes: state.bytes,
  };
  globalThis.distribution.local.store.put(
      serialized, {key: STATE_KEY, gid: STATE_GID}, () => cb && cb(),
  );
}

function load(cb) {
  globalThis.distribution.local.store.get(
      {key: STATE_KEY, gid: STATE_GID}, (e, saved) => {
        if (!e && saved) {
          state = {
            visited: new Set(saved.visited),
            queue: saved.queue,
            queueSet: new Set(saved.queue),
            crawledCount: saved.crawledCount || 0,
            bytes: saved.bytes || 0,
          };
        } else {
          state = {visited: new Set(), queue: [], queueSet: new Set(), crawledCount: 0, bytes: 0};
        }
        cb();
      });
}

function maybePersist(cb) {
  if (state.crawledCount % 5 === 0) persist(cb);
  else cb();
}

function urlAllowed(url) {
  if (!opts.allowDomains || opts.allowDomains.length === 0) return true;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return opts.allowDomains.some((d) => host === d || host.endsWith('.' + d));
  } catch (_) {
    return false;
  }
}

function ownerNode(url, nids, group) {
  const d = globalThis.distribution;
  const kid = d.util.id.getID(url);
  const nid = d.util.id.consistentHash(kid, nids);
  return Object.values(group).find((n) => d.util.id.getNID(n) === nid);
}

function enqueue(url, cb) {
  if (!state) return load(() => enqueue(url, cb));
  const kid = globalThis.distribution.util.id.getID(url);
  if (state.visited.has(kid)) return cb(null, false);
  if (state.queueSet.has(url)) return cb(null, false);
  state.queue.push(url);
  state.queueSet.add(url);
  cb(null, true);
}

function dispatchLink(url, nids, group, cb) {
  if (!urlAllowed(url)) return cb();
  const d = globalThis.distribution;
  const me = d.util.id.getNID(d.node.config);
  const target = ownerNode(url, nids, group);
  if (d.util.id.getNID(target) === me) {
    enqueue(url, cb);
  } else {
    d.local.comm.send(
        [url],
        {node: target, service: 'crawler', method: 'enqueue'},
        cb,
    );
  }
}

function crawlStep(nids, group, cb) {
  if (!loopActive) return cb();
  if (state.crawledCount >= opts.maxPages) {
    loopActive = false;
    return persist(cb);
  }

  const url = state.queue.shift();
  if (!url) {
    return setTimeout(() => crawlStep(nids, group, cb), 500);
  }
  state.queueSet.delete(url);

  const kid = globalThis.distribution.util.id.getID(url);
  if (state.visited.has(kid)) {
    return setImmediate(() => crawlStep(nids, group, cb));
  }

  fetchPage(url, (err, html) => {
    state.visited.add(kid);
    if (err || !html) return maybePersist(() => crawlStep(nids, group, cb));

    state.crawledCount += 1;
    state.bytes += html.length;
    const nlp = globalThis.distribution.local.nlp;
    const text = nlp.extractText(html);
    const links = nlp.extractLinks(html, url);

    const d = globalThis.distribution;
    d.search.store.put({url, text}, 'doc_' + kid, () => {
      d.search.store.append(url, '__all_urls__', () => {
        let pending = links.length;
        if (pending === 0) return maybePersist(() => crawlStep(nids, group, cb));
        links.forEach((l) => {
          dispatchLink(l, nids, group, () => {
            if (--pending === 0) maybePersist(() => crawlStep(nids, group, cb));
          });
        });
      });
    });
  });
}

function start(o, cb) {
  opts = Object.assign({seeds: [], groupName: 'search', maxPages: 100, allowDomains: []}, o || {});

  load(() => {
    const d = globalThis.distribution;
    d.local.groups.get(opts.groupName, (e, group) => {
      if (e) return cb(e);

      const nids = Object.values(group).map((n) => d.util.id.getNID(n));
      const me = d.util.id.getNID(d.node.config);

      opts.seeds.forEach((url) => {
        const owner = d.util.id.consistentHash(d.util.id.getID(url), nids);
        if (owner !== me) return;
        const kid = d.util.id.getID(url);
        if (!state.visited.has(kid) && !state.queueSet.has(url)) {
          state.queue.push(url);
          state.queueSet.add(url);
        }
      });

      if (loopActive) return cb(null, {started: false, already: true});
      loopActive = true;
      const workers = opts.workers || 8;
      for (let i = 0; i < workers; i++) {
        setImmediate(() => crawlStep(nids, group, () => {}));
      }
      cb(null, {started: true, workers});
    });
  });
}

function stop(cb) {
  loopActive = false;
  persist(() => cb(null, {stopped: true}));
}

function status(cb) {
  if (!state) return load(() => status(cb));
  cb(null, {
    crawling: loopActive,
    visited: state.visited.size,
    queue: state.queue.length,
    crawled: state.crawledCount,
    bytes: state.bytes,
  });
}

function reset(cb) {
  state = {visited: new Set(), queue: [], queueSet: new Set(), crawledCount: 0, bytes: 0};
  loopActive = false;
  persist(() => cb(null, {reset: true}));
}

module.exports = {start, stop, enqueue, status, reset};
