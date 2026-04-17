// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 *
 * @typedef {Object} StoreConfig
 * @property {?string} key
 * @property {?string} gid
 *
 * @typedef {StoreConfig | string | null} SimpleConfig
 */

/* Notes/Tips:

- Use absolute paths to make sure they are agnostic to where your code is running from!
  Use the `path` module for that.
*/

const path = require('node:path');
const fs = require('fs');
const id = globalThis.distribution.util.id;
const ROOT_STORE_DIR = path.resolve(process.cwd(), 'store');
const nid = id.getNID(globalThis.distribution.node.config);
const NODE_SPECIFIC_DIR = path.join(ROOT_STORE_DIR, `node_${nid}`);

if (!fs.existsSync(NODE_SPECIFIC_DIR)) {
  fs.mkdirSync(NODE_SPECIFIC_DIR, { recursive: true });
}

/**
 * @param {any} state
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function put(state, configuration, callback) {
  let key;
  let first;
  let second;
  let err = null;
  let res = null;
  if (configuration !== null && typeof configuration === 'object') {
    first = configuration.gid === null ? null : configuration.gid;
    second = configuration.key ? configuration.key : id.getID(state);
    second = second.replace(/[^a-zA-Z0-9]/g, '');
    key = first + "::" + second;
  } else {
    first = null;
    second = configuration ? configuration : id.getID(state);
    second = second.replace(/[^a-zA-Z0-9]/g, '');
    key = first + "::" + second;
  }
  let finalPath = path.join(NODE_SPECIFIC_DIR, key);
  fs.writeFile(finalPath, distribution.util.serialize(state), (error) => {
    if (error) {
      err = error;
      return callback(err, res);
    } else {
      return callback(err, state);
    }
  });
}

/**
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function get(configuration, callback) {
  let key;
  let first;
  let second;
  let err = null;
  let res = null;
  if (configuration !== null && typeof configuration === 'object') {
    first = configuration.gid === null ? null : configuration.gid;
    second = configuration.key ? configuration.key : id.getID(state);
    second = second.replace(/[^a-zA-Z0-9]/g, '');
    key = first + "::" + second;
  } else {
    first = null;
    second = configuration ? configuration : id.getID(state);
    second = second.replace(/[^a-zA-Z0-9]/g, '');
    key = first + "::" + second;
  }
  let finalPath = path.join(NODE_SPECIFIC_DIR, key);
  fs.readFile(finalPath, (error, data) => {
    if (error) {
      err = new Error(`Error is ${error}`);
      return callback(err, res);
    } else {
      return callback(err, distribution.util.deserialize(data.toString()));
    }
  })
}

/**
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
function del(configuration, callback) {
  let key;
  let first;
  let second;
  let err = null;
  let res = null;
  if (configuration !== null && typeof configuration === 'object') {
    first = configuration.gid === null ? null : configuration.gid;
    second = configuration.key ? configuration.key : id.getID(state);
    second = second.replace(/[^a-zA-Z0-9]/g, '');
    key = first + "::" + second;
  } else {
    first = null;
    second = configuration ? configuration : id.getID(state);
    second = second.replace(/[^a-zA-Z0-9]/g, '');
    key = first + "::" + second;
  }
  let finalPath = path.join(NODE_SPECIFIC_DIR, key);
  fs.readFile(finalPath, (rerror, data) => {
    if (rerror) {
      err = new Error(`Error is ${rerror}`)
      return callback(err, res);
    } else {
      fs.unlink(finalPath, (derror) => {
        if (derror) {
          err = new Error(`Error is ${derror}`);
          return callback(err, res)
        } else {
          res = distribution.util.deserialize(data.toString());
          return callback(err, res)
        }
      })
    }
  })
}

/**
 * @param {any} state
 * @param {SimpleConfig} configuration
 * @param {Callback} callback
 */
const appendQueues = new Map();

function append(state, configuration, callback) {
  let first;
  let second;
  let key;

  if (configuration !== null && typeof configuration === 'object') {
    first = configuration.gid === null ? null : configuration.gid;
    second = configuration.key ? configuration.key : id.getID(state);
    second = second.replace(/[^a-zA-Z0-9]/g, '');
    key = first + '::' + second;
  } else {
    first = null;
    second = configuration ? configuration : id.getID(state);
    second = second.replace(/[^a-zA-Z0-9]/g, '');
    key = first + '::' + second;
  }

  if (!appendQueues.has(key)) appendQueues.set(key, []);
  const queue = appendQueues.get(key);
  queue.push({state, callback});
  if (queue.length > 1) return;

  const drain = () => {
    if (!queue.length) { appendQueues.delete(key); return; }
    const {state: s, callback: cb} = queue[0];
    const finalPath = path.join(NODE_SPECIFIC_DIR, key);
    fs.readFile(finalPath, (err, data) => {
      let list = [];
      if (!err) {
        try {
          const v = distribution.util.deserialize(data.toString());
          list = Array.isArray(v) ? v : [v];
        } catch (_) {}
      }
      list.push(s);
      fs.writeFile(finalPath, distribution.util.serialize(list), (e) => {
        queue.shift();
        cb(e || null, e ? undefined : list);
        drain();
      });
    });
  };
  drain();
}

module.exports = {put, get, del, append};
