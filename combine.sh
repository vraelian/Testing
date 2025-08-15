#!/bin/bash
# This script combines all relevant project files into a single output file for analysis.
# It recursively searches for .html, .css, .js, .json, and .md files,
# while excluding development directories and the script/tooling files themselves.

# The name of the file to create
OUTPUT_FILE="combined_code.txt"

# Clear the output file if it already exists
> "$OUTPUT_FILE"

# Use 'find' to locate all relevant files.
# - The first block with -prune efficiently skips entire directories.
# - The second block finds files by their extension.
# - The loop then processes each found file.
find . \
  \( -name ".git" -o -name "node_modules" -o -name ".vscode" \) -prune \
  -o \
  \( -name "*.html" -o -name "*.css" -o -name "*.js" -o -name "*.json" -o -name "*.md" \) \
  -type f | while read -r file; do
  
  # Exclude specific tool, output, and system files from the final bundle.
  if [[ "$file" == "./combine.sh" || \
        "$file" == "./$OUTPUT_FILE" || \
        "$file" == "./OrbitalBuilder.html" || \
        "$file" == *".DS_Store"* ]]; then
    continue
  fi

  # Print a clear separator with the file path to the output file.
  echo "--- START OF FILE: ${file} ---" >> "$OUTPUT_FILE"
  # Append the content of the file.
  cat "$file" >> "$OUTPUT_FILE"
  # Print an end separator for clean parsing.
  echo -e "\n--- END OF FILE: ${file} ---\n\n\n" >> "$OUTPUT_FILE"
done

echo "Project files have been combined into $OUTPUT_FILE"