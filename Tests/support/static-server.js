const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const host = "127.0.0.1";
const port = 4173;
const rootDir = path.resolve(__dirname, "../../Sources");

const contentTypes = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".txt": "text/plain; charset=utf-8",
};

function resolveRequestPath(urlPath) {
    const normalizedPath = urlPath === "/" ? "/index.html" : urlPath;
    const decodedPath = decodeURIComponent(normalizedPath.split("?")[0]);
    const candidatePath = path.normalize(path.join(rootDir, decodedPath));

    if (!candidatePath.startsWith(rootDir)) {
        return null;
    }

    return candidatePath;
}

const server = http.createServer((request, response) => {
    const filePath = resolveRequestPath(request.url || "/");

    if (!filePath) {
        response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Forbidden");
        return;
    }

    fs.stat(filePath, (statError, stats) => {
        if (statError || !stats.isFile()) {
            response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            response.end("Not Found");
            return;
        }

        const extension = path.extname(filePath).toLowerCase();
        const contentType = contentTypes[extension] || "application/octet-stream";

        response.writeHead(200, {
            "Cache-Control": "no-store",
            "Content-Type": contentType,
        });

        fs.createReadStream(filePath).pipe(response);
    });
});

server.listen(port, host, () => {
    process.stdout.write(`Static server listening on http://${host}:${port}\n`);
});