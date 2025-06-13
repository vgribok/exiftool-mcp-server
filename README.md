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

