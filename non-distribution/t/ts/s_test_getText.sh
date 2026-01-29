#!/bin/bash
# This is a student test

T_FOLDER=${T_FOLDER:-t}
R_FOLDER=${R_FOLDER:-}

cd "$(dirname "$0")/../..$R_FOLDER" || exit 1

error_output=$(cat "$T_FOLDER"/d/emptyTest.txt | c/getText.js > /dev/null 2>&1)

if [[ "$error_output" == *"Error: no content found"* ]]; then
    echo "$0 success: caught expected error message"
    exit 0
else
    echo "$0 failure: did not receive the expected error"
    exit 1
fi