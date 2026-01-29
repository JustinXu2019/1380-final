#!/bin/bash
# This is a student test

T_FOLDER=${T_FOLDER:-t}
R_FOLDER=${R_FOLDER:-}

cd "$(dirname "$0")/../..$R_FOLDER" || exit 1

cat "d/stopwords.txt" | while read -r line; do

    [ -z "$line" ] && continue
    
    if ! echo "$line" | c/process.sh > /dev/null 2>&1; then
        echo "$0 failure: non-zero exit code"
        exit 1
fi
done 

echo "$0 success: exit code 0"
exit 0