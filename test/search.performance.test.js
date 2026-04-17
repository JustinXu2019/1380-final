require('../distribution.js')();
const distribution = globalThis.distribution;
const id = distribution.util.id;
const http = require('node:http');

const awsNodes = [
  {ip: '3.133.106.38', port: 7110}
];

function parseAwsNodesFromEnv() {
  const raw = process.env.SEARCH_TEST_NODES;
  if (!raw) {
    return [];
  }

  return raw
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [ip, portRaw] = entry.split(':');
        return {ip, port: Number(portRaw)};
      });
}

const nodes = parseAwsNodesFromEnv().length > 0 ? parseAwsNodesFromEnv() : awsNodes;

function normalizeNodes(rawNodes) {
  const seen = new Set();
  return (rawNodes || [])
      .filter((node) => node && typeof node.ip === 'string' && Number.isInteger(node.port))
      .map((node) => ({ip: node.ip.trim(), port: Number(node.port)}))
      .filter((node) => node.ip.length > 0 && node.port > 0)
      .filter((node) => {
        const key = `${node.ip}:${node.port}`;
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      });
}

function probeNode(node, timeoutMs, cb) {
  const payload = distribution.util.serialize({args: []});
  const req = http.request({
    hostname: node.ip,
    port: node.port,
    path: '/local/status/get',
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
  }, (res) => {
    res.resume();
    cb(true);
  });

  req.setTimeout(timeoutMs, () => {
    req.destroy(new Error('timeout'));
  });

  req.on('error', () => cb(false));
  req.write(payload);
  req.end();
}

function resolveReachableNodes(candidateNodes, timeoutMs, cb) {
  if (!candidateNodes.length) {
    cb([]);
    return;
  }

  let pending = candidateNodes.length;
  const reachable = [];

  candidateNodes.forEach((node) => {
    probeNode(node, timeoutMs, (ok) => {
      if (ok) {
        reachable.push(node);
      }
      pending -= 1;
      if (pending === 0) {
        cb(reachable);
      }
    });
  });
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
  if (!group) {
    if (distribution.node.server) {
      distribution.node.server.close();
    }
    return cb && cb();
  }

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
  let group;

  beforeAll((done) => {
    let finished = false;
    const setupTimeout = setTimeout(() => {
      finish(new Error('Setup timed out while validating external nodes. Check IPs/ports in test/search.performance.test.js.'));
    }, 12000);

    const finish = (err) => {
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(setupTimeout);
      done(err);
    };

    distribution.node.start((err) => {
      if (err) {
        finish(err);
        return;
      }

      const configuredNodes = normalizeNodes(nodes);
      if (configuredNodes.length === 0) {
        if (distribution.node.server) {
          distribution.node.server.close();
        }
        finish(new Error('No external nodes configured. Add nodes to awsNodes or set SEARCH_TEST_NODES=ip:port[,ip:port].'));
        return;
      }

      resolveReachableNodes(configuredNodes, 2000, (reachableNodes) => {
        if (reachableNodes.length === 0) {
          if (distribution.node.server) {
            distribution.node.server.close();
          }
          const targets = configuredNodes.map((n) => `${n.ip}:${n.port}`).join(', ');
          finish(new Error(`None of the configured external nodes are reachable: ${targets}`));
          return;
        }

        if (reachableNodes.length !== configuredNodes.length) {
          const skipped = configuredNodes.length - reachableNodes.length;
          console.warn(`[perf] skipping ${skipped} unreachable external node(s)`);
        }

        group = buildGroupFromNodes(reachableNodes);
        setupGroup(group, () => finish());
      });
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

  test('indexer performance: 10 docs indexed', (done) => {
    const indexer = require('../distribution/search/indexer.js');
    const t0 = Date.now();
    indexer.run('search', (err, result) => {
      const elapsedMs = Date.now() - t0;
      const elapsedSec = (elapsedMs / 1000).toFixed(2);

      try {
        expect(err).toBeFalsy();
        expect(result).toBeDefined();
        expect(result.docs).toBeGreaterThanOrEqual(10);
        expect(result.terms).toBeGreaterThan(0);

        console.log(`[perf] indexer >=10 docs: ${elapsedSec}s (${result.docs} docs, ${result.terms} terms)`);
        done(err);
      } catch (e) {
        done(e);
      }
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
