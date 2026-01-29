#!/bin/bash
# This is a student test

T_FOLDER=${T_FOLDER:-t}
R_FOLDER=${R_FOLDER:-}

cd "$(dirname "$0")/../..$R_FOLDER" || exit 1

cat "d/stopwords.txt" | while read -r line; do

    [ -z "$line" ] && continue

    output=$( node query.js "$line" )
    if [ -n "$output" ]; then
        echo "$0 failure: did not return empty string instead returned $output"
        exit 1
fi
done 

echo "$0 success: returned empty string"
exit 0