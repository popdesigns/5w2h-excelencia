const https = require("https");

function callAnthropic(apiKey, userMessage) {
  return new Promise((resolve, reject) => {
    const systemPrompt = `Actúa como experto en análisis de causa raíz (RCA) y redacta la descripción del fenómeno utilizando la metodología 5W2H.

Construye un solo párrafo claro, objetivo y técnico que describa el fenómeno.

Condiciones:
- No incluir causas ni soluciones
- No usar adjetivos subjetivos
- Usar datos y hechos medibles
- Integrar toda la información en una sola frase coherente
- Enfocarse únicamente en el fenómeno observado
- Responde ÚNICAMENTE con el párrafo, sin títulos, sin explicaciones adicionales, sin comillas.`;

    const body = JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    });

    const options = {
      hostname: "api.anthropic.com",
      port: 443,
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
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
          reject(new Error("Failed to parse API response: " + data.substring(0, 200)));
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

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: "API key not configured. Add ANTHROPIC_API_KEY in Netlify environment variables." }),
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

    const data = await callAnthropic(API_KEY, userMessage);

    if (data.error) {
      return {
        statusCode: 400, headers,
        body: JSON.stringify({ error: data.error.message || "Anthropic API error" }),
      };
    }

    const text = data.content?.map((b) => b.text || "").join("") || "";

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
