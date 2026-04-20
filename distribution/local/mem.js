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

const id = globalThis.distribution.util.id;
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
  // You'll need to implement this method for the distributed processing milestone.
  let key = '';
  let gid = 'local';
  let innerKey;

  if (configuration !== null && typeof configuration === 'object') {
    gid = configuration.gid === null ? 'local' : configuration.gid;
    innerKey = configuration.key;
  } else {
    innerKey = configuration;
  }
  
  key = gid + "::" + innerKey;
  if (!(key in localmap)) {
    localmap[key] = [];
  }
  if (!Array.isArray(localmap[key])) {
    localmap[key] = [localmap[key]];
  }

  localmap[key].push(state);

  return callback(null, localmap[key]);
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
  if (configuration !== null && typeof configuration === 'object' && configuration.key === null) {
    const gid = configuration.gid === null ? 'local' : configuration.gid;
    const prefix = gid + '::';
    const matchingKeys = Object.keys(localmap)
      .filter(k => k.startsWith(prefix))
      .map(k => k.slice(prefix.length));
    return callback(null, matchingKeys);
  }
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
