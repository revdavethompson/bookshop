#!/usr/bin/env node

// cli.js
import fs from 'fs-extra';
import cliui from 'cliui';
import { fileURLToPath } from 'url';
import { Command } from 'commander';
import convert from './lib/convert.js';
import path from 'path';
import nodemon from 'nodemon';
import { spawn } from 'child_process';
import chalk from 'chalk';
import createNewBookProject from './lib/create-new-book.js'
import yaml from 'js-yaml';
import lintEjs from './lib/lint-ejs.js'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packageJson = process.env.TEST_PACKAGE_JSON || JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf-8'));

const manuscriptDir = process.env.TEST_MANUSCRIPT || path.join(process.cwd(), 'manuscript');
const manRel = path.relative(process.cwd(), manuscriptDir);

// Load the book.config.yml into the book object
const book = await loadBookConfig();

const program = new Command();
program.version(packageJson.version);

program
    .command('build')
    .option('-t, --type <type>', 'Specify the output type (html or pdf)', 'html')
    .description('Build the output from the manuscript markdown files')
    .action(async (options) => {
        console.log(`\nBuilding ${options.type.toUpperCase()} Format...\n`);
        if (options.type === 'html') {
            await buildHtml(book, manuscriptDir, path.join(process.cwd(), 'build', 'html'), options.type);
        } else if (options.type === 'pdf') {
            await buildPdf(book, manuscriptDir, path.join(process.cwd(), 'build', 'pdf'), options.type);
        } else {
            console.error('Invalid output type specified. Use either "html" or "pdf".');
        }
        console.log(chalk.greenBright(`
    ---------------------------
        Yay! Your ${chalk.greenBright(options.type.toUpperCase())} Book Was Built!!
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
            await runWebpackDevServerAsync('html');
            await runNodemonAsync('html');
        } else if (options.type === 'pdf') {
            await runWebpackDevServerAsync('pdf');
            await runNodemonAsync('pdf');
        } else {
            console.error('Invalid output type specified. Use either "html" or "pdf".');
        }

    });

program
    .command('new <projectName>')
    .description('Create a new book project')
    .action(async (projectName) => {
        console.log(chalk.greenBright(`\nLet\'s create your new book project: ${chalk.yellowBright(projectName)}\n`));

        console.log(chalk.greenBright(`First, we need to ask you a few basic questions...\n`));

        await createNewBookProject(projectName);
    });

program
    .command('lint [fileName]')
    .description('Lint EJS files in the manuscript folder.\n     \'bookpub lint\' - If no file name is specified, all EJS files will be linted.\n     \'bookpub lint [filename]\' - If a file name is specified, only that file will be linted.')
    .action(async (fileName) => {

        try {
            if (fileName) {
                // Lint a specific file
                console.log(chalk.greenBright(`\n     Linting EJS file: ${fileName}\n`));
                await lintEjs(path.join(manuscriptDir, fileName));
            } else {
                // Lint all EJS files
                console.log(chalk.greenBright(`\n     Linting EJS files in the ${chalk.yellowBright(manRel)} folder.\n`));
                await lintEjs(manuscriptDir);
            }
            console.log(chalk.greenBright('     Excellent!! All EJS files passed linting!\n\n'));
        } catch (error) {
            console.error(chalk.redBright(`     Looks like we ${error.message}`));
        }
    });

async function loadBookConfig() {
    try {
        const book = yaml.load(fs.readFileSync(path.join(process.cwd(), 'book.config.yml'), 'utf-8'));
        return book;
    } catch (error) {
        console.error(chalk.redBright(`Error: ${error.message}`));
    }
}



async function buildHtml(book, manuscriptDir, outputDir, outputType) {
    const outRel = path.relative(process.cwd(), outputDir);
    console.log(`    Manuscript Location: ${chalk.yellowBright(`/${manRel}/`)}\n      Build Output Location: ${chalk.yellowBright(`/${outRel}/`)}\n\n`)
    try {
        await convert(book, manuscriptDir, outputDir, outputType);
    } catch (error) {
        const ui = cliui({ wrap: false });
        ui.div(
            { text: chalk.redBright('Unfortunately we couldn\'t build the HTML format.\n Please see the messages above.'), padding: [0, 0, 0, 5] }
        );
        ui.div(
            { text: chalk.redBright(error.message), padding: [0, 0, 0, 5] }
        )
        console.error(ui.toString());
        process.exit(1); // Exit the process with an error code
    }
}

async function buildPdf(book, manuscriptDir, outputDir, outputType) {
    await buildHtml(book, manuscriptDir, outputDir, outputType);

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

// Setup nodemon function to return as a Promise
function runNodemonAsync(outputType) {
    return new Promise(async (resolve, reject) => {
        await runNodemon(outputType);
        nodemon
            .on('quit', resolve)
            .on('error', reject);
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

async function runNodemon(outputType) {
    const env = { outputType };
    const userNodemonConfig = await getNodemonConfig(env);
    let nodemonConfig = {};

    if (userNodemonConfig) {
        nodemonConfig = userNodemonConfig;
    } else {
        // If the user's nodemon.js file is not found or is not valid, use default settings
        nodemonConfig = {
            script: __filename,
            ext: outputType === 'pdf' ? 'md,mdx,js,ejs,json,html,css,scss,yaml' : 'md,mdx,js,ejs,json,html,css,scss,yaml',
            exec: `bookpub build --type ${outputType}`,
            watch: 'manuscript',
        };
    }

    // Return the nodemon instance
    return nodemon(nodemonConfig).on('restart', async () => {
        console.log(chalk.yellowBright(`Rebuilding ${outputType.toUpperCase()}...`));
    });
}

async function getNodemonConfig(env) {
    const userNodemonConfigPath = path.join(process.cwd(), 'nodemon.js');

    if (fs.existsSync(userNodemonConfigPath)) {
        const userNodemonConfig = await import(userNodemonConfigPath);
        return userNodemonConfig.default(env);
    }

    return null;
}


program.parseAsync(process.argv);
