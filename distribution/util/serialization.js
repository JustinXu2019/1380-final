// @ts-check

/**
 * @param {any} object
 * @returns {string}
 */
function serialize(object) {
  return JSON.stringify(object, function(key, value) {
    const originalValue = this[key];
    if (originalValue instanceof Date) {
        return {type: 'date', value: originalValue.toISOString()};
    } else if (typeof originalValue === 'undefined') {
        return {type: 'undefined'}
    } else if (originalValue === Infinity) {
        return {type: 'Infinity', value: originalValue.toString()} 
    } else if (typeof originalValue === 'bigint') {
        return {type: 'bigint', value: originalValue.toString()}
    } else if (Number.isNaN(originalValue)) {
        return {type: 'NaN', originalValue: originalValue.toString()}
    } else if (typeof originalValue === 'function') {
        return {type: 'function', value: originalValue.toString()}
    } else if (originalValue instanceof Error) {
        return {type: 'error', value: originalValue.toString()}
    }
    return value
  })
}


/**
 * @param {string} string
 * @returns {any}
 */
function deserialize(string) {
  if (typeof string !== 'string') {
    throw new Error(`Invalid argument type: ${typeof string}.`);
  }
  const supportedTypes = [
    "bigint", "undefined", "Infinity", "NaN", 
    "null", "function", "error", "date"
  ];
  const parsed = JSON.parse(string, (key, value) => {
    if (value && typeof value === 'object' && value.type) {
      if (!supportedTypes.includes(value.type)) {
        throw new Error(`Unknown serialized type: ${value.type}`);
      }
      switch (value.type) {
        case "bigint":
          return BigInt(value.value)
        case "undefined":
          return undefined;
        case "Infinity":
          return Infinity;
        case "NaN":
          return Number(value.value)
        case "null":
          return null
        case "function":
          return new Function('return ' + value.value)()
        case "error":
          return Error(value.value.slice(7))
        case "date":
          return new Date(value.value)
      }
    }
    return value
  });
  return parsed;
}

module.exports = {
  serialize,
  deserialize,
};
