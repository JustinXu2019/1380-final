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
  return (text.length > 8000 ? text.slice(0, 8000) : text)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z]/g, '\n').toLowerCase()
      .split('\n').filter((w) => w && w.length >= 3 && w.length <= 20)
      .filter((w) => !stopwords.has(w))
      .map((w) => stemmer.stem(w));
}

function ngrams(tokens) {
  const out = [];
  for (let i = 0; i < tokens.length; i++) {
    out.push(tokens[i]);
    if (i + 1 < tokens.length) out.push(`${tokens[i]} ${tokens[i + 1]}`);
    if (i + 2 < tokens.length) out.push(`${tokens[i]} ${tokens[i + 1]} ${tokens[i + 2]}`);
  }
  return out;
}

function processText(text) {
  const tokens = tokenize(text || '');
  const counts = new Map();
  for (const t of tokens) {
    counts.set(t, (counts.get(t) || 0) + 1);
  }
  const result = Array.from(counts, ([ngram, count]) => ({ngram, count}))
      .filter(({count}) => count > 1);
  if (result.length > 40) {
    result.sort((a, b) => b.count - a.count);
    result.length = 40;
  }
  return result;
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
  return tokenize(q || '');
}

module.exports = {processText, processQuery, extractText, extractLinks, tokenize};