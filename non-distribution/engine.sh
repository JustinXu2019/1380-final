#!/bin/bash
cd "$(dirname "$0")" || exit 1

# Initialize total time counters (in nanoseconds)
total_crawl_ns=0
total_index_ns=0

while read -r url; do
  if [[ "$url" == "stop" ]]; then
    break
  fi

  echo "[engine] crawling $url" >/dev/stderr
  
  # Time the Crawl
  t_start=$(date +%s%N)
  ./crawl.sh "$url" > d/content.txt
  t_end=$(date +%s%N)
  total_crawl_ns=$((total_crawl_ns + (t_end - t_start)))

  echo "[engine] indexing $url" >/dev/stderr
  
  # Time the Index
  t_start=$(date +%s%N)
  ./index.sh d/content.txt "$url"
  t_end=$(date +%s%N)
  total_index_ns=$((total_index_ns + (t_end - t_start)))

  if [[ "$(cat d/visited.txt | wc -l)" -ge "$(cat d/urls.txt | wc -l)" ]]; then
      break
  fi

done < <(tail -f d/urls.txt)

# Convert nanoseconds to seconds for the final report
# We use 'bc' for decimal math if you want precision
total_crawl_s=$(echo "scale=3; $total_crawl_ns / 1000000000" | bc)
total_index_s=$(echo "scale=3; $total_index_ns / 1000000000" | bc)

echo "-------------------------------"
echo "TOTAL PERFORMANCE REPORT"
echo "Total Crawl Time: ${total_crawl_s}s"
echo "Total Index Time: ${total_index_s}s"
echo "-------------------------------"
