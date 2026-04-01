require('../../distribution.js')();
const distribution = globalThis.distribution;
const id = distribution.util.id;

const ncdcGroup = {};
const dlibGroup = {};
const tfidfGroup = {};
const crawlGroup = {};
const urlxtrGroup = {};
const strmatchGroup = {};
const ridxGroup = {};
const rlgGroup = {};


/*
    The local node will be the orchestrator.
*/

const n1 = {ip: '127.0.0.1', port: 7110};
const n2 = {ip: '127.0.0.1', port: 7111};
const n3 = {ip: '127.0.0.1', port: 7112};

test('(0 pts) (scenario) all.mr:ncdc', (done) => {
/* Implement the map and reduce functions.
   The map function should parse the string value and return an object with the year as the key and the temperature as the value.
   The reduce function should return the maximum temperature for each year.

   (The implementation for this scenario is provided below.)
*/

  const mapper = (key, value) => {
    const words = value.split(/(\s+)/).filter((e) => e !== ' ');
    const out = {};
    out[words[1]] = parseInt(words[3]);
    return out;
  };

  const reducer = (key, values) => {
    const out = {};
    out[key] = values.reduce((a, b) => Math.max(a, b), -Infinity);
    return out;
  };

  const dataset = [
    {'000': '006701199099999 1950 0515070049999999N9 +0000 1+9999'},
    {'106': '004301199099999 1950 0515120049999999N9 +0022 1+9999'},
    {'212': '004301199099999 1950 0515180049999999N9 -0011 1+9999'},
    {'318': '004301265099999 1949 0324120040500001N9 +0111 1+9999'},
    {'424': '004301265099999 1949 0324180040500001N9 +0078 1+9999'},
  ];

  const expected = [{'1950': 22}, {'1949': 111}];

  const doMapReduce = () => {
    distribution.ncdc.store.get(null, (e, v) => {
      try {
        expect(v.length).toEqual(dataset.length);
      } catch (e) {
        done(e);
      }


      distribution.ncdc.mr.exec({keys: v, map: mapper, reduce: reducer}, (e, v) => {
        try {
          expect(v).toEqual(expect.arrayContaining(expected));
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  };

  let cntr = 0;
  // Send the dataset to the cluster
  dataset.forEach((o) => {
    const key = Object.keys(o)[0];
    const value = o[key];
    distribution.ncdc.store.put(value, key, (e, v) => {
      cntr++;
      // Once the dataset is in place, run the map reduce
      if (cntr === dataset.length) {
        doMapReduce();
      }
    });
  });
});

test('(10 pts) (scenario) all.mr:dlib', (done) => {
/*
   Implement the map and reduce functions.
   The map function should parse the string value and return an object with the word as the key and the value as 1.
   The reduce function should return the count of each word.
*/

  const mapper = (key, value) => {
    const words = value.split(/(\s+)/).filter((e) => e !== ' ');
    const out = [];
    words.forEach(word => {
        out.push({[word]: 1})
    });
    return out;
  };

  const reducer = (key, values) => {
    const out = {}
    out[key] = values.reduce((sum, current) => sum + current, 0);
    return out
  };

  const dataset = [
    {'b1-l1': 'It was the best of times, it was the worst of times,'},
    {'b1-l2': 'it was the age of wisdom, it was the age of foolishness,'},
    {'b1-l3': 'it was the epoch of belief, it was the epoch of incredulity,'},
    {'b1-l4': 'it was the season of Light, it was the season of Darkness,'},
    {'b1-l5': 'it was the spring of hope, it was the winter of despair,'},
  ];

  const expected = [
    {It: 1}, {was: 10},
    {the: 10}, {best: 1},
    {of: 10}, {'times,': 2},
    {it: 9}, {worst: 1},
    {age: 2}, {'wisdom,': 1},
    {'foolishness,': 1}, {epoch: 2},
    {'belief,': 1}, {'incredulity,': 1},
    {season: 2}, {'Light,': 1},
    {'Darkness,': 1}, {spring: 1},
    {'hope,': 1}, {winter: 1},
    {'despair,': 1},
  ];

  const doMapReduce = () => {
    distribution.dlib.store.get(null, (e, v) => {
      try {
        expect(v.length).toEqual(dataset.length);
      } catch (e) {
        done(e);
      }

      distribution.dlib.mr.exec({keys: v, map: mapper, reduce: reducer}, (e, v) => {
        try {
          expect(v).toEqual(expect.arrayContaining(expected));
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  };

  let cntr = 0;

  // Send the dataset to the cluster
  dataset.forEach((o) => {
    const key = Object.keys(o)[0];
    const value = o[key];
    distribution.dlib.store.put(value, key, (e, v) => {
      cntr++;
      // Once the dataset is in place, run the map reduce
      if (cntr === dataset.length) {
        doMapReduce();
      }
    });
  });
});

test('(10 pts) (scenario) all.mr:tfidf', (done) => {
/*
    Implement the map and reduce functions.
    The map function should parse the string value and return an object with the word as the key and the document and count as the value.
    The reduce function should return the TF-IDF for each word.

    Hint:
    TF = (Number of times the term appears in a document) / (Total number of terms in the document)
    IDF = log10(Total number of documents / Number of documents with the term in it)
    TF-IDF = TF * IDF
*/

  const mapper = (key, value) => {
    const words = value.split(/(\s+)/).filter((e) => e !== ' ');
    const totalWordsInDoc = words.length;
    const out = [];
    words.forEach(word => {
        out.push({[word]: {
        doc: key, 
        count: 1, 
        docLen: totalWordsInDoc}})
    });
    return out;
  };

  // Reduce function: calculate TF-IDF for each word
  const reducer = (key, values) => {
    const totalDocs = 3;
    const docData = {};
    values.forEach(item => {
      if (!docData[item.doc]) {
        docData[item.doc] = { count: 0, docLen: item.docLen };
      }
      docData[item.doc].count += item.count;
    });
    const docsWithWord = Object.keys(docData).length;
    const idf = Math.log10(totalDocs / docsWithWord);
    const tfIdfResults = {};
    for (const docId in docData) {
      const tf = docData[docId].count / docData[docId].docLen; 
      const score = tf * idf;
      tfIdfResults[docId] = Math.round(score * 100) / 100;
    }
    return { [key]: tfIdfResults };
  };

  const dataset = [
    {'doc1': 'machine learning is amazing'},
    {'doc2': 'deep learning powers amazing systems'},
    {'doc3': 'machine learning and deep learning are related'},
  ];

  const expected = [{'is': {'doc1': 0.12}},
    {'deep': {'doc2': 0.04, 'doc3': 0.03}},
    {'systems': {'doc2': 0.1}},
    {'learning': {'doc1': 0, 'doc2': 0, 'doc3': 0}},
    {'amazing': {'doc1': 0.04, 'doc2': 0.04}},
    {'machine': {'doc1': 0.04, 'doc3': 0.03}},
    {'are': {'doc3': 0.07}}, {'powers': {'doc2': 0.1}},
    {'and': {'doc3': 0.07}}, {'related': {'doc3': 0.07}}];

  const doMapReduce = () => {
    distribution.tfidf.store.get(null, (e, v) => {
      try {
        expect(v.length).toEqual(dataset.length);
      } catch (e) {
        done(e);
      }

      distribution.tfidf.mr.exec({keys: v, map: mapper, reduce: reducer}, (e, v) => {
        try {
          expect(v).toEqual(expect.arrayContaining(expected));
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  };

  let cntr = 0;

  // Send the dataset to the cluster
  dataset.forEach((o) => {
    const key = Object.keys(o)[0];
    const value = o[key];
    distribution.tfidf.store.put(value, key, (e, v) => {
      cntr++;
      // Once the dataset is in place, run the map reduce
      if (cntr === dataset.length) {
        doMapReduce();
      }
    });
  });
});

/*
  The rest of the scenarios are left as an exercise.
  For each one you'd like to implement, you'll need to:
  - Define the map and reduce functions.
  - Create a dataset.
  - Run the map reduce.
*/

test('(10 pts) (scenario) all.mr:crawl', (done) => {
  const mapper = (key, value) => {
      // Simulate finding URLs in text: strings starting with http
      const links = value.match(/https?:\/\/[^\s,]+/g) || [];
      return links.map(link => ({ [link]: key }));
    };

    const reducer = (key, values) => {
      // Values is an array of source pages that link to this 'key' URL
      const uniqueSources = [...new Set(values)].sort();
      return { [key]: uniqueSources };
    };

    const dataset = [
      {'page1': 'Check out http://google.com and http://github.com'},
      {'page2': 'I like http://google.com but also http://wikipedia.org'},
      {'page3': 'Reference: http://github.com'},
    ];

    const expected = [
      { 'http://google.com': ['page1', 'page2'] },
      { 'http://github.com': ['page1', 'page3'] },
      { 'http://wikipedia.org': ['page2'] },
    ];

    const doMapReduce = () => {
      distribution.crawl.store.get(null, (e, v) => {
        distribution.crawl.mr.exec({keys: v, map: mapper, reduce: reducer}, (e, v) => {
          try {
            expect(v).toEqual(expect.arrayContaining(expected));
            done();
          } catch (err) { done(err); }
        });
      });
    };

    let cntr = 0;
    dataset.forEach((o) => {
      const key = Object.keys(o)[0];
      distribution.crawl.store.put(o[key], key, (e, v) => {
        if (++cntr === dataset.length) doMapReduce();
      });
    });
});

test('(10 pts) (scenario) all.mr:urlxtr', (done) => {
  const mapper = (key, value) => {
      try {
        const hostname = new URL(value).hostname;
        return { [hostname]: 1 };
      } catch (e) {
        return {}; // Handle malformed URLs
      }
    };

    const reducer = (key, values) => {
      return { [key]: values.reduce((a, b) => a + b, 0) };
    };

    const dataset = [
      {'u1': 'https://google.com/search?q=node'},
      {'u2': 'https://google.com/images'},
      {'u3': 'https://github.com/distribution'},
      {'u4': 'https://wikipedia.org/wiki/MapReduce'},
    ];

    const expected = [
      { 'google.com': 2 },
      { 'github.com': 1 },
      { 'wikipedia.org': 1 },
    ];

    const doMapReduce = () => {
      distribution.urlxtr.store.get(null, (e, v) => {
        distribution.urlxtr.mr.exec({keys: v, map: mapper, reduce: reducer}, (e, v) => {
          try {
            expect(v).toEqual(expect.arrayContaining(expected));
            done();
          } catch (err) { done(err); }
        });
      });
    };

    let cntr = 0;
    dataset.forEach((o) => {
      const key = Object.keys(o)[0];
      distribution.urlxtr.store.put(o[key], key, (e, v) => {
        if (++cntr === dataset.length) doMapReduce();
      });
    });
});

test('(10 pts) (scenario) all.mr:strmatch', (done) => {
  const mapper = (key, value) => {
    const pattern = 'the';
    const regex = new RegExp(pattern, 'gi');
    const matches = value.match(regex) || [];
    return matches.map((_, i) => ({ [pattern]: { doc: key, count: 1 } }));
  };

  // Reduce: aggregate total match count per document
  const reducer = (key, values) => {
    const docCounts = {};
    values.forEach(({ doc, count }) => {
      docCounts[doc] = (docCounts[doc] || 0) + count;
    });
    return { [key]: docCounts };
  };

const dataset = [
  { 'strmatch-d1': 'the cat sat on the mat' },
  { 'strmatch-d2': 'the dog ran past the fence and the gate' },
  { 'strmatch-d3': 'a bird flew over a tree' },
];

const expected = [
  { 'the': { 'strmatch-d1': 2, 'strmatch-d2': 3 } },
];

  const doMapReduce = () => {
    distribution.strmatch.store.get(null, (e, v) => {
      try {
        expect(v.length).toEqual(dataset.length);
      } catch (e) {
        done(e);
      }

      distribution.strmatch.mr.exec({ keys: v, map: mapper, reduce: reducer }, (e, v) => {
        try {
          expect(v).toEqual(expect.arrayContaining(expected));
          done();
        } catch (e) {
          done(e);
        }
      });
    });
  };

  let cntr = 0;
  dataset.forEach((o) => {
    const key = Object.keys(o)[0];
    distribution.strmatch.store.put(o[key], key, (e, v) => {
      if (++cntr === dataset.length) doMapReduce();
    });
  });
});

test('(10 pts) (scenario) all.mr:ridx', (done) => {
    done(new Error('Implement the map and reduce functions'));
});

test('(10 pts) (scenario) all.mr:rlg', (done) => {
    done(new Error('Implement the map and reduce functions'));
});

/*
    This is the setup for the test scenario.
    Do not modify the code below.
*/

beforeAll((done) => {
  ncdcGroup[id.getSID(n1)] = n1;
  ncdcGroup[id.getSID(n2)] = n2;
  ncdcGroup[id.getSID(n3)] = n3;

  dlibGroup[id.getSID(n1)] = n1;
  dlibGroup[id.getSID(n2)] = n2;
  dlibGroup[id.getSID(n3)] = n3;

  tfidfGroup[id.getSID(n1)] = n1;
  tfidfGroup[id.getSID(n2)] = n2;
  tfidfGroup[id.getSID(n3)] = n3;

  crawlGroup[id.getSID(n1)] = n1;
  crawlGroup[id.getSID(n2)] = n2;
  crawlGroup[id.getSID(n3)] = n3;

  urlxtrGroup[id.getSID(n1)] = n1;
  urlxtrGroup[id.getSID(n2)] = n2;
  urlxtrGroup[id.getSID(n3)] = n3;

  strmatchGroup[id.getSID(n1)] = n1;
  strmatchGroup[id.getSID(n2)] = n2;
  strmatchGroup[id.getSID(n3)] = n3;

  ridxGroup[id.getSID(n1)] = n1;
  ridxGroup[id.getSID(n2)] = n2;
  ridxGroup[id.getSID(n3)] = n3;

  rlgGroup[id.getSID(n1)] = n1;
  rlgGroup[id.getSID(n2)] = n2;
  rlgGroup[id.getSID(n3)] = n3;


  const startNodes = (cb) => {
    distribution.local.status.spawn(n1, (e, v) => {
      distribution.local.status.spawn(n2, (e, v) => {
        distribution.local.status.spawn(n3, (e, v) => {
          cb();
        });
      });
    });
  };

  distribution.node.start(() => {
    const ncdcConfig = {gid: 'ncdc'};
    startNodes(() => {
      distribution.local.groups.put(ncdcConfig, ncdcGroup, (e, v) => {
        distribution.ncdc.groups.put(ncdcConfig, ncdcGroup, (e, v) => {
          const dlibConfig = {gid: 'dlib'};
          distribution.local.groups.put(dlibConfig, dlibGroup, (e, v) => {
            distribution.dlib.groups.put(dlibConfig, dlibGroup, (e, v) => {
              const tfidfConfig = {gid: 'tfidf'};
              distribution.local.groups.put(tfidfConfig, tfidfGroup, (e, v) => {
                distribution.tfidf.groups.put(tfidfConfig, tfidfGroup, (e, v) => {
                  const crawlConfig = {gid: 'crawl'};
                  distribution.local.groups.put(crawlConfig, crawlGroup, (e, v) => {
                    distribution.crawl.groups.put(crawlConfig, crawlGroup, (e, v) => {
                      const urlxtrConfig = {gid: 'urlxtr'};
                      distribution.local.groups.put(urlxtrConfig, urlxtrGroup, (e, v) => {
                        distribution.urlxtr.groups.put(urlxtrConfig, urlxtrGroup, (e, v) => {
                          const strmatchConfig = {gid: 'strmatch'};
                          distribution.local.groups.put(strmatchConfig, strmatchGroup, (e, v) => {
                            distribution.strmatch.groups.put(strmatchConfig, strmatchGroup, (e, v) => {
                              done();
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

afterAll((done) => {
  const remote = {service: 'status', method: 'stop'};
  remote.node = n1;
  distribution.local.comm.send([], remote, (e, v) => {
    remote.node = n2;
    distribution.local.comm.send([], remote, (e, v) => {
      remote.node = n3;
      distribution.local.comm.send([], remote, (e, v) => {
        if (globalThis.distribution.node.server) {
          globalThis.distribution.node.server.close();
        }
        done();
      });
    });
  });
});

