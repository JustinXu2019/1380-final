// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../util/id.js").NID} NID
 */

/**
 * Map functions used for mapreduce
 * @callback Mapper
 * @param {string} key
 * @param {any} value
 * @returns {object[]}
 */

/**
 * Reduce functions used for mapreduce
 * @callback Reducer
 * @param {string} key
 * @param {any[]} value
 * @returns {object}
 */

/**
 * @typedef {Object} MRConfig
 * @property {Mapper} map
 * @property {Reducer} reduce
 * @property {string[]} keys
 *
 * @typedef {Object} Mr
 * @property {(configuration: MRConfig, callback: Callback) => void} exec
 */


/*
  Note: The only method explicitly exposed in the `mr` service is `exec`.
  Other methods, such as `map`, `shuffle`, and `reduce`, should be dynamically
  installed on the remote nodes and not necessarily exposed to the user.
*/

const id = require('../util/id.js');

/**
 * @param {Config} config
 * @returns {Mr}
 */
function mr(config) {
  const context = {
    gid: config.gid || 'all',
  };

  function exec(configuration, callback) {
    const distribution = globalThis.distribution;
    const allRoutes = distribution[context.gid].routes;
    const allComm = distribution[context.gid].comm;
    const groups = distribution.local.groups;

    const mrID = id.getID(`${configuration}${Date.now()}`);
    const mrGid = `mr-${mrID}`;
    const coordinator = distribution.node.config;

    const hasErrors = (errors) => errors && Object.keys(errors).length > 0;

    /*
      MapReduce steps:
      1) Setup: register a service `mr-<id>` on all nodes in the group. The service implements the map, shuffle, and reduce methods.
      2) Map: make each node run map on its local data and store them locally, under a different gid, to be used in the shuffle step.
      3) Shuffle: group values by key using store.append.
      4) Reduce: make each node run reduce on its local grouped values.
      5) Cleanup: remove the `mr-<id>` service and return the final output.

      Note: Comments inside the stencil describe a possible implementation---you should feel free to make low- and mid-level adjustments as needed.
    */
    groups.get(context.gid, (groupErr, group) => {
      if (groupErr) {
        return callback(groupErr);
      }
      const expected = Object.keys(group).length;
      if (expected === 0) {
        return callback(new Error('group is empty'));
      }

      const mrService = {
      mapper: configuration.map,
      reducer: configuration.reduce,
      gid: context.gid,
      keys: configuration.keys || [],
      coordinator,
      route: mrGid,
      mrID,
      group,
      notifications: {},
      shuffled: {},
      reduced: [],
      start: function(
          /** @type {{coordinator: any, route: string}} */ payload,
          /** @type {Callback} */ callback,
      ) {
        const distribution = globalThis.distribution;
        const sid = distribution.util.id.getSID(distribution.node.config);
        const remote = {
          node: payload.coordinator,
          service: payload.route,
          method: 'notify',
          gid: 'local',
        };

        return distribution.local.comm.send(['setup', sid, true], remote, (e, v) => {
          if (e) {
            return callback(e);
          }
          return callback(null, v);
        });
      },
      notify: function(
          /** @type {string} */ phase,
          /** @type {string} */ sid,
          /** @type {any} */ value,
          /** @type {Callback} */ callback,
      ) {
        if (!this.notifications[phase]) {
          this.notifications[phase] = {};
        }
        this.notifications[phase][sid] = value;
        return callback(null);
      },
      map: function(
          /** @type {string} */ mrGid,
          /** @type {string} */ mrID,
          /** @type {Callback} */ callback,
      ) {
        const distribution = globalThis.distribution;
        const localStore = distribution.local.store;
        const localComm = distribution.local.comm;
        const sid = distribution.util.id.getSID(distribution.node.config);
        const gid = this.gid;
        const keys = this.keys;
        const mapped = [];

        const notifyRemote = {
          node: this.coordinator,
          service: this.route,
          method: 'notify',
          gid: 'local',
        };

        let idx = 0;
        const readNext = () => {
          if (idx >= keys.length) {
            const mapKey = sid;
            const mapGid = `${this.mrID}_map`;
            return localStore.put(mapped, {key: mapKey, gid: mapGid}, (e1) => {
              if (e1) {
                return callback(e1);
              }

              return localComm.send(['map', sid, true], notifyRemote, (e2) => {
                if (e2) {
                  return callback(e2);
                }
                return callback(null, mapped);
              });
            });
          }
          const key = keys[idx];
          idx++;
          return localStore.get({key, gid}, (e, value) => {
            if (!e) {
              let map = this.mapper(key, value);
              if (map === null) {
                map = [];
              }

              map.forEach((entry) => {
                  mapped.push(entry);
              });
            }
            return readNext();
          });
        };

        return readNext();
      },
      directToNode: function(
          /** @type {string} */ key,
          /** @type {any} */ value,
          /** @type {Callback} */ callback,
      ) {
        if (!this.shuffled[key]) {
          this.shuffled[key] = [];
        }
        this.shuffled[key].push(value);
        return callback(null, true);
      },
      shuffle: function(
          /** @type {string} */ gid,
          /** @type {string} */ mrID,
          /** @type {Callback} */ callback,
      ) {
        const distribution = globalThis.distribution;
        const localStore = distribution.local.store;
        const localComm = distribution.local.comm;
        const util = distribution.util;
        const sid = util.id.getSID(distribution.node.config);
        const mapKey = sid;
        const mapGid = `${this.mrID}_map`;
        const group = this.group;
        const groupSids = Object.keys(group);

        this.shuffled = {};

        const notifyRemote = {
          node: this.coordinator,
          service: this.route,
          method: 'notify',
          gid: 'local',
        };

        if (groupSids.length === 0) {
          return callback(new Error('group is empty'));
        }

        return localStore.get({key: mapKey, gid: mapGid}, (e, v) => {
          if (e) {
            return callback(e);
          }

            const nids = groupSids.map((groupSid) => util.id.getNID(group[groupSid]));
            const sids = Object.fromEntries(
              groupSids.map((groupSid) => [util.id.getNID(group[groupSid]), groupSid]),
            );
          const toMove = [];

          (v).forEach((entry) => {
            Object.keys(entry).forEach((k) => {
              const kid = util.id.getID(k);
              const targetNid = util.id.naiveHash(kid, nids);
              const targetSid = sids[targetNid];
              if (!targetSid) {
                return;
              }
              toMove.push({node: group[targetSid], key: k, value: entry[k]});
            });
          });

          let idx = 0;
          const sendNext = () => {
            if (idx >= toMove.length) {
              return localComm.send(['shuffle', sid], notifyRemote, (e) => {
                if (e) {
                  return callback(e);
                }
                return callback(null, toMove.length);
              });
            }

            const move = toMove[idx];
            idx++;

            const directToNodeRemote = {
              node: move.node,
              service: this.route,
              method: 'directToNode',
              gid: 'local',
            };
            return localComm.send([move.key, move.value], directToNodeRemote, (e) => {
              if (e) {
                return callback(e);
              }
              return sendNext();
            });
          };

          return sendNext();
        });
      },
      reduce: function(
          /** @type {string} */ gid,
          /** @type {string} */ mrID,
          /** @type {Callback} */ callback,
      ) {
        const distribution = globalThis.distribution;
        const localComm = distribution.local.comm;
        const sid = distribution.util.id.getSID(distribution.node.config);

        const notifyRemote = {
          node: this.coordinator,
          service: this.route,
          method: 'notify',
          gid: 'local',
        };

        this.reduced = [];
        Object.keys(this.shuffled).forEach((key) => {
          const out = this.reducer(key, this.shuffled[key]);
          this.reduced.push(out);
        });

        return localComm.send(['reduce', sid], notifyRemote, (e) => {
          if (e) {
            return callback(e);
          }
          return callback(null, this.reduced);
        });

      },
    };

      const cleanup = (e, v) => {
        return allRoutes.rem(mrGid, (e1) => {
          if (hasErrors(e1)) {
            return callback(e1);
          }
          const localRoutes = distribution.local.routes;
          return localRoutes.rem(mrGid, (e2) => {
            if (hasErrors(e2)) {
              return callback(e2);
            }
            return callback(e, v);
          });
        });
      };

      const waitForPhase = (stage, cb) => {
        const checkCompletion = () => {
          const received = Object.keys(mrService.notifications[stage]).length;
          if (received >= expected) {
            return cb();
          }
          setTimeout(checkCompletion, 0);
        };
        checkCompletion();
      };

      return allRoutes.put(mrService, mrGid, (e, v) => {
        if (hasErrors(e)) {
          return callback(e, v);
        }

        const localRoutes = distribution.local.routes;
        return localRoutes.put(mrService, mrGid, (e) => {
          if (hasErrors(e)) {
            return cleanup(e);
          }

        const target = {service: mrGid, method: 'start', gid: 'local'};
        const message = [{coordinator, route: mrGid}];

        return allComm.send(message, target, (e, v) => {
          if (hasErrors(e)) {
            return cleanup(e, v);
          }

          return waitForPhase('setup', () => {
            const mapTarget = {service: mrGid, method: 'map', gid: 'local'};
            return allComm.send([mrGid, mrID], mapTarget, (e, v) => {
              if (hasErrors(e)) {
                return cleanup(e, v);
              }

              return waitForPhase('map', () => {
                const shuffleTarget = {service: mrGid, method: 'shuffle', gid: 'local'};
                return allComm.send([context.gid, mrID], shuffleTarget, (e, v) => {
                  if (hasErrors(e)) {
                    return cleanup(e, v);
                  }

                  return waitForPhase('shuffle', () => {
                    const reduceTarget = {service: mrGid, method: 'reduce', gid: 'local'};
                    return allComm.send([context.gid, mrID], reduceTarget, (e, v) => {
                      if (hasErrors(e)) {
                        return cleanup(e, v);
                      }

                      return waitForPhase('reduce', () => {
                        const reduced = [];
                        Object.values(v).forEach((node) => {
                          node.forEach((entry) => {
                              reduced.push(entry);
                          });
                        });

                        return cleanup(null, reduced);
                      });
                    });
                  });
                });
              });
            });
          });
        });
        });
      });
    });

  }

  return {exec};
}

module.exports = mr;