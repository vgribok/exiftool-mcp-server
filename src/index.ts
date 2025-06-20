#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
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

type ExiftoolOutput = Array<Record<string, unknown>>;

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

async function runExiftool(args: string[]): Promise<ExiftoolOutput> {
  const preparedArgs = prepareExiftoolArgs(args);
  try {
    const { stdout } = await execa("exiftool", preparedArgs);
    return JSON.parse(stdout) as ExiftoolOutput;
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null) {
      const errorObj = err as { code?: string; stderr?: string; message?: string };
      if (
        errorObj.code === "ENOENT" ||
        (errorObj.stderr &&
          /exiftool(?!.*not found)/i.test(errorObj.stderr) &&
          /not found|no such file|command not found/i.test(errorObj.stderr))
      ) {
        throw new Error(
          "ExifTool executable not found. Please install ExifTool from https://exiftool.org/ and ensure it is in your system PATH."
        );
      }
      if (errorObj.message && errorObj.message.startsWith("Failed to parse exiftool JSON output:")) {
        throw err;
      }
      throw new Error("Failed to run exiftool: " + (errorObj.message ?? "Unknown error"));
    }
    throw new Error("Failed to run exiftool: Unknown error");
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

function convertGpsCoordinates(exifDataArray: ExiftoolOutput): ExiftoolOutput {
  if (!Array.isArray(exifDataArray)) return exifDataArray;

  return exifDataArray.map((item) => {
    const newItem = { ...item };

    const gpsLatitude = newItem["GPSLatitude"];
    if (typeof gpsLatitude === "string") {
      const latDecimal = parseDMS(gpsLatitude);
      if (latDecimal !== null) {
        newItem["GPSLatitudeGoogleMapsCompatible"] = latDecimal;
      }
    }

    const gpsLongitude = newItem["GPSLongitude"];
    if (typeof gpsLongitude === "string") {
      const lonDecimal = parseDMS(gpsLongitude);
      if (lonDecimal !== null) {
        newItem["GPSLongitudeGoogleMapsCompatible"] = lonDecimal;
      }
    }

    return newItem;
  });
}

const TOOL_ALL_OR_SOME = "all_or_some";
const TOOL_LOCATION = "location";
const TOOL_TIMESTAMP = "timestamp";
const TOOL_LOCATION_AND_TIMESTAMP = "location_and_timestamp";

const server = new McpServer({
  name: "ExifTool MCP Server",
  version: "1.0.0",
});

interface ToolAllOrSomeParams {
  filePath: string;
  optionalExifTags?: string[];
}

interface ToolFilePathParam {
  filePath: string;
}

async function runToolFunction(
  filePath: string,
  tags: readonly string[],
  toolName?: string
): Promise<{
  content: {
    type: "text";
    text: string;
  }[];
}> {
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
  TOOL_ALL_OR_SOME,
  {
    filePath: z.string(),
    optionalExifTags: z.array(z.string()).optional(),
  },
  async (params: ToolAllOrSomeParams) => {
    const optionalExifTags = params.optionalExifTags;
    const tags = optionalExifTags?.map(tag => (tag.startsWith("-") ? tag : `-${tag}`)) || [];
    return runToolFunction(params.filePath, tags, TOOL_ALL_OR_SOME);
  }
);

server.tool(
  TOOL_LOCATION,
  {
    filePath: z.string(),
  },
  async ({ filePath }: ToolFilePathParam) => {
    return runToolFunction(filePath, gpsTags, TOOL_LOCATION);
  }
);

server.tool(
  TOOL_TIMESTAMP,
  {
    filePath: z.string(),
  },
  async ({ filePath }: ToolFilePathParam) => {
    return runToolFunction(filePath, timeTags, TOOL_TIMESTAMP);
  }
);

server.tool(
  TOOL_LOCATION_AND_TIMESTAMP,
  {
    filePath: z.string(),
  },
  async ({ filePath }: ToolFilePathParam) => {
    return runToolFunction(filePath, [...gpsTags, ...timeTags], TOOL_LOCATION_AND_TIMESTAMP);
  }
);

const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  // No logging needed; Inspector will detect readiness via protocol
});
