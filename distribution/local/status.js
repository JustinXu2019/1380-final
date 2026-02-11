// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Node} Node
 */

const { id } = require("../util/util.js");
const node = require("./node.js");

/**
 * @param {string} configuration
 * @param {Callback} callback
 */
function get(configuration, callback) {
  let res = null;
  let err = null;
  if (configuration === 'nid') {
    res = id.getNID(node.config);
  } else if (configuration == 'sid') {
    res = id.getSID(node.config);
  } else if (configuration == 'ip') {
    res = node.config.ip;
  } else if (configuration == 'port') {
    res = node.config.port;
  } else if (configuration == 'counts') {
    res = node.nodeState.messageCount;
  } else if (configuration == 'heapTotal') {
    res = process.memoryUsage().heapTotal;
  } else if (configuration == 'heapUsed') {
    res = process.memoryUsage().heapUsed;
  } else if (!configuration) {
    res = id.getNID(node.config);
  } else  {
    err = new Error("Invalid status.get() configuration");
  }
  if (!callback) {
    let cb = (err, res) => err ? console.error(err) : console.log(res);
    cb(err, res);
  } else {
    callback(err, res);
  }
};


/**
 * @param {Node} configuration
 * @param {Callback} callback
 */
function spawn(configuration, callback) {
  callback(new Error('status.spawn not implemented'));
}

/**
 * @param {Callback} callback
 */
function stop(callback) {
  callback(new Error('status.stop not implemented'));
}

module.exports = {get, spawn, stop};
