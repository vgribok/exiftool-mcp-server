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

    if (!params || !params.filePath) {
      throw new Error('Missing "filePath" parameter');
    }

    // Execute exiftool
    const { stdout } = await execa('exiftool', [params.filePath]);

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