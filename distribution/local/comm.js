// @ts-check
/**
 * @typedef {import("../types.js").Callback} Callback
 * @typedef {import("../types.js").Node} Node
 */

const http = require('node:http');
const util = require('../util/serialization.js');

/**
 * @typedef {Object} Target
 * @property {string} service
 * @property {string} method
 * @property {Node} node
 * @property {string} [gid]
 */

/**
 * @param {Array<any>} message
 * @param {Target} remote
 * @param {(error: Error, value?: any) => void} callback
 * @returns {void}
 */
function send(message, remote, callback) {

  const finalCallback = callback || ((err, data) => err ? console.error(err) : console.log(data));

  let res = null;
  let err = null;

  if (!message || !remote || !remote.node.ip || !remote.node.port) {
    err = new Error('Missing message or remote configuration')
    return finalCallback(err, res);
  }

  let gid = remote.gid ? remote.gid : 'local';

  const postData = util.serialize({
    args: message
  })


  const options = {
    hostname: remote.node.ip,
    port: remote.node.port,
    path: `/${gid}/${remote.service}/${remote.method}`,
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      },
  };

  res = http.request(options, (response) => {
      let body = '';

      response.setEncoding('utf8');

      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => {
          try {
            const result = distribution.util.deserialize(body);
            finalCallback(result[0], result[1])
          } catch (error) {
            finalCallback(new Error('Error response'), null);
          }
      });
  });
  res.on('error', (err) => {
    new Error(`Network level error: ${err.message}`);
    finalCallback(err, null);
  });
  res.write(postData);
  res.end();
}

module.exports = {send};
