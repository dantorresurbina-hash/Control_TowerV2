/**
 * Vercel Serverless Function — Proxy para Google Gemini API
 * Recibe { message, systemContext } y devuelve { text }
 * Requiere la variable de entorno GEMINI_API_KEY en Vercel.
 */
export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY no configurada en Vercel' });
  }

  const { message, systemContext } = req.body || {};
  if (!message) return res.status(400).json({ error: 'Falta el campo message' });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemContext || 'Eres un asistente operativo de producción y logística.' }],
          },
          contents: [
            { role: 'user', parts: [{ text: message }] },
          ],
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.4,
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: `Error de Gemini: ${errText}` });
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.status(200).json({ text });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
