#!/usr/bin/env node

/*
Extract all text from an HTML page.
Usage: input > ./getText.js > output
*/

const {convert} = require('html-to-text');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
});

let html = '';

rl.on('line', (line) => {
  // 1. Read HTML input from standard input, line by line using the `readline` module.
  html = html + line + '\n';
});

// 2. after all input is received, use convert to output plain text.
rl.on('close', () => {
  if (!html.trim()) {
    console.error('Error: no content found');
    process.exit(1);
  }
  const text = convert(html);
  console.log(text);
});
