import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { execa } from "execa";
import { file } from "zod/v4";

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
  const filePath = args[args.length - 1];
  
  if (!isValidFilePath(filePath)) {
    throw new Error(
      `The last argument must be a valid file path (MacOS or Windows). Received: ${filePath}`
    );
  }
}

function trimQuotes(str: string): string {
  let start = 0;
  let end = str.length;

  // Trim leading quotes
  while (start < end && (str[start] === '"' || str[start] === "'")) {
    start++;
  }

  // Trim trailing quotes
  while (end > start && (str[end - 1] === '"' || str[end - 1] === "'")) {
    end--;
  }

  return str.substring(start, end);
}

function isValidFilePath(path: string): boolean {

  path = trimQuotes(path);

  // Basic pattern check for MacOS and Windows file paths
  // MacOS: starts with / or ~ or relative path (./ or ../) or /Volumes/ for network shares
  // Windows: drive letter + :\ or UNC path \\

  const macosPattern = /^(\/|~\/|\.\/|\.\.\/|\/Volumes\/).+/;
  const windowsPattern = /^(?:[a-zA-Z]:\\|\\\\)/;

  return macosPattern.test(path) || windowsPattern.test(path);
}

function prepareExiftoolArgs(
  args: string[]
): string[] {
  if (!args.includes("-j") && !args.includes("-json")) {
    args.unshift("-j");
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

async function runExiftool(args: string[]): Promise<any[]> {
  const preparedArgs = prepareExiftoolArgs(args);
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


async function runToolFunction(
  filePath: string,
  tags: readonly string[],
  toolName?: string
) : Promise<{
  content: {
    type: "text";
    text: string;
  }[];
  }>
{
  if (!filePath || !isValidFilePath(filePath)) {
    throw new Error(`Invalid filePath argument for tool "${toolName ?? "unknown"}".`);
  }
  filePath = trimQuotes(filePath);

  const runArgs = [...tags, filePath];
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

server.tool(
  "all_or_some",
  {
    filePath: z.string(),
    optionalExifTags: z.array(z.string()).optional(),
  },
  async (params: { filePath: string; optionalExifTags?: string[] }) => {
    const optionalExifTags = params.optionalExifTags;
    const tags = optionalExifTags?.map(tag => (tag.startsWith("-") ? tag : `-${tag}`)) || [];
    return runToolFunction(params.filePath, tags, "all_or_some");
  }
);

server.tool(
  "location",
  {
    filePath: z.string(),
  },
  async ({ filePath }: { filePath: string }) => {
    return runToolFunction(filePath, gpsTags, "location");
  }
);

server.tool(
  "timestamp",
  {
    filePath: z.string(),
  },
  async ({ filePath }: { filePath: string }) => {
    return runToolFunction(filePath, timeTags, "timestamp");
  }
);

server.tool(
  "location_and_timestamp",
  {
    filePath: z.string(),
  },
  async ({ filePath }: { filePath: string }) => {
    return runToolFunction(filePath, [...gpsTags, ...timeTags], "location_and_timestamp");
  }
);

async function runResourceTool(
  uri: URL,
  params: Record<string, unknown>,
  tags: readonly string[],
  toolName: string,
  includeJsonFlag = false
) {
  let filePath = params.filePath as string | undefined;
  if (!filePath || !isValidFilePath(filePath)) {
    throw new Error(`Invalid filePath parameter for resource "${toolName ?? "unknown"}".`);
  }
  filePath = trimQuotes(filePath);
  const runArgs = includeJsonFlag ? ["-j", ...tags, filePath] : [...tags, filePath];
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

server.resource(
  "all_or_some://{filePath}",
  new ResourceTemplate("all_or_some://{filePath}", { list: undefined }),
  async (uri, params) => {
    const optionalExifTags = params.optionalExifTags as string[] | undefined;
    const tags = optionalExifTags?.map(tag => (tag.startsWith("-") ? tag : `-${tag}`)) || [];
    return runResourceTool(uri, params, tags, "all_or_some", true);
  }
);

server.resource(
  "location://{filePath}",
  new ResourceTemplate("location://{filePath}", { list: undefined }),
  async (uri, params) => {
    return runResourceTool(uri, params, gpsTags, "location");
  }
);

server.resource(
  "timestamp://{filePath}",
  new ResourceTemplate("timestamp://{filePath}", { list: undefined }),
  async (uri, params) => {
    return runResourceTool(uri, params, timeTags, "timestamp");
  }
);

server.resource(
  "location_and_timestamp://{filePath}",
  new ResourceTemplate("location_and_timestamp://{filePath}", { list: undefined }),
  async (uri, params) => {
    return runResourceTool(uri, params, [...gpsTags, ...timeTags], "location_and_timestamp");
  }
);

const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  // No logging needed; Inspector will detect readiness via protocol
});
