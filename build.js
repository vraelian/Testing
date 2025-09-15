// build.js
const fs = require('fs').promises;
const path = require('path');
const esbuild = require('esbuild');

const ENTRY_POINT = `js/main.js`;
const OUTPUT_DIR = 'dist';
const HTML_FILE = 'index.html';
const CSS_FILES = [
    './css/global.css',
    './css/navigation.css',
    './css/modals.css',
    './css/hud.css',
    './css/missions.css',
    './css/tutorial.css',
    './css/debug.css',
    './css/screens/market-screen.css',
    './css/screens/hangar-screen.css',
    './css/screens/navigation-screen.css',
    './css/screens/finance-screen.css'
];


async function build() {
    console.log('🚀 Starting professional build process with esbuild...');

    try {
        // 1. Clean and create the output directory
        await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
        await fs.mkdir(OUTPUT_DIR, { recursive: true });

        // 2. Bundle and minify JavaScript
        await esbuild.build({
            entryPoints: [ENTRY_POINT],
            bundle: true,
            minify: true,
            outfile: path.join(OUTPUT_DIR, 'bundle.min.js'),
            format: 'iife',
        });
        console.log('✅ JavaScript bundled and obfuscated successfully.');

        // 3. Concatenate and minify CSS
        const cssContent = await Promise.all(CSS_FILES.map(file => fs.readFile(file, 'utf-8')));
        const combinedCss = cssContent.join('\n');
        
        const minifiedCss = await esbuild.transform(combinedCss, {
            loader: 'css',
            minify: true,
        });

        await fs.writeFile(path.join(OUTPUT_DIR, 'style.css'), minifiedCss.code);
        console.log('✅ CSS bundled and minified successfully.');

        // 4. Process and copy index.html, adding a cache-busting query string
        const cacheBuster = Date.now();
        let htmlContent = await fs.readFile(HTML_FILE, 'utf-8');
        
        htmlContent = htmlContent.replace(
            /<script type="module" src=".*?main\.js.*?"><\/script>/,
            `<script src="bundle.min.js?v=${cacheBuster}"></script>`
        );
        
        // This regex will find and remove all the original CSS links
        htmlContent = htmlContent.replace(/<link rel="stylesheet" href=".\/css\/.*?.css">/g, '');
        
        // Add the new bundled stylesheet link
        htmlContent = htmlContent.replace(
            '</head>',
            `    <link rel="stylesheet" href="style.css?v=${cacheBuster}">\n</head>`
        );
        
        await fs.writeFile(path.join(OUTPUT_DIR, HTML_FILE), htmlContent);
        console.log('✅ index.html processed for deployment.');

        console.log('\n🎉 Build complete! Your game is ready in the "dist" folder.');

    } catch (error) {
        console.error('❌ Build failed:', error);
        process.exit(1);
    }
}

build();