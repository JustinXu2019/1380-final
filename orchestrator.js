#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const yargs = require('yargs');

require('./distribution.js')();
const distribution = globalThis.distribution;
const id = distribution.util.id;

const argv = yargs
    .option('nodes', {type: 'number', default: 3})
    .option('seeds', {type: 'string', default: 'distribution/search/seeds.txt'})
    .option('max-pages', {type: 'number', default: 50})
    .option('q', {type: 'string', default: ''})
    .option('top-k', {type: 'number', default: 10})
    .command('crawl', 'start distributed crawl')
    .command('index', 'build distributed index')
    .command('query', 'query the search index')
    .command('status', 'print crawler status on all workers')
    .command('reset', 'wipe crawler state on all workers')
    .demandCommand(1)
    .help()
    .argv;

const mode = argv._[0];

function readSeeds() {
  const p = path.resolve(argv.seeds);
  return fs.readFileSync(p, 'utf8').split(/\s+/).filter(Boolean);
}

function buildGroup(n) {
  const group = {};
  for (let i = 0; i < n; i++) {
    const node = {ip: '127.0.0.1', port: 8000 + i};
    group[id.getSID(node)] = node;
  }
  return group;
}

function spawnAll(group, cb) {
  const nodes = Object.values(group);
  let i = 0;
  const next = () => {
    if (i >= nodes.length) return cb();
    distribution.local.status.spawn(nodes[i], (e) => {
      if (e && !(e.message || '').includes('already')) {
        console.error('spawn error:', e.message);
      }
      i++;
      next();
    });
  };
  next();
}

function setupGroup(group, cb) {
  const cfg = {gid: 'search'};
  distribution.local.groups.put(cfg, group, () => {
    distribution.search.groups.put(cfg, group, () => cb());
  });
}

function withCluster(fn) {
  const group = buildGroup(argv.nodes);
  distribution.node.start(() => {
    spawnAll(group, () => setupGroup(group, () => fn(group)));
  });
}

function shutdown(group) {
  const nodes = Object.values(group);
  let i = 0;
  const next = () => {
    if (i >= nodes.length) {
      if (distribution.node.server) distribution.node.server.close();
      return;
    }
    distribution.local.comm.send(
        [], {node: nodes[i], service: 'status', method: 'stop'},
        () => { i++; next(); },
    );
  };
  next();
}

function gracefulShutdown(group) {
  process.stdout.write('\n[crawl] caught signal, stopping workers...\n');
  distribution.search.comm.send(
      [], {service: 'crawler', method: 'stop'},
      () => shutdown(group),
  );
}

function pollUntilDone(group) {
  const started = Date.now();
  const poll = () => {
    distribution.search.comm.send(
        [], {service: 'crawler', method: 'status'},
        (errs, vals) => {
          let total = 0;
          let totalBytes = 0;
          let crawling = 0;
          Object.values(vals || {}).forEach((s) => {
            if (!s) return;
            total += s.crawled || 0;
            totalBytes += s.bytes || 0;
            if (s.crawling) crawling++;
          });
          const elapsed = ((Date.now() - started) / 1000).toFixed(1);
          const mb = (totalBytes / (1024 * 1024)).toFixed(1);
          process.stdout.write(
              `\r[crawl] ${elapsed}s  crawled=${total}  active=${crawling}/${argv.nodes}  bytes=${mb}MB  `,
          );
          if (total >= argv.maxPages || crawling === 0) {
            process.stdout.write('\n');
            distribution.search.comm.send(
                [], {service: 'crawler', method: 'stop'},
                () => shutdown(group),
            );
            return;
          }
          setTimeout(poll, 1500);
        });
  };
  setTimeout(poll, 1500);
}

function doCrawl() {
  withCluster((group) => {
    const seeds = readSeeds();
    const allowDomains = [...new Set(seeds.map((u) => {
      try { return new URL(u).hostname.toLowerCase(); } catch (_) { return null; }
    }).filter(Boolean))];
    const startOpts = {
      seeds,
      maxPages: argv.maxPages,
      allowDomains,
      groupName: 'search',
    };
    process.on('SIGINT', () => gracefulShutdown(group));
    process.on('SIGTERM', () => gracefulShutdown(group));
    distribution.search.comm.send(
        [startOpts],
        {service: 'crawler', method: 'start'},
        () => pollUntilDone(group),
    );
  });
}

function doIndex() {
  withCluster((group) => {
    const indexer = require('./distribution/search/indexer.js');
    indexer.run('search', (err, stats) => {
      if (err) console.error('[index] error:', err);
      else console.log(`[index] terms=${stats.terms} docs=${stats.docs}`);
      shutdown(group);
    });
  });
}


function doStatus() {
  withCluster((group) => {
    distribution.search.comm.send(
        [], {service: 'crawler', method: 'status'},
        (errs, vals) => {
          Object.entries(vals || {}).forEach(([sid, s]) => {
            console.log(`${sid}:`, s);
          });
          shutdown(group);
        });
  });
}


function doReset() {
  withCluster((group) => {
    distribution.search.comm.send(
        [], {service: 'crawler', method: 'reset'},
        () => {
          console.log('[reset] crawler state cleared');
          shutdown(group);
        },
    );
  });
}

function doQuery() {
  withCluster((group) => {
    const query = require('./distribution/search/query.js');
    query.run(argv.q, argv.topK, (err, results) => {
      if (err) console.error('[query] error:', err);
      else {
        console.log(`[query] "${argv.q}" (${results.length} results)`);
        results.forEach((r, i) => {
          console.log(`${(i + 1).toString().padStart(2)}. ${r.score.toFixed(4)}  ${r.url}`);
        });
      }
      shutdown(group);
    });
  });
}

switch (mode) {
  case 'crawl': doCrawl(); break;
  case 'index': doIndex(); break;
  case 'query': doQuery(); break;
  case 'status': doStatus(); break;
  case 'reset': doReset(); break;
  default:
    console.error('unknown command:', mode);
    process.exit(1);
}
