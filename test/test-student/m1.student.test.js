/*
    In this file, add your own test cases that correspond to functionality introduced for each milestone.
    You should fill out each test case so it adequately tests the functionality you implemented.
    You are left to decide what the complexity of each test case should be, but trivial test cases that abuse this flexibility might be subject to deductions.

    Imporant: Do not modify any of the test headers (i.e., the test('header', ...) part). Doing so will result in grading penalties.
*/

const distribution = require('../../distribution.js')();
require('../helpers/sync-guard');

test('(1 pts) student test', () => {
  // numbers test
  const negative = -20
  const serialized = distribution.util.serialize(negative);
  const deserialized = distribution.util.deserialize(serialized);
  expect(deserialized).toEqual(negative);
});


test('(1 pts) student test', () => {
  // string test
  const specialString = "Line one\nLine two\tTabbed \"Quotes\"";
  const serialized = distribution.util.serialize(specialString);
  const deserialized = distribution.util.deserialize(serialized);
  expect(deserialized).toBe(specialString);
});


test('(1 pts) student test', () => {
  // null test
  const obj = { emptyArr: [], emptyObj: {}, emptyStr: "" };
  const serialized = distribution.util.serialize(obj);
  const deserialized = distribution.util.deserialize(serialized);
  
  expect(deserialized.emptyArr).toEqual([]);
  expect(deserialized.emptyObj).toEqual({});
  expect(deserialized.emptyStr).toBe("");
});

test('(1 pts) student test', () => {
  const object = {
    "123": "numeric key",
    "has spaces": true,
    "": "empty key"
  };
  const serialized = distribution.util.serialize(object);
  const deserialized = distribution.util.deserialize(serialized);
  
  expect(deserialized["123"]).toBe("numeric key");
  expect(deserialized[""]).toBe("empty key");
});

test('(1 pts) student test', () => {
  // undefined test
  const array = [1, , , 4];
  const serialized = distribution.util.serialize(array);
  const deserialized = distribution.util.deserialize(serialized);
  
  expect(deserialized.length).toBe(4);
  expect(deserialized[1]).toBeUndefined();
  expect(1 in deserialized).toBe(false);
});