// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Config} Config
 * @typedef {import("../types.js").Node} Node
 */

const { setup } = require('../all/all.js');
const { id } = require("../util/util.js");

const groups = {'all': {}};

/**
 * @param {string} name
 * @param {Callback} callback
 */
function get(name, callback) {
  let err = null;
  if (!(name in groups)) {
    err = new Error('Group not found')
    return callback(err, null);
  } else {
    let res = groups[name];
    if (name === 'all') {
      res[id.getSID(distribution.node.config)] = distribution.node.config;
    }
    return callback(err, res)
  }
}

/**
 * @param {Config | string} config
 * @param {Object.<string, Node>} group
 * @param {Callback} callback
 */
function put(config, group, callback) {
  let gid;
  let err;
  let actualConfig = typeof config === 'object' ? config : { gid: config };
  gid = actualConfig.gid;

  if (!gid) {
    return callback(new Error('Gid cannot be empty'), null);
  }
  for (const [key, value] of Object.entries(group)) {
      if (!key || !value) {
        err = new Error('Invalid group format');
        break;
      }
    }
  if (!err) {
    // groups['all'] = {...groups['all'], ...group};
    for (const [key, value] of Object.entries(group)) {
      groups['all'][key] = value;
    }
    distribution[gid] = setup(actualConfig);
    groups[gid] = group;
    return callback(err, groups[gid])
  } else {
    return callback(err, null);
  }
}

/**
 * @param {string} name
 * @param {Callback} callback
 */
function del(name, callback) {
  let err;
  if (!(name in groups)) {
    err = new Error('Group not found')
    return callback(err, null);
  } else {
    let res = groups[name]
    for (const sid in groups[name]) {
      if (sid in groups['all']) {
        delete groups['all'][sid];
      }
    }
    delete groups[name];
    delete distribution[name];
    return callback(err, res)
  } 
}

/**
 * @param {string} name
 * @param {Node} node
 * @param {Callback} callback
 */
function add(name, node, callback) {
  let err;
  if (!(name in groups)) {
    err = new Error('Group not found or Not valid group');
    return callback(err, null);
  }
  if (!node) {
    err = new Error('Cannot add empty node');
    return callback(err, null);
  }
  let sid = id.getSID(node);
  groups[name][sid] = node;
  groups['all'][sid] = node;
  if (!callback) {
    let cb = (err, res) => err ? console.error(err) : console.log(res);
    cb(err, groups[name]);
  } else {
    callback(err, groups[name]);
  }
};

/**
 * @param {string} name
 * @param {string} node
 * @param {Callback} callback
 */
function rem(name, node, callback) {
  let err;
  if (!name || !(name in groups)) {
    err = new Error('Group not found or Not valid group');
    return callback(err, null);
  }
  if (!node) {
    err = new Error('Cannot add empty node');
    return callback(err, null);
  }
  delete groups[name][node];
  if (node in groups['all']) {
    delete groups['all'][node];
  }
  if (!callback) {
    let cb = (err, res) => err ? console.error(err) : console.log(res);
    cb(err, groups[name]);
  } else {
    callback(err, groups[name]);
  }
};

module.exports = {get, put, del, add, rem};
