#!/usr/bin/env node

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  terminal: false,
});

const words = new Map();

rl.on('line', (line) => {
  words.set(line, (words.get(line) || 0) + 1);
});

rl.on('close', () => {
  const url = process.argv[2];
  if (url.length < 1) {
    console.error('Error: Invalid URL');
    return;
  }
  for (const [key, value] of words) {
    console.log(`${key} | ${value} | ${url}`);
  }
});
