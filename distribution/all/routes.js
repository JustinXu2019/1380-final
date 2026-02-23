// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 *
 * @typedef {Object} Routes
 * @property {(service: object, name: string, callback: Callback) => void} put
 * @property {(configuration: string, callback: Callback) => void} rem
 */

/**
 * @param {Config} config
 * @returns {Routes}
 */
function routes(config) {
  const context = {};
  context.gid = config.gid || 'all';

  /**
   * @param {object} service
   * @param {string} name
   * @param {Callback} callback
   */
  function put(service, name, callback) {
    const remoteConfig = { 
      service: 'routes', 
      method: 'put', 
      gid: 'local' 
    };

    distribution[context.gid].comm.send([service, name], remoteConfig, (errors, values) => {
      callback(errors || {}, values);
    });
  }

  /**
   * @param {string} configuration
   * @param {Callback} callback
   */
  function rem(configuration, callback) {
    const remoteConfig = { 
      service: 'routes', 
      method: 'rem', 
      gid: 'local'
    };

    distribution[context.gid].comm.send([configuration], remoteConfig, (errors, values) => {
      callback(errors || {}, values);
    });
  }

  return {put, rem};
}

module.exports = routes;
