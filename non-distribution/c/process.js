#!/usr/bin/env node
const readline = require('readline');
const fs = require('fs');

const rl = readline.createInterface({
  input: process.stdin,
  terminal: false,
});

const stopwords = new Set(
    fs.readFileSync('./d/stopwords.txt', 'utf8').split(/\s+/).filter(Boolean),
);

rl.on('line', function(line) {
  line.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z]/gi, '\n').toLowerCase()
      .split('\n').filter(Boolean)
      .forEach((word) => {
        if (!stopwords.has(word)) {
          console.log(word);
        }
      });
});

rl.on('error', () => process.exit(0));
