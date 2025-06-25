// Este arquivo é o nosso backend (a "cozinha").
// Ele recebe os pedidos do frontend, processa-os de forma segura
// e chama a API do Gemini.

exports.handler = async function (event) {
  // A API do Gemini só aceita o método POST.
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // 1. Pega os dados enviados pelo frontend (o tipo de ação e o conteúdo).
    const { action, payload } = JSON.parse(event.body);
    const apiKey = process.env.GEMINI_API_KEY; // Pega a chave secreta do ambiente da Netlify.

    if (!apiKey) {
        throw new Error("A chave da API do Gemini não foi configurada no servidor.");
    }

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    let geminiPayload;

    // 2. Monta o prompt correto para a IA baseado na ação pedida.
    switch (action) {
      case 'generateBuild':
        geminiPayload = {
          contents: [{
            role: "user",
            parts: [{ text: `Aja como um especialista em hardware com acesso a preços do mercado brasileiro em junho de 2025. O usuário pediu: "${payload.prompt}". Sua tarefa é: 1. Criar uma build de PC plausível, respeitando o orçamento. 2. Para cada peça, forneça um preço ('bestPrice') realista para o varejo online brasileiro (Kabum, Pichau, etc.). NÃO use preços de importação ou antigos. 3. O nome do componente ('component') deve estar em português. 4. Forneça uma análise da build. Responda em JSON.` }]
          }],
          generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                analysis: { type: "STRING" },
                build: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      component: { type: "STRING" },
                      name: { type: "STRING" },
                      bestPrice: { type: "NUMBER" },
                      store: { type: "STRING" }
                    },
                    required: ["component", "name", "bestPrice", "store"]
                  }
                }
              },
              required: ["analysis", "build"]
            }
          }
        };
        break;

      case 'analyzeFps':
         geminiPayload = {
            contents: [{ role: "user", parts: [{ text: `Dada a build: ${JSON.stringify(payload.build)}, estime o FPS médio em 1080p (Alto) para: Fortnite, Valorant, Warzone e CS:GO. Forneça uma análise textual. Responda em JSON com "analysis" e "games" (array de {gameName, estimatedFps}).` }] }],
            generationConfig: { responseMimeType: "application/json" }
         };
         break;

      case 'optimizeBuild':
         geminiPayload = {
            contents: [{ role: "user", parts: [{ text: `Dada a build: <span class="math-inline">\{JSON\.stringify\(payload\.build\)\}, e o pedido\: "</span>{payload.prompt}", sugira 1 ou 2 trocas para melhorar o custo-benefício. Explique a vantagem. Responda em texto simples.` }] }]
         };
         break;

      case 'explainComponent':
          geminiPayload = {
              contents: [{ role: "user", parts: [{ text: `Explique em português, de forma simples para um iniciante, o que é um(a) "<span class="math-inline">\{payload\.component\}" e por que o modelo "</span>{payload.name}" é uma escolha considerável.` }] }]
          };
          break;

      default:
        throw new Error('Ação inválida.');
    }

    // 3. Chama a API do Gemini.
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(geminiPayload),
    });

    if (!response.ok) {
      console.error('Erro da API Gemini:', await response.text());
      throw new Error('Houve um problema ao se comunicar com a IA.');
    }

    const result = await response.json();

    // 4. Retorna a resposta da IA para o frontend.
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };

  } catch (error) {
    console.error('Erro na função do backend:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
