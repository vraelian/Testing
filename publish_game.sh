#!/bin/bash

# --- CONFIGURATION ---
# The folder where your build tools live (relative to GameWebApp)
TOOL_DIR="../OBFUSCATION TOOLING V2"

# The folder for the live game/Xcode repo (relative to GameWebApp)
LIVE_REPO="../OrbitalTrading"

# List of specific tool files to borrow temporarily
# We move these IN, use them, and move them OUT.
FILES_TO_MOVE=("build.js" "package.json" "package-lock.json" "node_modules")
# ---------------------

echo "🤖 INITIATING AUTOMATED DEPLOYMENT SEQUENCE..."

# 1. CHECK SAFETY
if [ ! -d "$TOOL_DIR" ]; then
    echo "❌ Error: Cannot find Tooling folder at $TOOL_DIR"
    exit 1
fi
if [ ! -d "$LIVE_REPO/.git" ]; then
    echo "❌ Error: Cannot find Live Repo at $LIVE_REPO"
    exit 1
fi

# 2. MOVE TOOLS IN (Borrowing them)
echo "📦 Moving obfuscation tools into GameWebApp..."
for file in "${FILES_TO_MOVE[@]}"; do
    if [ -e "$TOOL_DIR/$file" ]; then
        mv "$TOOL_DIR/$file" .
    else
        echo "⚠️ Warning: Could not find $file in tooling folder."
    fi
done

# 3. RUN BUILD
echo "🛠️  Running Build Process (npm run build)..."
# We assume 'npm run build' generates a 'dist' folder in the current directory
npm run build

# Check if build succeeded
if [ ! -d "dist" ]; then
    echo "❌ Error: Build failed. 'dist' folder was not created."
    # (Optional: Move tools back before exiting? For now, we stop to let you debug)
    exit 1
fi

# 4. DEPLOY TO LIVE REPO (Overwrite files)
echo "🚀 Copying 'dist' contents to OrbitalTrading repo..."
# We use cp -R to overwrite files. We do NOT delete existing files in destination
# to protect your Xcode project files if they live there.
cp -R dist/* "$LIVE_REPO/"

# 5. GIT PUSH (Live Repo)
echo "📡 Pushing update to GitHub (OrbitalTrading)..."
CURRENT_DIR=$(pwd) # Remember where we are
cd "$LIVE_REPO" || exit
git add .
git commit -m "Automated Build Update: $(date "+%Y-%m-%d %H:%M:%S")"
git push origin main
cd "$CURRENT_DIR" || exit # Go back to GameWebApp

# 6. CLEANUP (Move tools and dist back home)
echo "🧹 Cleaning up: Moving tools and dist back to storage..."
for file in "${FILES_TO_MOVE[@]}"; do
    if [ -e "$file" ]; then
        mv "$file" "$TOOL_DIR/"
    fi
done

# Move the newly created dist folder to the tooling folder too
# (If a dist folder already exists there, we replace it)
if [ -d "$TOOL_DIR/dist" ]; then
    rm -rf "$TOOL_DIR/dist"
fi
mv dist "$TOOL_DIR/"

echo "✨ SUCCESS! Game is live and workspace is clean."