# exiftool-mcp-server

This is an MCP Server (an MCP protocol compatible AI agent) for retrieving EXIF data from images (photos) and videos, using [ExifTool](https://exiftool.org/).

> Note: the `exiftool` copyright belongs to its author, and not to the creators of this AI agent.

## Table of Contents

- [Description](#description)
- [Installation](#installation)
- [Enabling the exiftool MCP Agent for Claude Desktop](#enabling-the-exiftool-mcp-agent-for-claude-desktop)
- [Usage](#usage)
- [Testing with MCP Inspector](#testing-with-mcp-inspector)
- [Features](#features)
- [Contribution Guidelines](#contribution-guidelines)
- [Security Considerations](#security-considerations)
- [License](#license)
- [Author](#author)
- [Debugging with "Debug MCP Server Dev Mode"](#debugging-with-debug-mcp-server-dev-mode)

## Description

This project provides a command-line MCP (Model Context Protocol) server that allows clients to retrieve EXIF metadata from image and video files by safely executing the `exiftool` command with specified arguments. It listens for JSON requests on standard input and returns the EXIF data as JSON responses on standard output.

## Installation

1. Ensure you have [Node.js](https://nodejs.org/) installed (version 14 or higher recommended).
2. Install [ExifTool](https://exiftool.org/) on your system. This tool is required for extracting metadata.
3. Clone this repository and install dependencies:

```bash
git clone <repository-url>
cd exiftool-mcp-server
npm install
```

### Enabling the exiftool MCP Agent for Claude Desktop

To enable this exiftool MCP server as an agent in Claude Desktop, you need to update your `claude_desktop_config.json` configuration file. Add the following entry to the `"agents"` object in the config file:

```json
"exiftool-mcp": {
  "command": "npx",
  "args": [
    "-y",
    "exiftool-mcp-server"
  ],
  "description": "MCP server for retrieving EXIF metadata from images and videos using ExifTool"
}
```

This configuration tells Claude Desktop to run the exiftool MCP server as an agent using `npx`. After updating the config file, save your changes and restart Claude Desktop to apply the new agent configuration.

## Usage

Run the MCP server CLI command:

```bash
npx exiftool-mcp
```
Supported MCP Tools:

- **all_or_some**: Return all or some EXIF properties. If args are not supplied, return all. The `args` parameter is an optional array of strings representing EXIF property names to return.

- **location**: Return GPS-related EXIF metadata. The `args` parameter is an optional array of additional arguments for exiftool.

- **timestamp**: Return timestamp-related EXIF metadata. The `args` parameter is an optional array of additional arguments for exiftool.

- **location_and_timestamp**: Return both GPS and timestamp EXIF metadata. The `args` parameter is an optional array of additional arguments for exiftool.

- **list-tools**: When no `tool` field is provided in the request, the server responds with a list of all supported MCP tools and their metadata.

The server listens for JSON-RPC 2.0 requests on stdin. Each request should be a JSON object with the following structure:

```json
{
  "jsonrpc": "2.0",
  "id": "all-or-some-request",
  "method": "all_or_some",
  "params": {
    "args": ["/Users/yourusername/Downloads/delme/IMG_4985.HEIC"]
  }
}
```

- `jsonrpc`: Must be the string `"2.0"`.
- `id`: A unique identifier for the request.
- `method`: The name of the MCP tool to invoke.
- `params.args`: An array of strings representing the command-line arguments to pass to `exiftool`.

The server validates the `args` array to ensure all elements are strings and do not contain potentially dangerous shell metacharacters to prevent command injection.

The server will respond with a JSON-RPC 2.0 response object containing the `jsonrpc`, `id`, and the EXIF data in the `result` field.

Response Example:
```json
{
  "jsonrpc": "2.0",
  "id": "location-request",
  "result": [
    {
      "SourceFile": "/Users/username/Downloads/delme/IMG_4952.HEIC",
      "GPSLatitude": "37 deg 17' 28.36\" N",
      "GPSLongitude": "13 deg 34' 54.06\" E",
      "GPSAltitude": "62.8 m Above Sea Level",
      "GPSLatitudeRef": "North",
      "GPSLongitudeRef": "East",
      "GPSAltitudeRef": "Above Sea Level",
      "GPSLatitudeGoogleMapsCompatible": 37.29121111111111,
      "GPSLongitudeGoogleMapsCompatible": 13.581683333333332
    }
  ]
}
```

## Testing with MCP Inspector

### Prerequisites

Before testing with the MCP Inspector, ensure the following are installed:

- [Node.js](https://nodejs.org/) (version 14 or higher recommended)
- [ExifTool](https://exiftool.org/)
- Project dependencies via `npm install` (includes `@modelcontextprotocol/inspector` and `ts-node`)

### Testing Steps

1. Open the MCP Inspector in VSCode using the "MCP Inspector with TypeScript Server" launch configuration.

2. Start debugging by clicking the green play button or pressing `F5`.

3. In the integrated terminal, watch for output lines containing:

   ```
   Open inspector with token pre-filled:
      http://localhost:6274/?MCP_PROXY_AUTH_TOKEN=...
   ```

4. Copy and open the provided URL in your web browser to access the MCP Inspector UI.

5. Click the **Connect** button in the MCP Inspector UI to connect to your MCP server.

6. Once connected, you can inspect and interact with your MCP server tools.

> **Critical:** Finding the "Open inspector with token pre-filled" URL in the terminal output is essential to access the MCP Inspector UI and establish a connection.

## Features

- MCP-compliant server interface using standard input/output.
- Safe execution of `exiftool` with argument validation.
- Returns EXIF metadata for images and videos.
- Simple CLI usage with a single executable command.

## Contribution Guidelines

Contributions are welcome! Please follow these steps:

1. Fork the repository.
2. Create a new branch for your feature or bugfix.
3. Make your changes and commit with clear messages.
4. Submit a pull request describing your changes.

Please ensure your code follows existing style and includes appropriate error handling.

## Security Considerations

- The server strictly validates the `args` parameter to be an array of strings.
- It disallows shell metacharacters such as `;`, `&`, `|`, `` ` ``, `$`, `>`, `<`, and `\` to prevent command injection attacks.
- Always ensure that the input to the server is from trusted sources.

## License

This project is licensed under the ISC License. See the [LICENSE](LICENSE) file for details.

## Author

Vlad Hrybok

## Debugging with "Debug MCP Server Dev Mode"

To debug the MCP server using the "Debug MCP Server Dev Mode" configuration in VSCode, follow these guidelines:

- When disabling authentication, use `localhost` instead of `127.0.0.1`. This distinction is important and was a key troubleshooting point.

- Breakpoints can only be set after the MCP server is fully loaded and initialized. This occurs when the MCP Inspector connects and detects readiness via the protocol, as implemented in the `src/index.ts` file where the server connects using `server.connect(transport).then(...)`.

- Use the integrated terminal in VSCode to interact with your MCP server as needed (e.g., send JSON input to stdin).

- To test the MCP tools, send JSON-RPC 2.0 requests to the server as described in the Usage section.

- Remember to stop and restart the debugger to apply any source code changes, as automatic restarts are not enabled.

This configuration provides a straightforward way to debug your MCP server with full breakpoint and step-through support.
