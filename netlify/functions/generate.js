exports.handler = async (event) => {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ error: "Method not allowed" }) };
  }

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "API key not configured on server" }),
    };
  }

  try {
    const { userMessage } = JSON.parse(event.body);

    const systemPrompt = `Actúa como experto en análisis de causa raíz (RCA) y redacta la descripción del fenómeno utilizando la metodología 5W2H.

Construye un solo párrafo claro, objetivo y técnico que describa el fenómeno.

Condiciones:
- No incluir causas ni soluciones
- No usar adjetivos subjetivos
- Usar datos y hechos medibles
- Integrar toda la información en una sola frase coherente
- Enfocarse únicamente en el fenómeno observado
- Responde ÚNICAMENTE con el párrafo, sin títulos, sin explicaciones adicionales, sin comillas.`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    const data = await response.json();

    if (data.error) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: data.error.message }),
      };
    }

    const text = data.content?.map((b) => b.text || "").join("") || "";

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
