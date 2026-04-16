const https = require('https');
const http = require('http');
const {URL} = require('url');

let state = null; // { visited: Set<kid>, queue: string[], queueSet: Set<url> }
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

function ownerNode(url, nids, group) {
  const d = globalThis.distribution;
  const kid = d.util.id.getID(url);
  const nid = d.util.id.consistentHash(kid, nids);
  return Object.values(group).find((n) => d.util.id.getNID(n) === nid);
}

function enqueue(url, cb) {
  const kid = globalThis.distribution.util.id.getID(url);
  if (state.visited.has(kid)) return cb(null, false);
  if (state.queueSet.has(url)) return cb(null, false);
  state.queue.push(url);
  state.queueSet.add(url);
  cb(null, true);
}

function dispatchLink(url, nids, group, cb) {
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

  const url = state.queue.shift();
  state.queueSet.delete(url);

  if (!url) {
    return setTimeout(() => crawlStep(nids, group, cb), 500);
  }

  const kid = globalThis.distribution.util.id.getID(url);
  if (state.visited.has(kid)) {
    return setImmediate(() => crawlStep(nids, group, cb));
  }

  fetchPage(url, (err, html) => {
    state.visited.add(kid);
    if (err || !html) return setImmediate(() => crawlStep(nids, group, cb));

    const nlp = globalThis.distribution.local.nlp;
    const text = nlp.extractText(html);
    const links = nlp.extractLinks(html, url);

    globalThis.distribution.search.store.put({url, text}, 'doc_' + kid, () => {
      let pending = links.length;
      if (pending === 0) return setImmediate(() => crawlStep(nids, group, cb));
      links.forEach((l) => {
        dispatchLink(l, nids, group, () => {
          if (--pending === 0) setImmediate(() => crawlStep(nids, group, cb));
        });
      });
    });
  });
}

function start(o, cb) {
  opts = Object.assign({seeds: [], groupName: 'search'}, o || {});
  state = {visited: new Set(), queue: [], queueSet: new Set()};

  const d = globalThis.distribution;
  d.local.groups.get(opts.groupName, (e, group) => {
    if (e) return cb(e);

    const nids = Object.values(group).map((n) => d.util.id.getNID(n));
    const me = d.util.id.getNID(d.node.config);

    opts.seeds.forEach((url) => {
      const owner = d.util.id.consistentHash(d.util.id.getID(url), nids);
      if (owner !== me) return;
      state.queue.push(url);
      state.queueSet.add(url);
    });

    loopActive = true;
    setImmediate(() => crawlStep(nids, group, () => {}));
    cb(null, {started: true});
  });
}

function stop(cb) {
  loopActive = false;
  cb(null, {stopped: true});
}

function status(cb) {
  cb(null, {
    crawling: loopActive,
    visited: state ? state.visited.size : 0,
    queue: state ? state.queue.length : 0,
  });
}

module.exports = {start, stop, enqueue, status};
