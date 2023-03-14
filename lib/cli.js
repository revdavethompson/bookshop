#!/usr/bin/env node

const { program } = require('commander');
const { execSync } = require('child_process');
const path = require('path');

// Define __dirname for ES module - so we can use it like CommonJS
const __dirname = path.dirname(new URL(import.meta.url).pathname);

program
    .command('build [type]')
    .description('build the book')
    .action((type) => {
        // Run the build script with the specified type (or 'html' by default)
        const command = `npm run build -- --type=${type || 'html'}`;
        execSync(command, {
            stdio: 'inherit',
            cwd: __dirname,
        });
    });

program.parse(process.argv);
