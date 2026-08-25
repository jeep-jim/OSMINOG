import http from 'node:http';
import handler from './api/mcp.js';

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

function wrapResponse(nodeRes) {
  const api = {
    setHeader(name, value) { nodeRes.setHeader(name, value); return api; },
    status(code) { nodeRes.statusCode = code; return api; },
    json(payload) {
      if (!nodeRes.headersSent) nodeRes.setHeader('Content-Type', 'application/json; charset=utf-8');
      nodeRes.end(JSON.stringify(payload));
      return api;
    },
    end(payload) { nodeRes.end(payload); return api; }
  };
  return api;
}

const server = http.createServer(async (req, res) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  let body;
  if (raw) {
    try { body = JSON.parse(raw); }
    catch { body = raw; }
  }
  req.body = body;
  try {
    await handler(req, wrapResponse(res));
  } catch (error) {
    console.error('[BriefCraft App]', error);
    if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.statusCode = 500;
    res.end(JSON.stringify({ ok:false, error:'Internal server error' }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`BriefCraft ChatGPT App 3.7.0 listening on http://${HOST}:${PORT}`);
  console.log('MCP endpoint: /mcp');
  console.log('Health: /health');
});
