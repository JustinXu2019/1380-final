require('../distribution.js')();
const distribution = globalThis.distribution;
const id = distribution.util.id;

const nodes = [
  {ip: '172.31.5.255', port: 7110},
  {ip: '172.31.27.75', port: 7110},
];

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
  const nodesList = Object.values(group);
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

jest.setTimeout(3600000);
describe('performance', () => {
  let group;

  beforeAll((done) => {
    group = buildGroupFromNodes(nodes);
    distribution.node.config = {ip: '172.31.10.55', port: 7110};
    distribution.node.start((err) => {
      if (err) {
        done(err);
        return;
      }
      setupGroup(group, done);
    });
  });

  afterAll((done) => {
    shutdown(group, done);
  });

  test('crawler performance: 100 links from https://www.food.com/', (done) => {
    const seedUrl = 'https://www.food.com/';
    const maxPages = 100;

    distribution.search.comm.send([], {service: 'crawler', method: 'reset'}, () => {
      const t0 = Date.now();
      const opts = {
        seeds: [seedUrl],
        maxPages,
        allowDomains: ['food.com', 'www.food.com'],
        groupName: 'search',
      };

      distribution.search.comm.send([opts], {service: 'crawler', method: 'start'}, () => {
        const startPoll = Date.now();
        const maxWaitMs = 3600000;

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

            if (total >= maxPages || activeCount === 0) {
              const elapsedMs = Date.now() - t0;
              const elapsedSec = (elapsedMs / 1000).toFixed(2);
              console.log(`[perf] crawler 100 links: ${elapsedSec}s (${total} pages)`);

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

  test('indexer performance: 100 docs indexed', (done) => {
    const indexer = require('../distribution/search/indexer.js');
    distribution.search.comm.send([], {service: 'crawler', method: 'getLocalUrls'}, (_errs, vals) => {
      const allUrls = new Set();
      Object.values(vals || {}).forEach((urls) => {
        if (Array.isArray(urls)) urls.forEach((u) => allUrls.add(u));
      });
      if (allUrls.size < 100) {
        done(new Error(`insufficient urls: only ${allUrls.size}`));
        return;
      }

      const t0 = Date.now();
      indexer.run('search', (err, result) => {
        const elapsedMs = Date.now() - t0;
        const elapsedSec = (elapsedMs / 1000).toFixed(2);

        try {
          expect(err).toBeFalsy();
          expect(result).toBeDefined();
          expect(result.docs).toBeGreaterThanOrEqual(100);
          expect(result.terms).toBeGreaterThan(0);

          console.log(`[perf] indexer 100 docs: ${elapsedSec}s (${result.docs} docs, ${result.terms} terms)`);
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  }, 3600000);

  test('query performance: 100 queries', (done) => {
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
