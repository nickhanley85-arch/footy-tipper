const http = require("http");
const fs = require("fs");
const path = require("path");

const rootDir = __dirname;
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

function send(response, statusCode, body, contentType) {
  response.writeHead(statusCode, { "Content-Type": contentType });
  response.end(body);
}

function safePath(urlPath) {
  const pathname = urlPath === "/" ? "/index.html" : urlPath;
  const resolved = path.normalize(path.join(rootDir, pathname));
  return resolved.startsWith(rootDir) ? resolved : null;
}

const server = http.createServer((request, response) => {
  const filePath = safePath(request.url.split("?")[0]);
  if (!filePath) {
    send(response, 403, "Forbidden", "text/plain; charset=utf-8");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        send(response, 404, "Not found", "text/plain; charset=utf-8");
        return;
      }

      send(response, 500, "Internal server error", "text/plain; charset=utf-8");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || "application/octet-stream";
    send(response, 200, content, contentType);
  });
});

server.listen(port, () => {
  console.log(`Footy Tipper running at http://localhost:${port}`);
});
