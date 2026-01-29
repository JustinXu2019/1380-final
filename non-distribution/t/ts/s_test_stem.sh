#!/bin/bash
# This is a student test

T_FOLDER=${T_FOLDER:-t}
R_FOLDER=${R_FOLDER:-}

cd "$(dirname "$0")/../..$R_FOLDER" || exit 1

output=$(cat "$T_FOLDER"/d/emptyTest.txt | c/stem.js)

if [ -n "$output" ]; then
    echo "$0 success: empty string returned"
    exit 0
else
    echo "$0 failure: did not return an empty string"
    exit 1
fi