// @ts-check
const { performance } = require('perf_hooks');

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
    if (value && typeof value === 'object' && typeof value.type === 'string' && supportedTypes.includes(value.type)) {
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

// const ITERATIONS = 1000;
// const reportStore = []; // In-memory storage for final reporting

// function runBenchmark(name, data) {
//     let totalSer = 0;
//     let totalDes = 0;

//     // Warm-up (helps V8 optimize the code before measurement)
//     for (let j = 0; j < 100; j++) {
//         deserialize(serialize(data));
//     }

//     for (let i = 0; i < ITERATIONS; i++) {
//         const s0 = performance.now();
//         const json = serialize(data);
//         const s1 = performance.now();

//         const d0 = performance.now();
//         deserialize(json);
//         const d1 = performance.now();

//         totalSer += (s1 - s0);
//         totalDes += (d1 - d0);
//     }

//     reportStore.push({
//         test: name,
//         avgSer: (totalSer / ITERATIONS).toFixed(5),
//         avgDes: (totalDes / ITERATIONS).toFixed(5),
//         size: Buffer.byteLength(serialize(data))
//     });
// }

// // --- Test 1: Primitives ---
// runBenchmark("Small Primitives", { id: 1, name: "test", active: true, val: undefined });

// // --- Test 2: Function Objects ---
// runBenchmark("Functions", { 
//     fn: (a, b) => a + b, 
//     nested: { fn2: () => "hello" } 
// });

// // --- Test 3: Complex Structures (Varying Sizes) ---
// const complexBase = {
//     date: new Date(),
//     err: new Error("fail"),
//     list: [1, 2, 3]
// };
// runBenchmark("Complex (Small)", complexBase);

// // Scaling up for "Varying Sizes" requirement
// const largeData = Array.from({ length: 500 }, (_, i) => ({
//     id: i,
//     timestamp: new Date(),
//     error: new Error(`Error ${i}`),
//     meta: { active: i % 2 === 0 }
// }));
// runBenchmark("Complex (Large/Array)", largeData);

// // --- Final Output ---
// console.table(reportStore);

module.exports = {
  serialize,
  deserialize,
};
