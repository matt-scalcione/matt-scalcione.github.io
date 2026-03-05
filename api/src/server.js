import http from "node:http";
import { createRequestHandler } from "./app.js";

const port = Number.parseInt(process.env.PORT || "4000", 10);
const host = process.env.HOST || "0.0.0.0";

const server = http.createServer(createRequestHandler());

server.listen(port, host, () => {
  // eslint-disable-next-line no-console
  console.log(`esports-live-api listening at http://${host}:${port}`);
});
