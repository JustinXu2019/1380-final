require('../../distribution.js')();
const distribution = globalThis.distribution;
const util = distribution.util;

test('(3 pts) (scenario) 40 bytes object', () => {
  /*
          Come up with a JavaScript object, which when serialized,
          will result in a string that is 40 bytes in size.
      */
  let object = null;
  object = "123456789012";
  const serialized = util.serialize(object);
  expect(serialized.length).toEqual(40);
});

test('(3 pts) (scenario) expected object', () => {
  /* Prepare an object so it results in an expected serialized string. */
  let object = null;
  object = { a: null }
  let serializedObject = '{"type":"object","value":{"a":{"type":"null","value":""}}}'; /* Add here the expected serialized string by using util.serialize */
  expect(util.serialize(object)).toEqual(serializedObject);
});

test('(3 pts) (scenario) string deserialized into target object', () => {
  /*
          Come up with a string that when deserialized, results in the following object:
          {a: 1, b: "two", c: false}
      */

  let string = null;
  string = '{"type":"object","value":{"a":{"type":"number","value":"1"}}}';
  const object = { a: 1 };
  const deserialized = util.deserialize(string);
  expect(object).toEqual(deserialized);
});

test('(3 pts) (scenario) object with all supported data types', () => {
/* Come up with an object that uses all valid (serializable)
    built-in data types supported by the serialization library. */
  let object = null;
  f = (a, b) => (a + b);
  object = [[], new Date(), new Error("inside array"), new Object(), true, f, null, 67, {}, "something", undefined]
  const setTypes = [];
  for (const k in object) {
    setTypes.push(typeof object[k]);
    if (typeof object[k] == 'object' && object[k] != null) {
      setTypes.push(object[k].constructor.name);
    } else if (typeof object[k] == 'object' && object[k] == null) {
      setTypes.push('null');
    }
  }

  const typeList = setTypes.sort();
  const goalTypes = ['Array', 'Date', 'Error', 'Object',
    'boolean', 'function', 'null', 'number', 'object', 'string', 'undefined'];
  expect(typeList).toEqual(expect.arrayContaining(goalTypes));

  const serialized = util.serialize(object);
  const deserialized = util.deserialize(serialized);
  expect(deserialized).not.toBeNull();

  // Deleting functions because they are not treated as equivalent by Jest
  for (const k in object) {
    if (typeof object[k] == 'function') {
      delete object[k];
      delete deserialized[k];
    }
  }
  expect(deserialized).toEqual(object);
});

test('(3 pts) (scenario) malformed serialized string', () => {
/* Come up with a string that is not a valid serialized object. */

  let malformedSerializedString = null;
  malformedSerializedString = "something\nsomething\here where"

  expect(() => {
    util.deserialize(malformedSerializedString);
  }).toThrow(SyntaxError);
});


