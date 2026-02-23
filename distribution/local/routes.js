/**
 * @typedef {import("../types").Callback} Callback
 * @typedef {string} ServiceName
 */

/**
 * @param {ServiceName | {service: ServiceName, gid?: string}} configuration
 * @param {Callback} callback
 * @returns {void}
 */
function get(configuration, callback) {
  if (!configuration) {
    return callback(new Error("no route.get() configuration provided"));
  }
  
  const isString = typeof configuration === 'string';
  const name = isString ? configuration : configuration.service;
  const gid = isString ? 'local' : (configuration.gid || 'local');

  let res = null;
  let err = null;

  try {
    if (distribution.local && distribution.local[name]) {
      res = distribution.local[name];
    } else if (gid !== 'local' && distribution[gid] && distribution[gid][name]) {
      res = distribution[gid][name];
    } else {
      err = new Error(`Service ${name} not found`);
    }
  } catch (e) {
    err = e;
  }

  return callback(err, res);
}

/**
 * @param {object} service
 * @param {string} configuration
 * @param {Callback} callback
 * @returns {void}
 */
function put(service, configuration, callback) {
  const local = distribution.local
  let res = null;
  let err = null;
  if (!service && !configuration) {
    err = new Error('No routes.put() service or configuration provided');
  } else if (!service) {
    err = new Error('No routes.put() service provided');
  } else if (!configuration) {
    err = new Error('No routes.put() configuration provided')
  }
  if (!err) {
    local[configuration] = service;
    res = service;
  }
  if (!callback) {
    let cb = (err, res) => err ? console.error(err) : console.log(res);
    cb(err, res);
  }
  callback(err, res);
}

/**
 * @param {string} configuration
 * @param {Callback} callback
 */
function rem(configuration, callback) {
  const local = distribution.local;
  let res = null;
  let err = null;
  if (!configuration) {
    err = new Error('No routes.rem() configuration')
  }
  if (!err) {
    res = local[configuration];
    delete local[configuration];
  }
  if (!callback) {
    let cb = (err, res) => err ? console.error(err) : console.log(res);
    cb(err, res);
  }
  callback(err, res);
}

module.exports = {get, put, rem};
