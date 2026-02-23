// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 */

/**
 * NOTE: This Target is slightly different from local.all.Target
 * @typedef {Object} Target
 * @property {string} service
 * @property {string} method
 * @property {string} [gid]
 *
 * @typedef {Object} Comm
 * @property {(message: any[], configuration: Target, callback: Callback) => void} send
 */

/**
 * @param {Config} config
 * @returns {Comm}
 */
function comm(config) {
  const context = {};
  context.gid = config.gid || 'all';

  /**
   * @param {any[]} message
   * @param {Target} configuration
   * @param {Callback} callback
   */
  function send(message, configuration, callback) {
    distribution.local.groups.get(context.gid, (e, v) => {
      let errors = {};
      let res = {};
      if (e) {
        return callback(e, res);
      }
      const numNodes = Object.keys(v);
      if (numNodes.length === 0) {
        return callback(new Error(`Group ${context.gid} is empty`), null);
      }
      let count = 0;
      numNodes.forEach(id => {
        let node = v[id];
        let remote = {
          service: configuration.service,
          gid: configuration.gid,
          method: configuration.method,
          node: node,
        }
        distribution.local.comm.send(message, remote, (e, v) => {
          if (e) {
            errors[id] = e;
          } else {
            res[id] = v;
          }
          count ++;
          if (count === numNodes.length) {
            return callback(errors, res);
          }
        });
      });
    })
  }
  return {send};
}

module.exports = comm;
