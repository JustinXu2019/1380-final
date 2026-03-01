// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 *
 * @typedef {Object} StoreConfig
 * @property {string | null} key
 * @property {string | null} gid
 *
 * @typedef {StoreConfig | string | null} SimpleConfig
 */

const id = distribution.util.id;
const localmap = {};

/**
 * @param {any} state
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function put(state, configuration, callback) {
  let key = '';
  let first;
  let second;
  let err; 
  let res;
  if (configuration !== null && typeof configuration === 'object') {
    first = configuration.gid === null ? 'local' : configuration.gid;
    second = configuration.key ? configuration.key : id.getID(state);
    key = first + "::" + second;
  } else {
    first = 'local';
    second = configuration ? configuration : id.getID(state);
    key = first + "::" + second;
  }
  if (key in localmap) {
    err = null;
    if (state === localmap[key]) {
      res = localmap[key]
    } else {
      localmap[key] = state;
      res = localmap[key];
    }
    return callback(err, res);
  } else {
    localmap[key] = state;
    err = null;
    res = localmap[key];
    return callback(err, res);
  }
};

/**
 * @param {any} state
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function append(state, configuration, callback) {
  return callback(new Error('mem.append not implemented')); // You'll need to implement this method for the distributed processing milestone.
};

/**
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function get(configuration, callback) {
  let key = '';
  let first;
  let second;
  let err;
  let res;
  if (configuration !== null && typeof configuration === 'object') {
    first = configuration.gid === null ? 'local' : configuration.gid;
    second = configuration.key;
    key = first + "::" + second;
  } else {
    first = 'local';
    second = configuration;
    key = first + "::" + second;
  }
  if (key in localmap) {
    err = null;
    res = localmap[key];
    return callback(err, res);
  } else {
    err = new Error('Key not in memory');
    res = null;
    return callback(err, res);
  }
}

/**
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function del(configuration, callback) {
  let key = '';
  let first;
  let second;
  let err;
  let res;
  if (configuration !== null && typeof configuration === 'object') {
    first = configuration.gid === null ? 'local' : configuration.gid;
    second = configuration.key;
    key = first + "::" + second;
  } else {
    first = 'local';
    second = configuration;
    key = first + "::" + second;
  }
  if (key in localmap) {
    err = null;
    res = localmap[key];
    delete localmap[key];
    return callback(err, res);
  } else {
    err = new Error('Key not in memory');
    res = null;
    return callback(err, res);
  }
};

module.exports = {put, get, del, append};
