#!/usr/bin/env node
// index.js

import readline from 'readline';
import { execa } from 'execa';
let buffer = '';

// Setup MCP-compliant STDIO interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

async function processRequest(request) {
  try {
    const { id, params } = request;

    if (!params || !Array.isArray(params.args)) {
      throw new Error('Missing or invalid "args" parameter: must be an array of strings');
    }

    // Validate that all elements in args are strings
    if (!params.args.every(arg => typeof arg === 'string')) {
      throw new Error('"args" parameter must be an array of strings');
    }

    // Additional validation to prevent shell metacharacters that could be used for command injection
    const forbiddenChars = [';', '&', '|', '`', '$', '>', '<', '\\'];
    for (const arg of params.args) {
      for (const char of forbiddenChars) {
        if (arg.includes(char)) {
          throw new Error(`Invalid character "${char}" detected in argument: ${arg}`);
        }
      }
    }

    // Ensure "-j" switch is present in args for JSON output
    if (!params.args.includes('-j')) {
      params.args.unshift('-j');
    }

    // Execute exiftool with provided args array safely
    const { stdout } = await execa('exiftool', params.args);

    // Parse JSON output from exiftool
    let parsedResult;
    try {
      parsedResult = JSON.parse(stdout);
    } catch (parseError) {
      throw new Error('Failed to parse exiftool JSON output: ' + parseError.message);
    }

    // Return success response with parsed JSON result
    const response = {
      id,
      result: parsedResult,
    };
    console.log(JSON.stringify(response));
  } catch (err) {
    const error = {
      id: null,
      error: {
        message: err.message,
      },
    };
    console.log(JSON.stringify(error));
  }
}

let openBracesCount = 0;

rl.on('line', async (line) => {
  buffer += line + '\n';

  // Count opening and closing curly braces in the new line
  for (const char of line) {
    if (char === '{') {
      openBracesCount++;
    } else if (char === '}') {
      openBracesCount--;
    }
  }

  // When openBracesCount returns to zero, we have a complete JSON object
  if (openBracesCount === 0 && buffer.trim() !== '') {
    try {
      const request = JSON.parse(buffer);
      buffer = '';
      await processRequest(request);
    } catch (err) {
      const error = {
        id: null,
        error: {
          message: err.message,
        },
      };
      console.log(JSON.stringify(error));
      buffer = '';
      openBracesCount = 0;
    }
  }
});
