#!/usr/bin/env node

// cli.js
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Command } from 'commander';
import convert from './lib/convert.js';
import path from 'path';
import nodemon from 'nodemon';
import { readFileSync, existsSync } from 'fs';
import { spawn } from 'child_process';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));

const manuscriptDir = path.join(process.cwd(), 'manuscript');
const manRel = path.relative(process.cwd(), manuscriptDir);

const program = new Command();
program.version(packageJson.version);

async function buildHtml(manuscriptDir, outputDir, outputType) {
    const outRel = path.relative(process.cwd(), outputDir);
    console.log(`    Manuscript Location: ${chalk.yellowBright(`/${manRel}/`)}\n    Build Output Location: ${chalk.yellowBright(`/${outRel}/`)}\n\n`)
    await convert(manuscriptDir, outputDir, outputType);
}

async function buildPdf(manuscriptDir, outputDir, outputType) {
    await buildHtml(manuscriptDir, outputDir, outputType);

    try {
        const pdfOutDirRel = path.relative(process.cwd(), outputDir);
        // Run the prince command-line tool
        console.log(`  10. Building your Print PDF to ${chalk.yellowBright(`/${pdfOutDirRel}/index.pdf`)}\n `);
        const prince = spawn('prince', ['build/pdf/index.html'], { stdio: 'inherit' });
        prince.on('error', (error) => {
            console.error(`Error: ${error.message}`);
        });

        return prince;
    } catch (error) {
        console.error(chalk.redBright('  Bummer. We couldn\'t build your pdf, because:'), chalk.redBright(error + '\n'));
    }
}

program
    .command('build')
    .option('-t, --type <type>', 'Specify the output type (html or pdf)', 'html')
    .description('Build the output from the manuscript markdown files')
    .action(async (options) => {
        console.log(`\nBuilding ${options.type.toUpperCase()} Format...\n`);
        if (options.type === 'html') {
            await buildHtml(manuscriptDir, path.join(process.cwd(), 'build', 'html'), options.type);
        } else if (options.type === 'pdf') {
            await buildPdf(manuscriptDir, path.join(process.cwd(), 'build', 'pdf'), options.type);
        } else {
            console.error('Invalid output type specified. Use either "html" or "pdf".');
        }
        console.log(chalk.greenBright(`
    ---------------------------
        Yay! All Finished!!
    ---------------------------
        `));
    });

program
    .command('dev')
    .option('-t, --type <type>', 'Specify the output type (html or pdf)', 'html')
    .description('Run the development server with live-reloading')
    .action(async (options) => {
        console.log(`\nRunning Nodemon and Webpack Server for ${options.type.toUpperCase()}...\n`);
        if (options.type === 'html') {
            await buildHtml(manuscriptDir, path.join(process.cwd(), 'build', 'html'), options.type);
            await runWebpackDevServerAsync('html');
            await runNodemonAsync('html');
        } else if (options.type === 'pdf') {
            await buildPdf(manuscriptDir, path.join(process.cwd(), 'build', 'pdf'), options.type);
            await runWebpackDevServerAsync('pdf');
            await runNodemonAsync('pdf');
        } else {
            console.error('Invalid output type specified. Use either "html" or "pdf".');
        }
    });

// Setup nodemon function to return as a Promise
function runNodemonAsync(outputType) {
    return new Promise((resolve, reject) => {
        runNodemon(outputType).on('quit', resolve).on('error', reject);
    });
}

// Run the webpack server using default settings
async function runWebpackDevServerAsync(outputType) {
    // Find the absolute path to the webpack-cli binary inside the bookpub package
    const bookpubNodeModules = path.join(__dirname, 'node_modules');
    const webpackCliPath = path.join(bookpubNodeModules, 'webpack-cli', 'bin', 'cli.js');

    // Check if the user's webpack.config.js file exists
    const userWebpackConfigPath = path.join(process.cwd(), 'webpack.config.js');
    const configFlag = fs.existsSync(userWebpackConfigPath) ? ['--config', userWebpackConfigPath] : [];

    const server = spawn(
        'node',
        [webpackCliPath, 'serve', '--env', `outputType=${outputType}`, ...configFlag],
        { stdio: 'inherit' }
    );

    server.on('error', (error) => {
        console.error(`Error: ${error.message}`);
    });

    return server;
}

// Use Nodemon to watch for changes and rebuild/serve/refresh

// Helper function to validate the user's nodemon.json file
function validateUserNodemonConfig(config) {
    if (!config || !config.execMap || !config.execMap.html) {
        return false;
    }
    return true;
}

function runNodemon(outputType) {
    const userNodemonConfigPath = path.join(process.cwd(), 'nodemon.json');
    let nodemonConfig = {};

    // Check if the user's nodemon.json file exists
    if (existsSync(userNodemonConfigPath)) {
        const userNodemonConfig = JSON.parse(readFileSync(userNodemonConfigPath, 'utf-8'));

        // Validate the user's nodemon.json configuration
        if (validateUserNodemonConfig(userNodemonConfig)) {
            nodemonConfig = { configFile: userNodemonConfigPath };
        }
    }

    // If the user's nodemon.json file is not found or is not valid, use default settings
    if (!nodemonConfig.configFile) {
        console.log(`Using default Nodemon settings with outputType: ${outputType}.`);
        nodemonConfig = {
            script: __filename,
            ext: outputType === 'pdf' ? 'md,mdx,js,ejs,json,html,css,scss,yaml' : 'md,mdx,js,ejs,json,html,css,scss,yaml',
            exec: `bookpub build --type ${outputType}`,
            watch: 'manuscript',
        };
    }

    return nodemon(nodemonConfig).on('restart', async () => {
        console.log(`Rebuilding ${outputType.toUpperCase()}...`);
        if (outputType === 'html') {
            await buildHtml(manuscriptDir, path.join(process.cwd(), 'build', 'html'), outputType);
        } else if (outputType === 'pdf') {
            await buildPdf(manuscriptDir, path.join(process.cwd(), 'build', 'pdf'), outputType);
        }
    });
}


program.parseAsync(process.argv);