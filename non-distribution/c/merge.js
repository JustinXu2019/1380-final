#!/usr/bin/env node

/*
Merge the current inverted index (assuming the right structure) with the global index file
Usage: input > ./merge.js global-index > output

The inverted indices have the different structures!

Each line of a local index is formatted as:
  - `<word/ngram> | <frequency> | <url>`

Each line of a global index is be formatted as:
  - `<word/ngram> | <url_1> <frequency_1> <url_2> <frequency_2> ... <url_n> <frequency_n>`
  - Where pairs of `url` and `frequency` are in descending order of frequency
  - Everything after `|` is space-separated

-------------------------------------------------------------------------------------
Example:

local index:
  word1 word2 | 8 | url1
  word3 | 1 | url9
EXISTING global index:
  word1 word2 | url4 2
  word3 | url3 2

merge into the NEW global index:
  word1 word2 | url1 8 url4 2
  word3 | url3 2 url9 1

Remember to error gracefully, particularly when reading the global index file.
*/

const fs = require('fs');
const readline = require('readline');
// const {parse} = require('yargs');
// The `compare` function can be used for sorting.
const compare = (a, b) => {
  if (a.score > b.score) {
    return -1;
  } else if (a.score < b.score) {
    return 1;
  } else {
    return 0;
  }
};
const rl = readline.createInterface({
  input: process.stdin,
});

// 1. Read the incoming local index data from standard input (stdin) line by line.
let localIndex = '';
rl.on('line', (line) => {
  localIndex += line + '\n';
});

rl.on('close', () => {
  // 2. Read the global index name/location, using process.argv
  // and call printMerged as a callback
  const globalIndex = process.argv[2];
  const tfidfEnabled = process.argv[3] === 'true';
  fs.readFile(globalIndex, 'utf8', (err, data) => {
    printMerged(err, data, tfidfEnabled);
  });
});

const printMerged = (err, data, tfidf) => {
  if (err) {
    console.error('Error reading file:', err);
    return;
  }

  // Split the data into an array of lines
  const localIndexLines = localIndex.split('\n');
  const globalIndexLines = data.split('\n');

  localIndexLines.pop();
  globalIndexLines.pop();

  const local = {};
  const global = {};
  const allUrls = new Set();


  // 3. For each line in `localIndexLines`, parse them and add them to the `local` object
  // where keys are terms and values store a url->freq map (one entry per url).
  for (const line of localIndexLines) {
    const string = line.split('|');

    const term = string[0].trim();
    const freq = parseInt(string[1].trim());
    const url = string[2].trim();

    if (!local[term]) {
      local[term] = {};
    }

    local[term][url] = (local[term][url] || 0) + freq;
  }

  // 4. For each line in `globalIndexLines`, parse them and add them to the `global` object
  // where keys are terms and values are url->freq maps (one entry per url).
  // Use the .trim() method to remove leading and trailing whitespace from a string.
  for (const line of globalIndexLines) {
    const string = line.split('|');

    const term = string[0].trim();
    const urlFreqs = string[1].trim().split(' ');

    const grouped = new Map();

    for (let i = 0; i < urlFreqs.length; i += 2) {
      grouped.set(urlFreqs[i], parseInt(urlFreqs[i + 1]));
    }

    global[term] = grouped; // Map<url, freq>
  }

  // 5. Merge the local index into the global index:
  // - For each term in the local index, if the term exists in the global index:
  //     - Merge by url so there is at most one entry per url.
  //     - Sum frequencies for duplicate urls.
  // - If the term does not exist in the global index:
  //     - Add it as a new entry with the local index's data.
  for (const term in local) {
    if (!global[term]) {
      global[term] = new Map();
    }

    for (const url in local[term]) {
      const freq = local[term][url];
      const globalFreq = global[term].get(url) || 0;
      global[term].set(url, globalFreq + freq);
    }
  }

  const docLengths = {};
  for (const term in global) {
    if (!term.includes(' ')) {
      global[term].forEach((freq, url) => {
        allUrls.add(url);
        docLengths[url] = (docLengths[url] || 0) + freq;
      });
    } else {
      global[term].forEach((freq, url) => {
        allUrls.add(url);
      });
    }
  }

  const N = allUrls.size;
  // 6. Print the merged index to the console in the same format as the global index file:
  //    - Each line contains a term, followed by a pipe (`|`), followed by space-separated pairs of `url` and `freq`.
  //    - Terms should be printed in alphabetical order.
  const sortedGlobal = Object.keys(global).sort();
  for (const term of sortedGlobal) {
    const mapObject = global[term];
    const sortedVals = [];
    const idf = Math.log(N / global[term].size);
    let score;
    mapObject.forEach((freq, url) => {
      if (tfidf) {
        const tf = freq / (docLengths[url] || 1);
        score = (tf * idf); // Keep it readable
        console.error(`DEBUG: Term: ${term} | URL: ${url} | TF: ${tf} | IDF: ${idf})} | Score: ${score.toFixed(4)}`);
      } else {
        score = freq;
      }
      sortedVals.push({url, freq: parseInt(freq), score});
    });
    sortedVals.sort(compare);
    const formattedPairs = sortedVals.map((e) => `${e.url} ${e.freq}`).join(' ');

    console.log(`${term} | ${formattedPairs}`);
  }
};
