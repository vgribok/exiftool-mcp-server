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
}

async function runExiftool(args: string[]): Promise<any[]> {
  if (!args.includes("-j") && !args.includes("-json")) {
    args.unshift("-j");
  }
  try {
    const { stdout } = await execa("exiftool", args);
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
    args: z.array(z.string()).optional(),
  },
  async ({ args }: { args?: string[] }) => {
    if (args) {
      validateArgs(args);
    }
    let runArgs: (typeof gpsTags[number])[] = [...gpsTags];
    if (args && args.length > 0) {
      runArgs = runArgs.concat(args as (typeof gpsTags[number])[]);
    }
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
    args: z.array(z.string()).optional(),
  },
  async ({ args }: { args?: string[] }) => {
    if (args) {
      validateArgs(args);
    }
    let runArgs: (typeof timeTags[number])[] = [...timeTags];
    if (args && args.length > 0) {
      runArgs = runArgs.concat(args as (typeof timeTags[number])[]);
    }
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
    args: z.array(z.string()).optional(),
  },
  async ({ args }: { args?: string[] }) => {
    if (args) {
      validateArgs(args);
    }

    let runArgs: (typeof gpsTags[number] | typeof timeTags[number])[] = [...gpsTags, ...timeTags];
    if (args && args.length > 0) {
      runArgs = runArgs.concat(args as (typeof gpsTags[number] | typeof timeTags[number])[]);
    }
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
  "location://{args*}",
  new ResourceTemplate("location://{args*}", { list: undefined }),
  async (uri, params) => {
    const args = params.args as string[] | undefined;
    if (args) {
      validateArgs(args);
    }
    let runArgs: string[] = [...gpsTags];
    if (args && args.length > 0) {
      runArgs = runArgs.concat(args as any[]);
    }
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
  "timestamp://{args*}",
  new ResourceTemplate("timestamp://{args*}", { list: undefined }),
  async (uri, params) => {
    const args = params.args as string[] | undefined;
    if (args) {
      validateArgs(args);
    }
    let runArgs: string[] = [...timeTags];
    if (args && args.length > 0) {
      runArgs = (runArgs as string[]).concat(args as string[]);
    }
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
  "location_and_timestamp://{args*}",
  new ResourceTemplate("location_and_timestamp://{args*}", { list: undefined }),
  async (uri, params) => {
    const args = params.args as string[] | undefined;
    if (args) {
      validateArgs(args);
    }
    let runArgs = [...gpsTags, ...timeTags];
    if (args && args.length > 0) {
      runArgs = runArgs.concat(args as (typeof gpsTags[number] | typeof timeTags[number])[]);
    }
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

const transport = new StdioServerTransport();
server.connect(transport).then(() => {
  console.log("MCP Server started and listening on stdin/stdout");
});
