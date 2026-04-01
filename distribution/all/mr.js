// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../util/id.js").NID} NID
 */

const id = require('../util/id.js');

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

/**
 * @param {Config} config
 * @returns {Mr}
 */
function mr(config) {
  const context = {
    gid: config.gid || 'all',
  };

  /**
   * @param {MRConfig} configuration
   * @param {Callback} callback
   * @returns {void}
   */
  function exec(configuration, callback) {
    const mrID = id.getID(`${configuration}${Date.now()}`);
    const serviceName = `mr-${mrID}`
    /*
      MapReduce steps:
      1) Setup: register a service `mr-<id>` on all nodes in the group. The service implements the map, shuffle, and reduce methods.
      2) Map: make each node run map on its local data and store them locally, under a different gid, to be used in the shuffle step.
      3) Shuffle: group values by key using store.append.
      4) Reduce: make each node run reduce on its local grouped values.
      5) Cleanup: remove the `mr-<id>` service and return the final output.

      Note: Comments inside the stencil describe a possible implementation---you should feel free to make low- and mid-level adjustments as needed.
    */
    const mrService = {
      mapper: configuration.map,
      reducer: configuration.reduce,
      map: function(
          /** @type {string[]} */ keys,
          /** @type {string} */ gid,
          /** @type {string} */ mrID,
          /** @type {Callback} */ callback,
      ) {
        // Map should read the node's local keys under the mrGid gid and write to store under gid `${mrID}_map`.
        // Expected output: array of objects with a single key per object.
        if (!keys || keys.length === 0) {
          globalThis.distribution.local.store.put([], mrID + '_map', function(err, v) {
            return callback(null, []);
          });
          return;
        }
        const mappedResults = [];
        let completedCount = 0;
        const self = this;

        keys.forEach((key) => {
          globalThis.distribution[gid].store.get(key, (e, v) => {
            completedCount++;
            const result = self.mapper(key, v);
            if (Array.isArray(result)) {
              mappedResults.push(...result);
            } else {
              mappedResults.push(result);
            }
            if (completedCount === keys.length) {
              globalThis.distribution.local.store.put(mappedResults, mrID + '_map', (putErr) => {
                callback(putErr, mappedResults);
              });
            }
          });
        }); 
      },
      shuffle: function(
          /** @type {string} */ gid,
          /** @type {string} */ mrID,
          /** @type {Callback} */ callback,
      ) {
        // Fetch the mapped values from the local store
        // Shuffle groups values by key (via store.append).
        // 1. Retrieve the results from the Map phase
        globalThis.distribution.local.store.get(mrID + '_map', (e, mappedData) => {
          if (e) return callback(e, {})
          if (!mappedData || mappedData.length === 0) {
            return callback(null, []);
          }
          let appendCount = 0;
          mappedData.forEach((item) => {
            const [key] = Object.keys(item);
            const value = item[key];
            distribution[gid].mem.append(value, { key: key, gid: gid }, (appErr) => {
              appendCount++;
              if (appendCount === mappedData.length) {
                callback(null, mappedData);
              }
            });
          });
        });
      },
      reduce: function(
          /** @type {string} */ gid,
          /** @type {string} */ mrID,
          /** @type {Callback} */ callback,
      ) {
          const self = this;
          // Get keys that landed on THIS node under this gid
          distribution.local.mem.get({ key: null, gid: gid }, (e, keys) => {
            if (e || !keys || keys.length === 0) {
              return callback(null, null);
            }
            let finalResults = [];
            let processedKeys = 0;
            keys.forEach((key) => {
              distribution.local.mem.get({ key: key, gid: gid }, (getErr, values) => {
                const reducedValue = self.reducer(key, values);
                if (Array.isArray(reducedValue)) {
                  finalResults.push(...reducedValue);
                } else {
                  finalResults.push(reducedValue);
                }
                processedKeys++;
                if (processedKeys === keys.length) {
                  callback(null, finalResults);
                }
              });
            });
          });
      },
    };
    // Register the mr service on all nodes in the group and execute in sequence: map, shuffle, reduce.
    distribution[context.gid].routes.put(mrService, serviceName, (e, v) => {
      if (e && Object.keys(e).length > 0) {
        return callback(e, null)
      }
      distribution.local.groups.get(context.gid, (e, nodes) => {
        if (e) {
          return callback(e, null)
        }
        const nodeIds = Object.keys(nodes)

        const partitions = {}
        nodeIds.forEach(nodeID => partitions[nodeID] = [])
        configuration.keys.forEach(key => {
          const kid = id.getID(key)
          const targetNode = id.naiveHash(kid, nodeIds)
          partitions[targetNode].push(key)
        })
        let nodesDone = 0
        const totalNodes = nodeIds.length

        for (const nodeID of nodeIds) {
          const args = [partitions[nodeID], context.gid, mrID,];
          distribution.local.comm.send(args, { node: nodes[nodeID], service: serviceName, method: 'map' }, (mapErr, v) => {
            nodesDone++
            if (nodesDone === totalNodes) {
              distribution[context.gid].comm.send([context.gid, mrID], { service: serviceName, method: 'shuffle' }, (e, v) => {
                distribution[context.gid].comm.send([context.gid, mrID], { service: serviceName, method: 'reduce' }, (e, v) => {
                  const finalResults = [];
                    for (const nodeResult of Object.values(v)) {
                      if (nodeResult !== null) {
                        for (const item of nodeResult) {
                          finalResults.push(item);
                        }
                      }
                    }
                  globalThis.distribution[context.gid].routes.rem(serviceName, (e, v) => {
                    callback(null, finalResults);
                  });
                })
              })
            }
          })
        }
      })
    })
  }

  return {exec};
}

module.exports = mr;