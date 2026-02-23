// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../util/id.js").Node} Node
 *
 * @typedef {Object} Groups
 * @property {(config: Config | string, group: Object.<string, Node>, callback: Callback) => void} put
 * @property {(name: string, callback: Callback) => void} del
 * @property {(name: string, callback: Callback) => void} get
 * @property {(name: string, node: Node, callback: Callback) => void} add
 * @property {(name: string, node: string, callback: Callback) => void} rem
 */

/**
 * @param {Config} config
 * @returns {Groups}
 */
function groups(config) {
  const context = {gid: config.gid || 'all'};

  /**
   * @param {Config | string} config
   * @param {Object.<string, Node>} group
   * @param {Callback} callback
   */
  function put(config, group, callback) {
    distribution.local.groups.put(config, group, (e, v) => {
      let confg = {service: 'groups', method: 'put'};
      distribution[context.gid].comm.send([config, group], confg, (e, v) => {
        callback(e || {}, v);
      })
    })
  }

  /**
   * @param {string} name
   * @param {Callback} callback
   */
  function del(name, callback) {
    distribution.local.groups.del(name, (e, v) => {
      let confg = {service: 'groups', method: 'del'};
      distribution[context.gid].comm.send([name], confg, (e, v) => {
        callback(e || {}, v);
      })
    })
  }

  /**
   * @param {string} name
   * @param {Callback} callback
   */
  function get(name, callback) {
    let remoteConfig = {service: 'groups', method: 'get'};
    distribution[context.gid].comm.send([name], remoteConfig, (errors, values) => {
      callback(errors || {}, values);
    });
  }

  /**
   * @param {string} name
   * @param {Node} node
   * @param {Callback} callback
   */
  function add(name, node, callback) {
    distribution.local.groups.get(name, (e, v) => {
      if (e) return callback(e, null);
      const sid = distribution.util.id.getSID(node);
      const updatedGroup = {...v, [sid]: node};
      put(name, updatedGroup, callback);
    });
  }

  /**
   * @param {string} name
   * @param {string} node
   * @param {Callback} callback
   */
  function rem(name, node, callback) {
      distribution.local.groups.get(name, (e, v) => {
      if (e) return callback(e, null);
      const updatedGroup = {...v};
      delete updatedGroup[node];
      put(name, updatedGroup, callback);
    });
  }

  return {
    put, del, get, add, rem,
  };
}

module.exports = groups;
