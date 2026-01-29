#!/bin/bash

T_FOLDER=${T_FOLDER:-t}
R_FOLDER=${R_FOLDER:-}

cd "$(dirname "$0")/../..$R_FOLDER" || exit 1

DIFF=${DIFF:-diff}
DIFF_PERCENT=${DIFF_PERCENT:-0}

# Generate the two merged indices
cat d/local-index-tfidf.txt | node c/merge.js d/global-index-tfidf.txt > merged-freq.txt 2>/dev/null

cat d/local-index-tfidf.txt | node c/merge.js d/global-index-tfidf.txt true > merged-tfidf.txt 2>/dev/null

# Compare the outputs
if $DIFF -q merged-freq.txt merged-tfidf.txt > /dev/null 2>&1; then
    # Files are identical - this is BAD (TF-IDF should change the ordering)
    echo "ERROR: merged-freq.txt and merged-tfidf.txt are identical!"
    echo "TF-IDF should produce different rankings than frequency-based sorting."
    exit 1
else
    # Files differ - this is GOOD (TF-IDF is working)
    echo "SUCCESS: TF-IDF produced different rankings than frequency-based sorting."
    exit 0
fi
