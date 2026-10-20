import app from './index.js';

export default function handler(req, res) {
  // Se for chamado via catch-all do Vercel ([...path].js), normaliza req.url
  if (req.query) {
    const rawPath = req.query.path || req.query.__path;
    if (rawPath) {
      const joined = Array.isArray(rawPath) ? rawPath.join('/') : String(rawPath);
      delete req.query.path;
      delete req.query.__path;
      const cleanPath = joined.replace(/^\//, '');
      const queryIdx = (req.url || '').indexOf('?');
      const queryString = queryIdx >= 0 ? req.url.slice(queryIdx) : '';
      req.url = '/api/' + cleanPath + queryString;
    }
  }
  // Se req.url contiver o padrão [...path], limpa
  if (req.url && req.url.includes('[...path]')) {
    req.url = req.url.replace(/\/api\/\[\.\.\.path\]/g, '/api').replace(/\/\[\.\.\.path\]/g, '/api');
  }
  return app(req, res);
}
