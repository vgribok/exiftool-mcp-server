#!/usr/bin/env node
// index.js

import readline from 'readline';
import { execa } from 'execa';

let buffer = '';

// Define tool metadata for client discovery
const tools = {
  all_or_some: {
    description: 'Return all or some EXIF properties. If args are not supplied, return all.',
    inputSchema: {
      type: 'object',
      properties: {
        args: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of EXIF property names to return',
        },
      },
      required: [],
    },
  },
  location: {
    description: 'Return GPS-related EXIF metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        args: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional additional args for exiftool',
        },
      },
      required: [],
    },
  },
  timestamp: {
    description: 'Return timestamp-related EXIF metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        args: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional additional args for exiftool',
        },
      },
      required: [],
    },
  },
  location_and_timestamp: {
    description: 'Return both GPS and timestamp EXIF metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        args: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional additional args for exiftool',
        },
      },
      required: [],
    },
  },
};

// Setup MCP-compliant STDIO interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false,
});

// Helper function to validate args array
function validateArgs(args) {
  if (!Array.isArray(args)) {
    throw new Error('"args" parameter must be an array of strings');
  }
  if (!args.every(arg => typeof arg === 'string')) {
    throw new Error('"args" parameter must be an array of strings');
  }
  const forbiddenChars = [';', '&', '|', '`', '$', '>', '<', '\\'];
  for (const arg of args) {
    for (const char of forbiddenChars) {
      if (arg.includes(char)) {
        throw new Error(`Invalid character "${char}" detected in argument: ${arg}`);
      }
    }
  }
}

// Helper function to run exiftool with args and parse JSON output
async function runExiftool(args) {
  if (!args.includes('-j') && !args.includes('-json')) {
    args.unshift('-j');
  }
  const { stdout } = await execa('exiftool', args);
  try {
    return JSON.parse(stdout);
  } catch (err) {
    throw new Error('Failed to parse exiftool JSON output: ' + err.message);
  }
}

// Define reusable tag arrays
const gpsTags = [
  '-GPSLatitude',
  '-GPSLongitude',
  '-GPSAltitude',
  '-GPSLatitudeRef',
  '-GPSLongitudeRef',
  '-GPSAltitudeRef',
];

const timeTags = [
  '-DateTimeOriginal',
  '-CreateDate',
  '-ModifyDate',
  '-OffsetTimeOriginal',
  '-OffsetTime',
  '-MediaCreateDate',
  '-MediaModifyDate',
  '-TrackCreateDate',
  '-TrackModifyDate',
  '-CreationDate',
  '-ContentCreateDate',
  '-ContentModifyDate',
];

// Tool handlers
async function handleAllOrSome(params) {
  let args = params.args || [];
  if (args.length === 0) {
    args = ['-j'];
  } else {
    // Prefix each property with '-' for all but the last element
    args = args.map((prop, idx) => idx < args.length - 1 ? `-${prop}` : prop);
    args.unshift('-j');
  }
  return await runExiftool(args);
}

async function handleLocation(params) {
  let args = gpsTags;
  if (params.args && params.args.length > 0) {
    args = args.concat(params.args);
  }
  return await runExiftool(args);
}

async function handleTimestamp(params) {
  let args = timeTags;
  if (params.args && params.args.length > 0) {
    args = args.concat(params.args);
  }
  return await runExiftool(args);
}

async function handleLocationAndTimestamp(params) {
  let args = gpsTags.concat(timeTags);
  if (params.args && params.args.length > 0) {
    args = args.concat(params.args);
  }
  return await runExiftool(args);
}

// Main request processor
async function processRequest(request) {
  try {
    const { id, tool, params } = request;

    if (!tool) {
      // If no tool specified, return list of tools for client discovery
      const response = {
        id,
        result: {
          tools,
        },
      };
      console.log(JSON.stringify(response));
      return;
    }

    if (!tools[tool]) {
      throw new Error(`Unknown tool: ${tool}`);
    }

    if (!params) {
      throw new Error('Missing "params" object');
    }

    if (params.args) {
      validateArgs(params.args);
    }

    let result;
    switch (tool) {
      case 'all_or_some':
        result = await handleAllOrSome(params);
        break;
      case 'location':
        result = await handleLocation(params);
        break;
      case 'timestamp':
        result = await handleTimestamp(params);
        break;
      case 'location_and_timestamp':
        result = await handleLocationAndTimestamp(params);
        break;
      default:
        throw new Error(`Unhandled tool: ${tool}`);
    }

    const response = {
      id,
      result,
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
