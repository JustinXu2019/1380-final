// @ts-check
/**
 * @typedef {import("../types.js").Node} Node
 * @typedef {import("../types.js").ID} ID
 * @typedef {import("../types.js").NID} NID
 * @typedef {import("../types.js").SID} SID
 * @typedef {import("../types.js").Hasher} Hasher
 */

const assert = require('assert');
const crypto = require('crypto');

/**
 * @param {any} obj
 * @returns {ID}
 */
function getID(obj) {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(obj));
  return hash.digest('hex');
}

/**
 * The NID is the SHA256 hash of the JSON representation of the node
 * @param {Node} node
 * @returns {NID}
 */
function getNID(node) {
  node = {ip: node.ip, port: node.port};
  return getID(node);
}

/**
 * The SID is the first 5 characters of the NID
 * @param {Node} node
 * @returns {SID}
 */
function getSID(node) {
  return getNID(node).substring(0, 5);
}

/**
 * @param {any} message
 * @returns {string}
 */
function getMID(message) {
  const msg = {};
  msg.date = new Date().getTime();
  msg.mss = message;
  return getID(msg);
}

/**
 * @param {string} id
 * @returns {bigint}
 */
function idToNum(id) {
  assert(typeof id === 'string', 'idToNum: id is not in KID form!');
  const trimmed = id.startsWith('0x') ? id.slice(2) : id;
  if (/^[0-9a-fA-F]+$/.test(trimmed)) {
    return BigInt(`0x${trimmed}`);
  }
  return BigInt(id);
}

/** @type { Hasher } */
const naiveHash = (kid, nids) => {
  const sortedNids = [...nids].sort();
  const index = Number(idToNum(kid) % BigInt(sortedNids.length));
  return sortedNids[index];
};

/** @type { Hasher } */
const consistentHash = (kid, nids) => {
  const mapping = new Map();
  const bigIntNids = nids.map(nid => {
    const b = idToNum(nid);
    mapping.set(b, nid);
    return b;
  });

  const kidNum = idToNum(kid);
  bigIntNids.push(kidNum);
  bigIntNids.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const kidIdx = bigIntNids.indexOf(kidNum);
  
  const targetIdx = (kidIdx + 1) % bigIntNids.length;
  const resultBigInt = bigIntNids[targetIdx];

  return mapping.get(resultBigInt);
};

/** @type { Hasher } */
const rendezvousHash = (kid, nids) => {
  const weightedNodes = nids.map(nid => {
    const combined = `${kid}${nid}`;
    const weight = idToNum(getID(combined));
    return { nid, weight };
  });
  weightedNodes.sort((a, b) => {
    if (a.weight < b.weight) return -1;
    if (a.weight > b.weight) return 1;
    return 0;
  });
  const maxNode = weightedNodes[weightedNodes.length - 1];
  return maxNode.nid;
};

module.exports = {
  getID,
  getNID,
  getSID,
  getMID,
  naiveHash,
  consistentHash,
  rendezvousHash,
};
