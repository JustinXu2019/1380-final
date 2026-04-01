// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../types.js").Node} Node
 */


/**
 * @typedef {Object} StoreConfig
 * @property {string | null} key
 * @property {string} gid
 *
 * @typedef {StoreConfig | string | null} SimpleConfig
 *
 * @typedef {Object} Mem
 * @property {(configuration: SimpleConfig, callback: Callback) => void} get
 * @property {(state: any, configuration: SimpleConfig, callback: Callback) => void} put
 * @property {(state: any, configuration: SimpleConfig, callback: Callback) => void} append
 * @property {(configuration: SimpleConfig, callback: Callback) => void} del
 * @property {(configuration: Object.<string, Node>, callback: Callback) => void} reconf
 */


/**
 * @param {Config} config
 * @returns {Mem}
 */
function mem(config) {
  const context = {};
  context.gid = config.gid || 'all';
  context.hash = config.hash || globalThis.distribution.util.id.naiveHash;

  /**
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function get(configuration, callback) {
    let key;
    let gid;
    let err = null;

    if (typeof configuration === 'string') {
      key = configuration;
      gid = context.gid;
    } else if (configuration !== null && typeof configuration === 'object') {
      key = configuration.key;
      gid = configuration.gid || context.gid;
    }

  if (!key) {
    // If key is null but gid exists, we want to list all keys in that gid across the cluster
    if (gid) {
        // This requires a broadcast (comm.send to all nodes in GID) 
        // to collect keys from everyone.
        return distribution[gid].comm.send([{key: null, gid: gid}], {service: 'mem', method: 'get'}, (e, v) => {
            const allKeys = Object.values(v).flat();
            callback(e, allKeys);
        });
    }
    return callback(new Error('Key is required'), null);
  }

    distribution.local.groups.get(gid, (e, v) => {
      const nids = Object.values(v).map((n) => distribution.util.id.getNID(n));
      const kid = distribution.util.id.getID(key);
      const nodeId = context.hash(kid, nids);
      const node = Object.values(v).find((n) => distribution.util.id.getNID(n) === nodeId);
      const remote = {node, service: 'mem', method: 'get'}
      const config = {key: key, gid: gid};
      distribution.local.comm.send([config], remote, (e, v) => {
        callback(e, v);
      })
    })
  }

  /**
   * @param {any} state
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function put(state, configuration, callback) {  
    let key;
    let gid = context.gid;
    let err = null;

    if (typeof configuration === 'string') {
      key = configuration;
      gid = context.gid;
    } else if (configuration !== null && typeof configuration === 'object') {
      key = configuration.key;
      gid = configuration.gid || context.gid;
    } else if (configuration === null) {
      key = distribution.util.id.getID(state);
    }



    distribution.local.groups.get(gid, (e, v) => {
      if (e) {
        return callback(e, null);
      }
      const nids = Object.values(v).map((n) => distribution.util.id.getNID(n));
      let kid;
      kid = distribution.util.id.getID(key);
      const nodeId = context.hash(kid, nids);
      const node = Object.values(v).find((n) => distribution.util.id.getNID(n) === nodeId);
      const remote = {node, service: 'mem', method: 'put'}
      const config = {key: key, gid: gid};
      distribution.local.comm.send([state, config], remote, (e, v) => {
        callback(e, v);
      })
    })
  }

  /**
   * @param {any} state
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function append(state, configuration, callback) {
    // You'll need to implement this method for the distributed processing milestone.
    let key;
    let gid = context.gid;
    if (typeof configuration === 'string') {
      key = configuration;
    } else if (configuration !== null && typeof configuration === 'object') {
      key = configuration.key;
      gid = configuration.gid || context.gid;
    }

    if (!key) {
      return callback(new Error('Key is required for append'), null);
    }

    distribution.local.groups.get(gid, (e, v) => {
      if (e || !v) return callback(e || new Error('Group not found'), null);

      const nids = Object.values(v).map((n) => distribution.util.id.getNID(n));
      const kid = distribution.util.id.getID(key);
      const nodeId = context.hash(kid, nids);
      
      const node = Object.values(v).find((n) => distribution.util.id.getNID(n) === nodeId);
      
      const remote = { node, service: 'mem', method: 'append' };
      const config = { key: key, gid: gid };
      
      distribution.local.comm.send([state, config], remote, (err, result) => {
        callback(err, result);
      });
    });
  }

  /**
   * @param {SimpleConfig} configuration
   * @param {Callback} callback
   */
  function del(configuration, callback) {
    let key;
    let gid;
    let err = null;
    if (typeof configuration === 'string') {
      key = configuration;
      gid = context.gid;
    } else if (configuration !== null && typeof configuration === 'object') {
      key = configuration.key;
      gid = configuration.gid || context.gid;
    }

    if (!key) {
      err = new Error('Key is required');
      return callback(err, null);
    }

    distribution.local.groups.get(gid, (e, v) => {
      const nids = Object.values(v).map((n) => distribution.util.id.getNID(n));
      const kid = distribution.util.id.getID(key);
      const nodeId = context.hash(kid, nids);
      const node = Object.values(v).find((n) => distribution.util.id.getNID(n) === nodeId);
      const remote = {node, service: 'mem', method: 'del'}
      const config = {key: key, gid: gid};
      distribution.local.comm.send([config], remote, (e, v) => {
        callback(e, v);
      })
    })
  }

  /**
   * @param {Object.<string, Node>} configuration
   * @param {Callback} callback
   */
  function reconf(configuration, callback) {
    return callback(new Error('mem.reconf not implemented'));
  }
  /* For the distributed mem service, the configuration will
          always be a string */
  return {
    get,
    put,
    append,
    del,
    reconf,
  };
}

module.exports = mem;
