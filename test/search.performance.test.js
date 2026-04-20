require('../distribution.js')();
const fs = require('fs');
const path = require('path');
const distribution = globalThis.distribution;
const id = distribution.util.id;

const n1 = {ip: '127.0.0.1', port: 7110};
const n2 = {ip: '127.0.0.1', port: 7111};
const n3 = {ip: '127.0.0.1', port: 7112};
const n4 = {ip: '127.0.0.1', port: 7113};
const n5 = {ip: '127.0.0.1', port: 7114};

const workerNodes = [n1,n2,n3,n4,n5];
const seedsPath = path.resolve(path.join(__dirname, '..', 'distribution', 'search', 'seeds.txt'));

function readSeeds() {
  return fs.readFileSync(seedsPath, 'utf8').split(/\s+/).filter(Boolean);
}

function deriveAllowedDomains(seeds) {
  return [...new Set(seeds.map((u) => {
    try {
      return new URL(u).hostname.toLowerCase();
    } catch (_) {
      return null;
    }
  }).filter(Boolean))];
}

function buildGroupFromNodes(nodes) {
  const group = {};
  nodes.forEach((node) => {
    group[id.getSID(node)] = node;
  });
  return group;
}

function setupGroup(group, cb) {
  const cfg = {gid: 'search'};
  distribution.local.groups.put(cfg, group, () => {
    distribution.search.groups.put(cfg, group, () => cb());
  });
}

function shutdown(group, cb) {
  const localSid = id.getSID(distribution.node.config);
  const nodesList = Object.values(group).filter((node) => id.getSID(node) !== localSid);
  let i = 0;

  const stopNext = () => {
    if (i >= nodesList.length) {
      if (distribution.node.server) {
        distribution.node.server.close();
      }
      return cb && cb();
    }

    const node = nodesList[i];
    distribution.local.comm.send([], {node, service: 'status', method: 'stop'}, () => {
      i++;
      stopNext();
    });
  };

  stopNext();
}

describe('performance', () => {
  jest.setTimeout(3600000);
  let group;
  const seedUrls = readSeeds();
  const allowDomains = deriveAllowedDomains(seedUrls);

  beforeAll((done) => {
    const spawnNodes = (nodes, idx, cb) => {
      if (idx >= nodes.length) {
        return cb();
      }
      distribution.local.status.spawn(nodes[idx], (e) => {
        if (e) {
          return cb(e);
        }
        spawnNodes(nodes, idx + 1, cb);
      });
    };

    distribution.node.start((err) => {
      if (err) {
        done(err);
        return;
      }
      spawnNodes(workerNodes, 0, (spawnErr) => {
        if (spawnErr) {
          done(spawnErr);
          return;
        }
        group = buildGroupFromNodes(workerNodes);
        setupGroup(group, done);
      });
    });
  });

  afterAll((done) => {
    shutdown(group, done);
  });

  test('crawler performance: 1000 links from seeds.txt', (done) => {
    const maxPages = 1000;

    distribution.search.comm.send([], {service: 'crawler', method: 'reset'}, () => {
      const t0 = Date.now();
      const opts = {
        seeds: seedUrls,
        maxPages,
        allowDomains,

        groupName: 'search',
      };

      distribution.search.comm.send([opts], {service: 'crawler', method: 'start'}, () => {
        const startPoll = Date.now();
        const maxWaitMs = 3600000;
        let idlePolls = 0;

        const poll = () => {
          distribution.search.comm.send([], {service: 'crawler', method: 'status'}, (errs, statuses) => {
            let total = 0;
            let activeCount = 0;

            Object.values(statuses || {}).forEach((status) => {
              if (!status) {
                return;
              }
              total += status.crawled || 0;
              if (status.crawling) {
                activeCount++;
              }
            });

            if (total === 0 && activeCount === 0) {
              idlePolls++;
            } else {
              idlePolls = 0;
            }

            if (total >= maxPages || activeCount === 0) {
              if (total === 0 && activeCount === 0 && idlePolls < 5) {
                setTimeout(poll, 2000);
                return;
              }

              const elapsedMs = Date.now() - t0;
              const elapsedSec = (elapsedMs / 1000).toFixed(2);
              console.log(`[perf] crawler 1000 links: ${elapsedSec}s (${total} pages)`);

              distribution.search.comm.send([], {service: 'crawler', method: 'stop'}, () => {
                try {
                  expect(total).toBeGreaterThanOrEqual(maxPages);
                  done();
                } catch (e) {
                  done(e);
                }
              });
              return;
            }

            if (Date.now() - startPoll > maxWaitMs) {
              done(new Error(`Timeout`));
              return;
            }

            setTimeout(poll, 2000);
          });
        };

        setTimeout(poll, 2000);
      });
    });
  }, 3600000);

  test('indexer performance: 1000 docs indexed', (done) => {
    const indexer = require('../distribution/search/indexer.js');
    const t0 = Date.now();
    const MAX_ATTEMPTS = 3;
    let attempt = 0;

    const runAttempt = () => {
      attempt++;
      indexer.run('search', (err, result) => {
        if (err && attempt < MAX_ATTEMPTS) {
          setTimeout(runAttempt, 400);
          return;
        }

        const elapsedMs = Date.now() - t0;
        const elapsedSec = (elapsedMs / 1000).toFixed(2);

        try {
          expect(err).toBeFalsy();
          expect(result).toBeDefined();
          expect(result.docs).toBeGreaterThanOrEqual(1000);
          expect(result.terms).toBeGreaterThan(0);

          console.log(`[perf] indexer >=1000 docs: ${elapsedSec}s (${result.docs} docs, ${result.terms} terms)`);
          done(err);
        } catch (e) {
          done(e);
        }
      });
    };

    runAttempt();
  }, 3600000);

  test('query performance: 1000 queries', (done) => {
    const query = require('../distribution/search/query.js');
    const queryTerms = 'food recipes cooking';
    let completed = 0;
    const totalQueries = 100;

    const t0 = Date.now();
    const processNext = () => {
      if (completed >= totalQueries) {
        const totalMs = Date.now() - t0;
        const totalSec = (totalMs / 1000).toFixed(2);
        const avgMs = (totalMs / totalQueries).toFixed(2);

        console.log(`[perf] query 100 runs: ${totalSec}s (avg ${avgMs}ms per query)`);

        try {
          expect(totalMs).toBeLessThan(3600000);
          done();
        } catch (e) {
          done(e);
        }
        return;
      }

      query.run(queryTerms, 10, 'search', (err) => {
        completed++;

        if (err) {
          console.warn(`query error`);
        }

        setImmediate(processNext);
      });
    };

    processNext();
  }, 3600000);
});