#!/usr/bin/env node

const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  terminal: false,
});

const window = [];

rl.on('line', (line) => {
  const word = line.trim().replace(/\s/g, ' ');
  if (!word) return;
  window.push(word);
  console.log(window[window.length - 1]);
  if (window.length >= 2) {
    console.log(`${window[window.length - 2]} ${window[window.length - 1]}`);
  }
  if (window.length >= 3) {
    console.log(`${window[window.length - 3]} ${window[window.length - 2]} ${window[window.length - 1]}`);
  }
  if (window.length > 3) {
    window.shift();
  }
});
