// index.js

const readline = require('readline');
const { execa } = require('execa');

// Setup MCP-compliant STDIO interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

async function handleRequest(line) {
  try {
    const request = JSON.parse(line);
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

    // Execute exiftool with provided args array safely
    const { stdout } = await execa('exiftool', params.args);

    // Return success response
    const response = {
      id,
      result: stdout,
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

rl.on('line', handleRequest);
