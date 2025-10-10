// build.js
import esbuild from 'esbuild';
import fs from 'fs-extra';
import { glob } from 'glob';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';

console.log("\n\u{1F680} Starting professional build process with esbuild...");

try {
    // 1. Clean the 'dist' directory
    await fs.emptyDir('dist');

    // 2. Define the exact order for CSS files to ensure correct cascading
    const cssFiles = [
        'css/global.css',
        'css/navigation.css',
        'css/modals.css',
        'css/hud.css',
        'css/missions.css',
        'css/tutorial.css',
        'css/debug.css',
        // 'css/director-mode.css', // Removed this line
        'css/screens/market-screen.css',
        'css/screens/hangar-screen.css',
        'css/screens/navigation-screen.css',
        'css/screens/finance-screen.css'
    ];

    let combinedCss = '';
    for (const file of cssFiles) {
        combinedCss += await fs.readFile(file, 'utf-8');
    }

    // 2a. Apply vendor prefixes using PostCSS and Autoprefixer
    const prefixedResult = await postcss([autoprefixer]).process(combinedCss, { from: undefined });
    
    // 2b. Minify the prefixed CSS with esbuild
    const resultCss = await esbuild.transform(prefixedResult.css, {
        loader: 'css',
        minify: true,
    });
    
    // Create a unique hash for cache busting
    const cssCacheBuster = `?v=${Date.now()}`;
    await fs.writeFile('dist/style.css', resultCss.code);
    console.log('\u2705 CSS bundled and minified successfully.');

    // 3. Process JavaScript files
    await esbuild.build({
        entryPoints: ['js/main.js'],
        bundle: true,
        minify: true,
        sourcemap: false,
        outfile: 'dist/bundle.min.js',
        format: 'iife',
    });
    console.log('\u2705 JavaScript bundled and obfuscated successfully.');
    const jsCacheBuster = `?v=${Date.now()}`;

    // 4. Process index.html to link to the new bundled files and remove old links
    let htmlContent = await fs.readFile('index.html', 'utf-8');
    
    // Remove all individual CSS links
    const cssLinkRegex = /<link rel="stylesheet" href=".\/css\/[^"]+">/g;
    htmlContent = htmlContent.replace(cssLinkRegex, '');

    // Add the single bundled stylesheet with cache buster
    htmlContent = htmlContent.replace(/<link rel="stylesheet" href="style.css.*">/, `<link rel="stylesheet" href="style.css${cssCacheBuster}">`);
    if (!htmlContent.includes('style.css')) {
         htmlContent = htmlContent.replace('</head>', `    <link rel="stylesheet" href="style.css${cssCacheBuster}">\n</head>`);
    }

    // Replace the module script with the bundled script
    htmlContent = htmlContent.replace('<script type="module" src="./js/main.js"></script>', `<script src="bundle.min.js${jsCacheBuster}"></script>`);
    
    await fs.writeFile('dist/index.html', htmlContent);
    console.log('\u2705 index.html processed for deployment.');

    console.log(`\n\u{1F389} Build complete! Your game is ready in the "dist" folder.\n`);

} catch (error) {
    console.error("\n\u{1F6AB} Build failed:", error);
    process.exit(1);
}