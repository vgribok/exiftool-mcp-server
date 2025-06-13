# exiftool-mcp-server

This is an MCP Server (an MCP protocol compatible AI anent) for retrieving EXIF data from images (photos) and videos, using [ExifTool](https://exiftool.org/).

> Note: the `exiftool` copyright belongs to its author, and not to the creators of this AI agent.

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

To enable this exiftool MCP server as an agent in Claude Desktop, you need to update your `claude_desktop_config.json` configuration file. Add the following entry to the `"agents"` array in the config file:

```json
{
  "name": "exiftool-mcp",
  "command": "npx exiftool-mcp",
  "description": "MCP server for retrieving EXIF metadata from images and videos using ExifTool"
}
```

This configuration tells Claude Desktop to run the exiftool MCP server as an agent. After updating the config file, save your changes and restart Claude Desktop to apply the new agent configuration.

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

The server listens for JSON requests on stdin. Each request should be a JSON object with the following structure:

```json
{
  "id": "all-or-some-request",
  "tool": "all_or_some",
  "params": {
    "args": ["/Users/yourusername/Downloads/delme/IMG_4985.HEIC"]
  }
}
```

- `id`: A unique identifier for the request.
- `tool`: A name of the MCP tool.
- `params.args`: An array of strings representing the command-line arguments to pass to `exiftool`.

The server validates the `args` array to ensure all elements are strings and do not contain potentially dangerous shell metacharacters to prevent command injection.

Example request to get EXIF data in JSON format for an image:

```json
{
  "id": "1",
  "params": {
    "args": ["-json", "example.jpg"]
  }
}
```

The server will respond with a JSON object containing the `id` and the EXIF data in the `result` field.

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

To debug the MCP server using the "Debug MCP Server Dev Mode" configuration in VSCode, follow these steps:

2. **Set breakpoints** in your `index.js` or other source files where you want to pause execution and inspect variables.

3. **Open the Debug panel** by clicking the Debug icon on the left sidebar or pressing `Cmd+Shift+D` (macOS) / `Ctrl+Shift+D` (Windows/Linux).

4. **Select the "Debug MCP Server" configuration** from the dropdown at the top of the Debug panel.

5. **Start debugging** by pressing the green play button or hitting `F5`.

6. **Use the integrated terminal** in VSCode to interact with your MCP server as needed (e.g., send JSON input to stdin).

### Example: Get the list of supported tools

Send the following JSON request (note the absence of the `tool` field) to retrieve the list of tools supported by the MCP server:

```json
{
  "id": "list-tools-request",
  "params": {}
}
```

The server will respond with a JSON object containing the `tools` metadata.


### Example: Call the "All or some" tool

To request all EXIF properties or a subset, send a JSON request like this:

```json
{
  "id": "all-or-some-request",
  "tool": "all_or_some",
  "params": {
    "args": ["/Users/yourusername/Downloads/delme/IMG_4985.HEIC"]
  }
}
```

Replace `/Users/yourusername` with your actual home directory path. If you want specific properties, replace the `args` array with the list of EXIF tags you want (without the leading dash).

#### Example: Call the "All or some" tool with specific EXIF tag patterns

To request EXIF properties matching patterns like all tags containing "Date" or "Time", send a JSON request like this:

```json
{
  "id": "all-or-some-pattern-request",
  "tool": "all_or_some",
  "params": {
    "args": ["*Date*", "*Time*", "/Users/yourusername/Downloads/delme/IMG_4985.HEIC"]
  }
}
```

This will instruct `exiftool` to return all tags with "Date" or "Time" in their names, along with the file specified.

### Example: Call the "Location and Timestamp" tool

To request GPS and timestamp metadata, send a JSON request like this:

```json
{
  "id": "location-timestamp-request",
  "tool": "location_and_timestamp",
  "params": {
    "args": ["/Users/yourusername/Downloads/delme/IMG_4985.HEIC"]
  }
}
```

7. **When your code hits a breakpoint**, VSCode will pause execution, allowing you to inspect variables, step through code, and evaluate expressions.

8. **Edit your source files** as needed. To apply changes, you will need to stop and restart the debugger since this configuration does not automatically restart on file changes.

9. **Stop debugging** by clicking the red stop button or pressing `Shift+F5` when finished.

This configuration provides a straightforward way to debug your MCP server with full breakpoint and step-through support.
