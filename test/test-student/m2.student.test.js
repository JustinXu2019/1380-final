/*
    In this file, add your own test cases that correspond to functionality introduced for each milestone.
    You should fill out each test case so it adequately tests the functionality you implemented.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/

const distribution = require('../../distribution.js')(({ip: '127.0.0.1', port: 1246}));
const local = distribution.local;
require('../helpers/sync-guard');

test('(1 pts) student test', (done) => {
  local.status.get('invalidConfig', (e, v) => {
    try {
      expect(e).toBeTruthy();
      expect(e.message).toBe("Invalid status.get() configuration");
      expect(v).toBeNull();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(1 pts) student test', (done) => {
  const config = distribution.node.config;
  local.status.get(null, (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toEqual(distribution.util.id.getNID(config));
      done();
    } catch (error) {
      done(error);
    }
  });
});


test('(1 pts) student test', (done) => {
  local.routes.get(null, (e, v) => {
    try {
      expect(e).toBeTruthy();
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(1 pts) student test', (done) => {
  local.routes.get('nonExistentService', (e, v) => {
    try {
      expect(e).toBeTruthy();
      expect(e.message).toBe("invalid route.get() service");
      expect(v).toBeNull();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(1 pts) student test', (done) => {
  local.routes.put(null, 'testService', (e, v) => {
    try {
      expect(e).toBeTruthy();
      expect(e.message).toBe('No routes.put() service provided');
      expect(v).toBeNull();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(1 pts) student test', (done) => {
  const mockService = { test: 'service' };
  local.routes.put(mockService, null, (e, v) => {
    try {
      expect(e).toBeTruthy();
      expect(e.message).toBe('No routes.put() configuration provided');
      expect(v).toBeNull();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(1 pts) student test', (done) => {
  local.routes.rem(null, (e, v) => {
    try {
      expect(e).toBeTruthy();
      expect(e.message).toBe('No routes.rem() configuration');
      expect(v).toBeNull();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(1 pts) student test', (done) => {
  local.routes.rem(undefined, (e, v) => {
    try {
      expect(e).toBeTruthy();
      expect(e.message).toBe('No routes.rem() configuration');
      expect(v).toBeNull();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(1 pts) student test', (done) => {
  const message = ['nid'];

  local.comm.send(message, null, (e, v) => {
    try {
      expect(e).toBeTruthy();
      expect(e.message).toBe('Missing message or remote configuration');
      expect(v).toBeNull();
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(1 pts) student test', (done) => {
  const node = distribution.node.config;
  const remote = {node: node, service: 'status', method: 'get'};
  const message = [0];

  local.comm.send(message, remote, (e, v) => {
    try {
      expect(e).toBeFalsy();
      expect(v).toEqual(distribution.util.id.getNID(node));
      done();
    } catch (error) {
      done(error);
    }
  });
});

test('(1 pts) student test', (done) => {
  const node = distribution.node.config;
  const remote = {node: node, service: 'status', method: 'get'};
  const message = ['nid'];
  const numRequests = 1000;
  
  let completed = 0;
  let errors = 0;
  const startTime = Date.now();

  for (let i = 0; i < numRequests; i++) {
    local.comm.send(message, remote, (e, v) => {
      if (e) errors++;
      completed++;
      
      if (completed === numRequests) {
        const endTime = Date.now();
        const totalTime = endTime - startTime;
        const throughput = (numRequests / totalTime) * 1000; // requests per second
        
        try {
          expect(errors).toBe(0);
          expect(completed).toBe(numRequests);
          console.log(`Completed ${numRequests} requests in ${totalTime}ms`);
          console.log(`Throughput: ${throughput.toFixed(2)} requests/second`);
          console.log(`Average latency: ${(totalTime / numRequests).toFixed(2)}ms per request`);
          done();
        } catch (error) {
          done(error);
        }
      }
    });
  }
}, 30000); // 30 second timeout for safety

test('(1 pts) student test', (done) => {
  let counter = 0;
  const increment = () => {
    return ++counter;
  };

  const node = {ip: '127.0.0.1', port: 9010};
  const numRequests = 1000;

  let incrementRPC = distribution.util.wire.createRPC(distribution.util.wire.toAsync(increment));

  const rpcService = {
    increment: incrementRPC,
  };

  distribution.node.start(() => {
    function cleanup(callback) {
      if (globalThis.distribution.node.server) {
        globalThis.distribution.node.server.close();
      }
      distribution.local.comm.send([],
          {node: node, service: 'status', method: 'stop'},
          callback);
    }

    distribution.local.status.spawn(node, (e, v) => {
      distribution.local.comm.send([rpcService, 'rpcService'],
          {node: node, service: 'routes', method: 'put'}, (e, v) => {
            
            let completed = 0;
            let errors = 0;
            const latencies = [];
            const overallStartTime = process.hrtime.bigint();

            for (let i = 0; i < numRequests; i++) {
              const requestStartTime = process.hrtime.bigint();
              
              distribution.local.comm.send([],
                  {node: node, service: 'rpcService', method: 'increment'}, (e, v) => {
                    const requestEndTime = process.hrtime.bigint();
                    const latencyNs = requestEndTime - requestStartTime;
                    latencies.push(Number(latencyNs) / 1_000_000);
                    
                    if (e) errors++;
                    completed++;
                    
                    if (completed === numRequests) {
                      const overallEndTime = process.hrtime.bigint();
                      const totalTimeNs = overallEndTime - overallStartTime;
                      const totalTimeMs = Number(totalTimeNs) / 1_000_000;
                      const throughput = (numRequests / totalTimeMs) * 1000;
                      
                      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
                      const minLatency = Math.min(...latencies);
                      const maxLatency = Math.max(...latencies);
                      const sortedLatencies = latencies.sort((a, b) => a - b);
                      const p50Latency = sortedLatencies[Math.floor(numRequests * 0.5)];
                      const p95Latency = sortedLatencies[Math.floor(numRequests * 0.95)];
                      const p99Latency = sortedLatencies[Math.floor(numRequests * 0.99)];
                      
                      try {
                        expect(errors).toBe(0);
                        expect(completed).toBe(numRequests);
                        expect(counter).toBe(numRequests);
                        
                        console.log(`\nRPC Performance Metrics (${numRequests} requests):`);
                        console.log(`Total time: ${totalTimeMs.toFixed(3)}ms`);
                        console.log(`Throughput: ${throughput.toFixed(2)} requests/second`);
                        console.log(`\nLatency Statistics:`);
                        console.log(`  Average: ${avgLatency.toFixed(3)}ms`);
                        console.log(`  Min: ${minLatency.toFixed(3)}ms`);
                        console.log(`  Max: ${maxLatency.toFixed(3)}ms`);
                        console.log(`  P50: ${p50Latency.toFixed(3)}ms`);
                        console.log(`  P95: ${p95Latency.toFixed(3)}ms`);
                        console.log(`  P99: ${p99Latency.toFixed(3)}ms`);
                        
                        cleanup(done);
                      } catch (error) {
                        cleanup(() => {
                          done(error);
                        });
                      }
                    }
                  });
            }
          });
    });
  });
}, 60000);

beforeAll((done) => {
  distribution.node.start((e) => {
    if (e) {
      done(e);
      return;
    }
    done();
  });
});

afterAll((done) => {
  if (globalThis.distribution.node.server) {
    globalThis.distribution.node.server.close();
  }
  done();
});


