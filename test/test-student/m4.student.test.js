/*
    In this file, add your own test cases that correspond to functionality introduced for each milestone.
    You should fill out each test case so it adequately tests the functionality you implemented.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Important: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/

const distribution = require('../../distribution.js')();
require('../helpers/sync-guard');

// Test 1: store.get with null configuration returns an error
test('(1 pts) student test', (done) => {
  distribution.mygroup.store.get(null, (e, v) => {
    try {
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});

// Test 2: store.del with null configuration returns an error
test('(1 pts) student test', (done) => {
  distribution.mygroup.store.del(null, (e, v) => {
    try {
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});

// Test 3: store.get with an empty string key returns an error
test('(1 pts) student test', (done) => {
  distribution.mygroup.store.get('', (e, v) => {
    try {
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});

// Test 4: mem.get with null configuration returns an error
test('(1 pts) student test', (done) => {
  distribution.mygroup.mem.get(null, (e, v) => {
    try {
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});

// Test 5: mem.del with null configuration returns an error
test('(1 pts) student test', (done) => {
  distribution.mygroup.mem.del(null, (e, v) => {
    try {
      expect(e).toBeInstanceOf(Error);
      expect(v).toBeFalsy();
      done();
    } catch (error) {
      done(error);
    }
  });
});


/*
  Setup — mirrors the pattern used in the provided test suite.
  Adjust node ports if they conflict with other test files in your suite.
*/

const id = distribution.util.id;
const mygroupNodes = {};

const n1 = {ip: '127.0.0.1', port: 9101};
const n2 = {ip: '127.0.0.1', port: 9102};
const n3 = {ip: '127.0.0.1', port: 9103};

beforeAll((done) => {
  const remote = {service: 'status', method: 'stop'};

  // Attempt to stop any previously running nodes on these ports
  remote.node = n1;
  distribution.local.comm.send([], remote, () => {
    remote.node = n2;
    distribution.local.comm.send([], remote, () => {
      remote.node = n3;
      distribution.local.comm.send([], remote, () => {
        startNodes();
      });
    });
  });

  function startNodes() {
    mygroupNodes[id.getSID(n1)] = n1;
    mygroupNodes[id.getSID(n2)] = n2;
    mygroupNodes[id.getSID(n3)] = n3;

    distribution.node.start((e) => {
      if (e) return done(e);

      distribution.local.status.spawn(n1, (e) => {
        if (e) return done(e);
        distribution.local.status.spawn(n2, (e) => {
          if (e) return done(e);
          distribution.local.status.spawn(n3, (e) => {
            if (e) return done(e);

            const mygroupConfig = {gid: 'mygroup'};
            distribution.local.groups.put(mygroupConfig, mygroupNodes, (e) => {
              if (e) return done(e);
              distribution.mygroup.groups.put(mygroupConfig, mygroupNodes, (e) => {
                if (e instanceof Error) return done(e);
                done();
              });
            });
          });
        });
      });
    });
  }
});

afterAll((done) => {
  const remote = {service: 'status', method: 'stop'};
  remote.node = n1;
  distribution.local.comm.send([], remote, () => {
    remote.node = n2;
    distribution.local.comm.send([], remote, () => {
      remote.node = n3;
      distribution.local.comm.send([], remote, () => {
        if (globalThis.distribution.node.server) {
          globalThis.distribution.node.server.close();
        }
        done();
      });
    });
  });
});