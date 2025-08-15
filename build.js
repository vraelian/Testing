// build.js
const fs = require('fs').promises;
const path = require('path');
const https = require('https');

// --- Configuration ---
const SOURCE_DIR = 'js';
const HTML_FILE = 'index.html';
const STYLESHEET = 'style.css';
const OUTPUT_DIR = 'dist';
const OUTPUT_JS = 'bundle.min.js';
const MINIFIER_API_URL = 'https://www.toptal.com/developers/javascript-minifier/api/raw';

// A specific, hardcoded order to ensure dependencies are met correctly.
const FILE_ORDER = [
    'data/constants.js',
    'data/dateConfig.js',
    'utils.js',
    'data/gamedata.js',
    'data/config.js',
    'services/simulation/MarketService.js',
    'services/event-effects/effectSpaceRace.js',
    'services/event-effects/effectAdriftPassenger.js',
    'services/eventEffectResolver.js',
    'services/GameState.js',
    'services/UIManager.js',
    'services/MissionService.js',
    'services/TutorialService.js',
    'services/SimulationService.js',
    'services/EventManager.js',
    'main.js'
];

/**
 * A simple logger for the build process.
 * @param {string} message - The message to log.
 * @param {'info'|'success'|'error'} type - The type of message.
 */
function log(message, type = 'info') {
    const colors = {
        info: '\x1b[36m', // Cyan
        success: '\x1b[32m', // Green
        error: '\x1b[31m', // Red
        reset: '\x1b[0m'
    };
    console.log(`${colors[type]}[Builder] ${message}${colors.reset}`);
}

/**
 * Minifies JavaScript code using an online API.
 * @param {string} code - The JavaScript code to minify.
 * @returns {Promise<string>} The minified JavaScript code.
 */
function minifyCode(code) {
    return new Promise((resolve, reject) => {
        const data = new URLSearchParams({ input: code });
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            }
        };

        const req = https.request(MINIFIER_API_URL, options, (res) => {
            if (res.statusCode < 200 || res.statusCode >= 300) {
                return reject(new Error(`API responded with status code: ${res.statusCode}`));
            }
            let minifiedCode = '';
            res.on('data', (chunk) => minifiedCode += chunk);
            res.on('end', () => resolve(minifiedCode));
        });

        req.on('error', (e) => reject(e));
        req.write(data.toString());
        req.end();
    });
}

/**
 * The main function to build and obfuscate the project.
 */
async function build() {
    log('Starting the build process...');
    try {
        // 1. Ensure the output directory exists
        await fs.mkdir(OUTPUT_DIR, { recursive: true });
        log(`Output directory '${OUTPUT_DIR}' is ready.`);

        // 2. Read all JS files in the correct order and combine them
        let combinedJs = '';
        for (const file of FILE_ORDER) {
            const filePath = path.join(__dirname, SOURCE_DIR, file);
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                // Remove ES module syntax as we are combining files manually
                const cleanContent = content.replace(/import .* from .*/g, '').replace(/export /g, '');
                combinedJs += `\n// --- ${file} ---\n` + cleanContent;
            } catch (error) {
                throw new Error(`Failed to read file: ${filePath}. Make sure it exists.`);
            }
        }
        log('Combined all JavaScript files in the correct order.');

        // 3. Minify (obfuscate) the combined code
        log('Obfuscating code via minification...');
        const minifiedJs = await minifyCode(combinedJs);
        await fs.writeFile(path.join(__dirname, OUTPUT_DIR, OUTPUT_JS), minifiedJs);
        log(`Successfully obfuscated and saved to '${OUTPUT_DIR}/${OUTPUT_JS}'.`, 'success');

        // 4. Update and copy index.html
        let htmlContent = await fs.readFile(path.join(__dirname, HTML_FILE), 'utf-8');
        htmlContent = htmlContent.replace(
            /<script type="module" src=".*?"><\/script>/,
            `<script src="${OUTPUT_JS}"></script>`
        );
        await fs.writeFile(path.join(__dirname, OUTPUT_DIR, HTML_FILE), htmlContent);
        log(`Updated and copied '${HTML_FILE}'.`);

        // 5. Copy stylesheet
        await fs.copyFile(
            path.join(__dirname, STYLESHEET),
            path.join(__dirname, OUTPUT_DIR, STYLESHEET)
        );
        log(`Copied '${STYLESHEET}'.`);

        log('Build complete! Your obfuscated game is in the "dist" folder.', 'success');

    } catch (error) {
        log(`Build failed: ${error.message}`, 'error');
    }
}

build();