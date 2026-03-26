/**
 * Vercel Serverless Function — Proxy para Google Apps Script
 * Evita el bloqueo CORS de Google al hacer fetch desde el servidor.
 */
export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  const gasUrl = process.env.GAS_URL;

  if (!gasUrl) {
    return res.status(500).json({ success: false, error: 'GAS_URL no configurada en Vercel' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    let gasResponse;

    if (req.method === 'POST') {
      // Leer body raw
      const body = await new Promise((resolve, reject) => {
        let data = '';
        req.on('data', chunk => { data += chunk; });
        req.on('end', () => resolve(data));
        req.on('error', reject);
      });

      gasResponse = await fetch(gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body,
      });
    } else {
      // GET — pasar query params
      const queryString = new URLSearchParams(req.query).toString();
      const url = queryString ? `${gasUrl}?${queryString}` : gasUrl;
      gasResponse = await fetch(url);
    }

    const text = await gasResponse.text();
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(text);

  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}
