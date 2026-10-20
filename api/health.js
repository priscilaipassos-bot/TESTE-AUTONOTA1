export default function handler(_req, res) {
  res.status(200).json({
    status: 'ok',
    service: 'AutoNFS-e Federal API',
    timestamp: new Date().toISOString(),
  });
}
