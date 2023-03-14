#!/usr/bin/env node

import { program } from 'commander';

// Define the available commands and their arguments
program
    .command('build <type>')
    .description('Build the project')
    .action((type) => {
        switch (type) {
            case 'html':
                console.log('Building HTML');
                // Execute the npm script for building HTML
                break;
            case 'html-static':
                console.log('Building static HTML');
                // Execute the npm script for building static HTML
                break;
            case 'pdf':
                console.log('Building PDF');
                // Execute the npm script for building PDF
                break;
            case 'print':
                console.log('Building print');
                // Execute the npm script for building print
                break;
            case 'epub':
                console.log('Building EPUB');
                // Execute the npm script for building EPUB
                break;
            case 'mobi':
                console.log('Building MOBI');
                // Execute the npm script for building MOBI
                break;
            default:
                console.log(`Unknown build type: ${type}`);
                break;
        }
    });

program
    .command('new <project-name>')
    .description('Create a new project')
    .action((projectName) => {
        console.log(`Creating new project "${projectName}"`);
        // Execute the necessary commands for creating a new project
    });

program
    .command('dev')
    .description('Start the development server')
    .action(() => {
        console.log('Starting development server');
        // Execute the necessary commands for starting the development server
    });

// Parse the command line arguments
program.parse(process.argv);


/*

const { spawn } = require('child_process');

switch (type) {
  case 'html':
    console.log('Building HTML');
    // Execute the npm script for building HTML
    spawn('npm', ['run', 'build'], { stdio: 'inherit' });
    break;
  // ...
}
You can modify the other cases similarly to execute the corresponding npm run command.

*/