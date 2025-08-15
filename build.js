// build.js
const fs = require('fs').promises;
const path = require('path');
const esbuild = require('esbuild');

const ENTRY_POINT = `js/main.js`;
const OUTPUT_DIR = 'dist';
const HTML_FILE = 'index.html';
const STYLESHEET = 'style.css';

async function build() {
    console.log('🚀 Starting professional build process with esbuild...');

    try {
        // 1. Clean and create the output directory
        await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
        await fs.mkdir(OUTPUT_DIR, { recursive: true });

        // 2. Let esbuild handle bundling and minification
        await esbuild.build({
            entryPoints: [ENTRY_POINT],
            bundle: true,
            minify: true,
            outfile: path.join(OUTPUT_DIR, 'bundle.min.js'),
            format: 'iife', // Wraps the code safely
        });
        console.log('✅ JavaScript bundled and obfuscated successfully.');

        // 3. Process and copy index.html, adding a cache-busting query string
        const cacheBuster = Date.now();
        let htmlContent = await fs.readFile(HTML_FILE, 'utf-8');
        
        htmlContent = htmlContent.replace(
            /<script type="module" src=".*?main\.js.*?"><\/script>/,
            `<script src="bundle.min.js?v=${cacheBuster}"></script>`
        );
        htmlContent = htmlContent.replace(
            /<link rel="stylesheet" href=".*?style\.css.*?"/,
            `<link rel="stylesheet" href="style.css?v=${cacheBuster}"`
        );
        
        await fs.writeFile(path.join(OUTPUT_DIR, HTML_FILE), htmlContent);
        console.log('✅ index.html processed for deployment.');

        // 4. Copy stylesheet
        await fs.copyFile(STYLESHEET, path.join(OUTPUT_DIR, STYLESHEET));
        console.log('✅ Stylesheet copied.');

        console.log('\n🎉 Build complete! Your game is ready in the "dist" folder.');

    } catch (error) {
        console.error('❌ Build failed:', error);
        process.exit(1);
    }
}

build();