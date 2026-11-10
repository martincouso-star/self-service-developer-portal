import { createServer, Server } from 'node:http';

export const SERVICE_NAME = '${{ values.name }}';

export function createApp(): Server {
  return createServer((req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
      const body = JSON.stringify({ status: 'ok', service: SERVICE_NAME });
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(body);
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ status: 'not-found' }));
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT ?? 8080);
  createApp().listen(port, () => {
    process.stdout.write(`${SERVICE_NAME} listening on ${port}\n`);
  });
}
