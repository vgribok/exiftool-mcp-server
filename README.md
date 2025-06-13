# exiftool-mcp-server

An MCP Server for retrieving EXIF data from images (photos) and videos using ExifTool.

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

## Usage

Run the MCP server CLI command:

```bash
npx exiftool-mcp
```

The server listens for JSON requests on stdin. Each request should be a JSON object with the following structure:

```json
{
  "id": "unique-request-id",
  "params": {
    "args": ["-json", "path/to/image.jpg"]
  }
}
```

- `id`: A unique identifier for the request.
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

6. **Use the integrated terminal** in VSCode to interact with your MCP server as needed (e.g., send JSON input to stdin). For example, to extract and evaluate EXIF data from the file named `IMG_4985.HEIC` located in the `~/Downloads/delme` directory using the MCP server, you can send the following JSON request to the server's standard input while debugging:
    ```json
    {
      "id": "example-request-1",
      "params": {
        "args": ["-json", "/Users/yourusername/Downloads/delme/IMG_4985.HEIC"]
      }
    }
    ```

    Replace `/Users/yourusername` with your actual home directory path.

7. **When your code hits a breakpoint**, VSCode will pause execution, allowing you to inspect variables, step through code, and evaluate expressions.

8. **Edit your source files** as needed. To apply changes, you will need to stop and restart the debugger since this configuration does not automatically restart on file changes.

9. **Stop debugging** by clicking the red stop button or pressing `Shift+F5` when finished.

This configuration provides a straightforward way to debug your MCP server with full breakpoint and step-through support.

---
