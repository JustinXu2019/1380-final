const path = require('path');
const fs = require('fs');
const {convert} = require('html-to-text');
const natural = require('natural');

const stopwordsPath = path.resolve(__dirname, '../../non-distribution/d/stopwords.txt');
const stopwords = new Set(
    fs.readFileSync(stopwordsPath, 'utf8').split(/\s+/).filter(Boolean),
);
const stemmer = natural.PorterStemmer;

function tokenize(text) {
  return text
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z]/g, '\n').toLowerCase()
      .split('\n').filter(Boolean)
      .filter((w) => !stopwords.has(w))
      .map((w) => stemmer.stem(w));
}

function ngrams(tokens) {
  return tokens.slice();
}

function processText(text) {
  const tokens = tokenize(text || '').slice(0, 100);
  const grams = ngrams(tokens);
  const counts = new Map();
  for (const g of grams) {
  if (counts.has(g)) {
    counts.set(g, counts.get(g) + 1);
  } else {
    counts.set(g, 1);
  }
}
  return Array.from(counts, ([ngram, count]) => ({ngram, count})).filter((e) => e.count > 1);
}

function extractText(html) {
  try {
    return convert(html || '', {wordwrap: false});
  } catch (err) {
    return '';
  }
}

function normalizeUrl(href, baseUrl) {
  try {
    return new URL(href, baseUrl).href.split('#')[0];
  } catch {
    return null;
  }
}

function extractLinks(html, baseUrl) {
  const regex = /<a[^>]*href=["']([^"']+)["']/gi;
  const links = new Set();
  
  const matches = (html || '').matchAll(regex);
  for (const match of matches) {
    const url = normalizeUrl(match[1], baseUrl);
    if (url) links.add(url);
  }
  
  return Array.from(links);
}

function processQuery(q) {
  return ngrams(tokenize(q || ''));
}

module.exports = {processText, processQuery, extractText, extractLinks, tokenize};