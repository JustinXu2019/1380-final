/*
    In this file, add your own test cases that correspond to functionality introduced for each milestone.
    You should fill out each test case so it adequately tests the functionality you implemented.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/

const distribution = require('../../distribution.js')();
require('../helpers/sync-guard');
const id = distribution.util.id;
const local = distribution.local;

const mygroupConfig = { gid: 'mygroup' };
const mygroupGroup = {};

const n1 = { ip: '127.0.0.1', port: 9001 };
const n2 = { ip: '127.0.0.1', port: 9002 };
const n3 = { ip: '127.0.0.1', port: 9003 };

// Test 1: put a group, add a node, remove that node, verify it's gone
test('(1 pts) student test', (done) => {
  const g = {
    'aaa11': { ip: '127.0.0.1', port: 8090 },
    'bbb22': { ip: '127.0.0.1', port: 8091 },
  };

  local.groups.put('testgroup1', g, (e, v) => {
    try {
      expect(e).toBeFalsy();
    } catch (error) {
      done(error);
      return;
    }

    const newNode = { ip: '127.0.0.1', port: 8092 };
    const newSid = id.getSID(newNode);

    local.groups.add('testgroup1', newNode, (e, v) => {
      try {
        expect(e).toBeFalsy();
        expect(v[newSid]).toEqual(newNode);
      } catch (error) {
        done(error);
        return;
      }

      local.groups.rem('testgroup1', newSid, (e, v) => {
        local.groups.get('testgroup1', (e, v) => {
          try {
            expect(e).toBeFalsy();
            expect(v[newSid]).toBeUndefined();
            expect(v).toEqual(g);
            done();
          } catch (error) {
            done(error);
          }
        });
      });
    });
  });
});

// Test 2: put two different groups, verify they are stored independently
test('(1 pts) student test', (done) => {
  const g1 = { 'ccc33': { ip: '127.0.0.1', port: 8093 } };
  const g2 = { 'ddd44': { ip: '127.0.0.1', port: 8094 } };

  local.groups.put('groupA', g1, (e, v) => {
    try {
      expect(e).toBeFalsy();
    } catch (error) {
      done(error);
      return;
    }

    local.groups.put('groupB', g2, (e, v) => {
      try {
        expect(e).toBeFalsy();
      } catch (error) {
        done(error);
        return;
      }

      local.groups.get('groupA', (e, v) => {
        try {
          expect(e).toBeFalsy();
          expect(v).toEqual(g1);
        } catch (error) {
          done(error);
          return;
        }

        local.groups.get('groupB', (e, v) => {
          try {
            expect(e).toBeFalsy();
            expect(v).toEqual(g2);
            done();
          } catch (error) {
            done(error);
          }
        });
      });
    });
  });
});

// Test 3: delete one of two groups, verify the other still exists
test('(1 pts) student test', (done) => {
  const g1 = { 'eee55': { ip: '127.0.0.1', port: 8095 } };
  const g2 = { 'fff66': { ip: '127.0.0.1', port: 8096 } };

  local.groups.put('keepGroup', g1, (e, v) => {
    local.groups.put('deleteGroup', g2, (e, v) => {
      local.groups.del('deleteGroup', (e, v) => {
        try {
          expect(e).toBeFalsy();
        } catch (error) {
          done(error);
          return;
        }

        // deleted group should now return an error
        local.groups.get('deleteGroup', (e, v) => {
          try {
            expect(e).toBeDefined();
            expect(e).toBeInstanceOf(Error);
            expect(v).toBeFalsy();
          } catch (error) {
            done(error);
            return;
          }

          // kept group should still be intact
          local.groups.get('keepGroup', (e, v) => {
            try {
              expect(e).toBeFalsy();
              expect(v).toEqual(g1);
              done();
            } catch (error) {
              done(error);
            }
          });
        });
      });
    });
  });
});

// Test 4: all.comm.send status.get('sid') returns a sid for every node in the group
test('(1 pts) student test', (done) => {
  const nids = Object.values(mygroupGroup).map((node) => id.getNID(node));
  const remote = { service: 'status', method: 'get' };

  distribution.mygroup.comm.send(['sid'], remote, (e, v) => {
    try {
      expect(e).toEqual({});
      expect(Object.values(v).length).toEqual(nids.length);
      // each value should be a non-empty string (a sid)
      Object.values(v).forEach((sid) => {
        expect(typeof sid).toBe('string');
        expect(sid.length).toBeGreaterThan(0);
      });
      done();
    } catch (error) {
      done(error);
    }
  });
});

// Test 5: all.comm.send status.get('counts') returns an object for every node in the group
test('(1 pts) student test', (done) => {
  const groupSize = Object.keys(mygroupGroup).length;
  const remote = { service: 'status', method: 'get' };

  distribution.mygroup.comm.send(['counts'], remote, (e, v) => {
    try {
      expect(e).toEqual({});
      expect(Object.keys(v).length).toEqual(groupSize);
      // each value should be an object (counts map)
      Object.values(v).forEach((counts) => {
        expect(typeof counts).toBe('number');
        expect(counts).not.toBeNull();
      });
      done();
    } catch (error) {
      done(error);
    }
  });
});

beforeAll((done) => {
  const remote = { service: 'status', method: 'stop' };

  const stopAll = (nodes, cb) => {
    if (nodes.length === 0) return cb();
    const node = nodes.shift();
    distribution.local.comm.send([], { ...remote, node }, (e, v) => {
      stopAll(nodes, cb);
    });
  };

  stopAll([n1, n2, n3], () => {
    mygroupGroup[id.getSID(n1)] = n1;
    mygroupGroup[id.getSID(n2)] = n2;
    mygroupGroup[id.getSID(n3)] = n3;

    distribution.node.start((e) => {
      if (e) { done(e); return; }

      distribution.local.status.spawn(n1, (e) => {
        if (e) { done(e); return; }
        distribution.local.status.spawn(n2, (e) => {
          if (e) { done(e); return; }
          distribution.local.status.spawn(n3, (e) => {
            if (e) { done(e); return; }
            distribution.local.groups.put(mygroupConfig, mygroupGroup, (e, v) => {
              if (e) { done(e); return; }
              done();
            });
          });
        });
      });
    });
  });
});

afterAll((done) => {
  const remote = { service: 'status', method: 'stop' };

  const stopAll = (nodes, cb) => {
    if (nodes.length === 0) return cb();
    const node = nodes.shift();
    distribution.local.comm.send([], { ...remote, node }, (e, v) => {
      stopAll(nodes, cb);
    });
  };

  stopAll([n1, n2, n3], () => {
    if (globalThis.distribution.node.server) {
      globalThis.distribution.node.server.close();
    }
    done();
  });
});
