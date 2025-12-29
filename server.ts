import { createServer } from "http";
import { parse } from "url";
import next from "next";
import { config } from "dotenv";

// Load environment variables from .env.local FIRST before any other imports
config({ path: ".env.local" });

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);
const socketPort = parseInt(process.env.SOCKET_PORT || "3001", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  // Dynamically import modules that depend on environment variables (db.ts)
  const { initializeSocketServer } = await import("./src/lib/socket-io");
  
  // Create Next.js HTTP server
  const nextServer = createServer((req, res) => {
    // Note: url.parse is deprecated but Next.js handle() requires UrlWithParsedQuery
    // The new URL() API returns incompatible types. Using parse() is safe here.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const parsedUrl = parse(req.url || "", true);
    handle(req, res, parsedUrl);
  });

  // Create separate HTTP server for Socket.io
  const socketServer = createServer();
  initializeSocketServer(socketServer);
  
  // Start Next.js server
  nextServer.listen(port, () => {
    console.log(`> Next.js ready on http://${hostname}:${port}`);
  });

  // Start Socket.io server on separate port
  socketServer.listen(socketPort, () => {
    console.log(`> Socket.io server running on ws://${hostname}:${socketPort}`);
  });

  // Dynamically import and start the tournament scheduler
  // This ensures environment variables are loaded before db.ts is imported
  const { startTournamentScheduler } = await import("./src/lib/tournament-scheduler");
  startTournamentScheduler();
});
