import { createServer } from '@modelcontextprotocol/server';
import { execa } from 'execa';

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

async function runExiftool(args) {
  if (!args.includes('-j') && !args.includes('-json')) {
    args.unshift('-j');
  }
  try {
    const { stdout } = await execa('exiftool', args);
    return JSON.parse(stdout);
  } catch (err) {
    if (err.code === 'ENOENT' || (err.stderr && /exiftool(?!.*not found)/i.test(err.stderr) && /not found|no such file|command not found/i.test(err.stderr))) {
      throw new Error('ExifTool executable not found. Please install ExifTool from https://exiftool.org/ and ensure it is in your system PATH.');
    }
    if (err.message && err.message.startsWith('Failed to parse exiftool JSON output:')) {
      throw err;
    }
    throw new Error('Failed to run exiftool: ' + err.message);
  }
}

function parseDMS(dmsString) {
  if (typeof dmsString !== 'string') return null;

  const dmsRegex = /(\d+)\s*deg\s*(\d+)'?\s*([\d.]+)"?\s*([NSEW])/i;
  const match = dmsString.match(dmsRegex);
  if (!match) return null;

  const degrees = parseFloat(match[1]);
  const minutes = parseFloat(match[2]);
  const seconds = parseFloat(match[3]);
  const direction = match[4].toUpperCase();

  let decimal = degrees + minutes / 60 + seconds / 3600;
  if (direction === 'S' || direction === 'W') {
    decimal = -decimal;
  }
  return decimal;
}

function convertGpsCoordinates(exifDataArray) {
  if (!Array.isArray(exifDataArray)) return exifDataArray;

  return exifDataArray.map((item) => {
    const newItem = { ...item };

    if (newItem.GPSLatitude) {
      const latDecimal = parseDMS(newItem.GPSLatitude);
      if (latDecimal !== null) {
        newItem.GPSLatitudeGoogleMapsCompatible = latDecimal;
      }
    }

    if (newItem.GPSLongitude) {
      const lonDecimal = parseDMS(newItem.GPSLongitude);
      if (lonDecimal !== null) {
        newItem.GPSLongitudeGoogleMapsCompatible = lonDecimal;
      }
    }

    return newItem;
  });
}

const server = createServer({
  tools: [
    {
      name: 'all_or_some',
      description: 'Return all or some EXIF properties. If args are not supplied, return all.',
      parameters: {
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
      run: async (params) => {
        if (params.args) {
          validateArgs(params.args);
        }
        let args = params.args || [];

        args = args.map((prop, idx) => {
          const cleanProp = prop.startsWith('-') ? prop.slice(1) : prop;
          return idx < args.length - 1 ? `-${cleanProp}` : prop;
        });

        const result = await runExiftool(args);
        return { result: convertGpsCoordinates(result) };
      },
    },
    {
      name: 'location',
      description: 'Return GPS-related EXIF metadata.',
      parameters: {
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
      run: async (params) => {
        if (params.args) {
          validateArgs(params.args);
        }
        let args = gpsTags;
        if (params.args && params.args.length > 0) {
          args = args.concat(params.args);
        }
        const result = await runExiftool(args);
        return { result: convertGpsCoordinates(result) };
      },
    },
    {
      name: 'timestamp',
      description: 'Return timestamp-related EXIF metadata.',
      parameters: {
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
      run: async (params) => {
        if (params.args) {
          validateArgs(params.args);
        }
        let args = timeTags;
        if (params.args && params.args.length > 0) {
          args = args.concat(params.args);
        }
        const result = await runExiftool(args);
        return { result: convertGpsCoordinates(result) };
      },
    },
    {
      name: 'location_and_timestamp',
      description: 'Return both GPS and timestamp EXIF metadata.',
      parameters: {
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
      run: async (params) => {
        if (params.args) {
          validateArgs(params.args);
        }
        let args = gpsTags.concat(timeTags);
        if (params.args && params.args.length > 0) {
          args = args.concat(params.args);
        }
        const result = await runExiftool(args);
        return { result: convertGpsCoordinates(result) };
      },
    },
  ],
});

server.listen(0, () => {
  console.log('MCP Server started and listening on stdin/stdout');
});
