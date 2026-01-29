#!/usr/bin/env node

/*
Convert each term to its stem
Usage: input > ./stem.js > output
*/

const readline = require('readline');
const natural = require('natural');
// const {string} = require('yargs');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

rl.on('line', function(line) {
  // Print the Porter stem from `natural` for each element of the stream.
  // console.log(line)
  if (!line) {
    console.log(line);
    return;
  }
  const stemmer = natural.PorterStemmer;
  const tokenizer = new natural.WordTokenizer();
  const words = tokenizer.tokenize(line);
  const strings = words.map((word) => stemmer.stem(word));
  console.log(strings.join(' '));
});
