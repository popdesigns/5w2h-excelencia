const https = require("https");

function callGemini(apiKey, userMessage) {
  return new Promise((resolve, reject) => {
    const systemPrompt = `Eres un experto en análisis de causa raíz (RCA). Tu tarea es redactar la descripción del fenómeno utilizando la metodología 5W2H.

Construye un solo párrafo claro, objetivo y técnico que describa el fenómeno.

Condiciones:
- No incluir causas ni soluciones
- No usar adjetivos subjetivos
- Usar datos y hechos medibles
- Integrar toda la información en una sola frase coherente
- Enfocarse únicamente en el fenómeno observado
- Responde ÚNICAMENTE con el párrafo, sin títulos, sin explicaciones adicionales, sin comillas.

`;

    const fullMessage = systemPrompt + userMessage;

    const body = JSON.stringify({
      contents: [
        {
          parts: [{ text: fullMessage }]
        }
      ],
      generationConfig: {
        maxOutputTokens: 1000,
        temperature: 0.7
      }
    });

    const options = {
      hostname: "generativelanguage.googleapis.com",
      port: 443,
      path: `/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error("Failed to parse response: " + data.substring(0, 200)));
        }
      });
    });

    req.on("error", (e) => reject(e));
    req.write(body);
    req.end();
  });
}

exports.handler = async (event) => {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
  };

  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers, body: "" };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, headers, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: "API key not configured. Add GEMINI_API_KEY in Netlify environment variables." }),
    };
  }

  try {
    const { userMessage } = JSON.parse(event.body);

    if (!userMessage) {
      return {
        statusCode: 400, headers,
        body: JSON.stringify({ error: "Missing userMessage in request body" }),
      };
    }

    const data = await callGemini(API_KEY, userMessage);

    if (data.error) {
      return {
        statusCode: 400, headers,
        body: JSON.stringify({ error: data.error.message || "Gemini API error" }),
      };
    }

    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "";

    if (!text) {
      return {
        statusCode: 500, headers,
        body: JSON.stringify({ error: "No response generated. Try again." }),
      };
    }

    return {
      statusCode: 200, headers,
      body: JSON.stringify({ text }),
    };
  } catch (err) {
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: "Server error: " + err.message }),
    };
  }
};
