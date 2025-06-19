import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execa } from "execa";

const gpsTags = [
  "-GPSLatitude",
  "-GPSLongitude",
  "-GPSAltitude",
  "-GPSLatitudeRef",
  "-GPSLongitudeRef",
  "-GPSAltitudeRef",
] as const;

const timeTags = [
  "-DateTimeOriginal",
  "-CreateDate",
  "-ModifyDate",
  "-OffsetTimeOriginal",
  "-OffsetTime",
  "-MediaCreateDate",
  "-MediaModifyDate",
  "-TrackCreateDate",
  "-TrackModifyDate",
  "-CreationDate",
  "-ContentCreateDate",
  "-ContentModifyDate",
] as const;

function validateArgs(args: unknown): asserts args is string[] {
  if (!Array.isArray(args)) {
    throw new Error('"args" parameter must be an array of strings');
  }
  if (!args.every((arg) => typeof arg === "string")) {
    throw new Error('"args" parameter must be an array of strings');
  }
  const forbiddenChars = [";", "&", "|", "`", "$", ">", "<", "\\"];
  for (const arg of args) {
    for (const char of forbiddenChars) {
      if (arg.includes(char)) {
        throw new Error(`Invalid character "${char}" detected in argument: ${arg}`);
      }
    }
  }
    if (args.length === 0) {
    throw new Error("No arguments provided. A file path argument is required.");
  }

  // Ensure last argument is a valid file path pattern
  const lastArg = args[args.length - 1];
  if (!isValidFilePath(lastArg)) {
    throw new Error(
      `The last argument must be a valid file path (MacOS or Windows). Received: ${lastArg}`
    );
  }
}

let cachedArgs: string[] | undefined = undefined;

function getEffectiveArgs(args?: string[]): string[] {
  if (args && args.length > 0) {
    validateArgs(args);
    cachedArgs = args;
    return args;
  }
  if (cachedArgs) {
    return cachedArgs;
  }
  throw new Error("No arguments provided and no cached arguments available.");
}

function isValidFilePath(path: string): boolean {
  // Basic pattern check for MacOS and Windows file paths
  // MacOS: starts with / or ~ or relative path (./ or ../) or /Volumes/ for network shares
  // Windows: drive letter + :\ or UNC path \\

  const macosPattern = /^(\/|~\/|\.\/|\.\.\/|\/Volumes\/).+/;
  const windowsPattern = /^(?:[a-zA-Z]:\\|\\\\)/;

  return macosPattern.test(path) || windowsPattern.test(path);
}

function prepareExiftoolArgs(
  args: string[],
  toolName: string
): string[] {
  if (!args.includes("-j") && !args.includes("-json")) {
    args.unshift("-j");
  }

  // For tools other than "all_or_some", ensure no arguments other than the file path
  if (toolName !== "all_or_some") {
    if (args.length > 1) {
      // Only last argument (file path) allowed
      throw new Error(
        `Tool "${toolName}" accepts no arguments other than the file path.`
      );
    }
  }

  // Ensure all arguments except last start with "-"
  const preparedArgs = args.map((arg, idx) => {
    if (idx === args.length - 1) {
      return arg; // last arg is file path, leave as is
    }
    return arg.startsWith("-") ? arg : `-${arg}`;
  });

  return preparedArgs;
}

async function runExiftool(args: string[], toolName = "all_or_some"): Promise<any[]> {
  const preparedArgs = prepareExiftoolArgs(args, toolName);
  try {
    const { stdout } = await execa("exiftool", preparedArgs);
    return JSON.parse(stdout);
  } catch (err: any) {
    if (
      err.code === "ENOENT" ||
      (err.stderr &&
        /exiftool(?!.*not found)/i.test(err.stderr) &&
        /not found|no such file|command not found/i.test(err.stderr))
    ) {
      throw new Error(
        "ExifTool executable not found. Please install ExifTool from https://exiftool.org/ and ensure it is in your system PATH."
      );
    }
    if (err.message && err.message.startsWith("Failed to parse exiftool JSON output:")) {
      throw err;
    }
    throw new Error("Failed to run exiftool: " + err.message);
  }
}

function parseDMS(dmsString: string | undefined): number | null {
  if (typeof dmsString !== "string") return null;

  const dmsRegex = /(\d+)\s*deg\s*(\d+)'?\s*([\d.]+)"?\s*([NSEW])/i;
  const match = dmsString.match(dmsRegex);
  if (!match) return null;

  const degrees = parseFloat(match[1]);
  const minutes = parseFloat(match[2]);
  const seconds = parseFloat(match[3]);
  const direction = match[4].toUpperCase();

  let decimal = degrees + minutes / 60 + seconds / 3600;
  if (direction === "S" || direction === "W") {
    decimal = -decimal;
  }
  return decimal;
}

function convertGpsCoordinates(exifDataArray: any[]): any[] {
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

const server = new McpServer({
  name: "ExifTool MCP Server",
  version: "1.0.0",
});


server.tool(
  "all_or_some",
  {
    args: z.array(z.string()).optional(),
  },
  async ({ args }: { args?: string[] }) => {
    let runArgs = getEffectiveArgs(args);

    runArgs = runArgs.map((prop, idx) => {
      const cleanProp = prop.startsWith("-") ? prop.slice(1) : prop;
      return idx < runArgs.length - 1 ? `-${cleanProp}` : prop;
    });

    const result = await runExiftool(runArgs);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(convertGpsCoordinates(result)),
        },
      ],
    };
  }
);

server.tool(
  "location",
  {
    filePath: z.string(),
  },
  async ({ filePath }: { filePath: string }) => {
    if (!isValidFilePath(filePath)) {
      throw new Error('Invalid filePath argument for tool "location".');
    }
    const runArgs = [...gpsTags, filePath];

    const result = await runExiftool(runArgs);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(convertGpsCoordinates(result)),
        },
      ],
    };
  }
);

server.tool(
  "timestamp",
  {
    filePath: z.string(),
  },
  async ({ filePath }: { filePath: string }) => {
    if (!isValidFilePath(filePath)) {
      throw new Error('Invalid filePath argument for tool "timestamp".');
    }
    const runArgs = [...timeTags, filePath];

    const result = await runExiftool(runArgs);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(convertGpsCoordinates(result)),
        },
      ],
    };
  }
);

server.tool(
  "location_and_timestamp",
  {
    filePath: z.string(),
  },
  async ({ filePath }: { filePath: string }) => {
    if (!isValidFilePath(filePath)) {
      throw new Error('Invalid filePath argument for tool "location_and_timestamp".');
    }
    const runArgs = [...gpsTags, ...timeTags, filePath];

    const result = await runExiftool(runArgs);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(convertGpsCoordinates(result)),
        },
      ],
    };
  }
);


server.resource(
  "all_or_some://{args*}",
  new ResourceTemplate("all_or_some://{args*}", { list: undefined }),
  async (uri, params) => {
    const args = params.args as string[] | undefined;
    if (args) {
      validateArgs(args);
    }
    let runArgs = args || [];

    runArgs = runArgs.map((prop, idx) => {
      const cleanProp = prop.startsWith("-") ? prop.slice(1) : prop;
      return idx < runArgs.length - 1 ? `-${cleanProp}` : prop;
    });

    const result = await runExiftool(runArgs);
    return {
      contents: [
        {
          uri: uri.href,
          type: "text",
          text: JSON.stringify(convertGpsCoordinates(result)),
        },
      ],
    };
  }
);

server.resource(
  "location://{filePath}",
  new ResourceTemplate("location://{filePath}", { list: undefined }),
  async (uri, params) => {
    const filePath = params.filePath as string | undefined;
    if (!filePath || !isValidFilePath(filePath)) {
      throw new Error('Invalid filePath parameter for resource "location".');
    }
    const runArgs = [...gpsTags, filePath];
    const result = await runExiftool(runArgs);
    return {
      contents: [
        {
          uri: uri.href,
          type: "text",
          text: JSON.stringify(convertGpsCoordinates(result)),
        },
      ],
    };
  }
);

server.resource(
  "timestamp://{filePath}",
  new ResourceTemplate("timestamp://{filePath}", { list: undefined }),
  async (uri, params) => {
    const filePath = params.filePath as string | undefined;
    if (!filePath || !isValidFilePath(filePath)) {
      throw new Error('Invalid filePath parameter for resource "timestamp".');
    }
    const runArgs = [...timeTags, filePath];
    const result = await runExiftool(runArgs);
    return {
      contents: [
        {
          uri: uri.href,
          type: "text",
          text: JSON.stringify(convertGpsCoordinates(result)),
        },
      ],
    };
  }
);

server.resource(
  "location_and_timestamp://{filePath}",
  new ResourceTemplate("location_and_timestamp://{filePath}", { list: undefined }),
  async (uri, params) => {
    const filePath = params.filePath as string | undefined;
    if (!filePath || !isValidFilePath(filePath)) {
      throw new Error('Invalid filePath parameter for resource "location_and_timestamp".');
    }
    const runArgs = [...gpsTags, ...timeTags, filePath];
    const result = await runExiftool(runArgs, "location_and_timestamp");
    return {
      contents: [
        {
          uri: uri.href,
          type: "text",
          text: JSON.stringify(convertGpsCoordinates(result)),
        },
      ],
    };
  }
);

const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  // No logging needed; Inspector will detect readiness via protocol
});
