# non-distribution

This milestone aims (among others) to refresh (and confirm) everyone's
background on developing systems in the languages and libraries used in this
course.

By the end of this assignment you will be familiar with the basics of
JavaScript, shell scripting, stream processing, Docker containers, deployment
to AWS, and performance characterization—all of which will be useful for the
rest of the project.

Your task is to implement a simple search engine that crawls a set of web
pages, indexes them, and allows users to query the index. All the components
will run on a single machine.

## Getting Started

To get started with this milestone, run `npm install` inside this folder. To
execute the (initially unimplemented) crawler run `./engine.sh`. Use
`./query.js` to query the produced index. To run tests, do `npm run test`.
Initially, these will fail.

### Overview

The code inside `non-distribution` is organized as follows:

```
.
├── c            # The components of your search engine
├── d            # Data files like seed urls and the produced index
├── s            # Utility scripts for linting your solutions
├── t            # Tests for your search engine
├── README.md    # This file
├── crawl.sh     # The crawler
├── index.sh     # The indexer
├── engine.sh    # The orchestrator script that runs the crawler and the indexer
├── package.json # The npm package file that holds information like JavaScript dependencies
└── query.js     # The script you can use to query the produced global index
```

### Submitting

To submit your solution, run `./scripts/submit.sh` from the root of the stencil. This will create a
`submission.zip` file which you can upload to the autograder.

# M0: Setup & Centralized Computing

> Add your contact information below and in `package.json`.

* name: `Justin Xu`

* email: `justin_xu@brown.edu`

* cslogin: `jxu287`


## Summary

> My implementation consisted of filling out the required files and I attempted the extra credit. I implemented merge.js in a very inefficient way where I just threw multiple data structures and called many sorts over and over. The most challenging aspect was implementing TF-IDF. I did not know where to implement it at first and how to incorporate it into my existing code. However the implementation which I ended up doing was adding an extra argument to merge.js. My tf-idf implementation also does not change the format in which frequencies are displayed in the global index, however TF-IDF affects the way urls are sorted. I implemented this by getting a count of all the monograms in the incoming content and counting all the monograms in the existing global index. Then using these numbers I calculated TF and IDF respectively and at the end of merge it checks if the argument was there and sorts the global index by tf-idf instead of word frequency. I also did not enjoy writing tests because thinking of edge cases is hard. 



## Correctness & Performance Characterization


> Describe how you characterized the correctness and performance of your implementation.


To characterize correctness, we developed `6` that test the following cases: tf-idf, empty/invalid imputs for getURL, getText, process, stem, and query.


*Performance*: The throughput of various subsystems is described in the `"throughput"` portion of package.json. The characteristics of my development machines are summarized in the `"dev"` portion of package.json.


## Wild Guess

> I believe that it would take around 4500 lines of code to complete a distributed and scaleable version of my search engine. I think the backend portion migh only take 1.5k lines of code but the front end and user interface depending on the number of features can drastically increase the number of lines of code written. 