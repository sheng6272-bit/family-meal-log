const https = require('https');

function postJson({
  url,
  headers,
  body,
  timeoutMs,
}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const request = https.request(
      {
        method: 'POST',
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || undefined,
        path: `${target.pathname}${target.search}`,
        headers,
      },
      (response) => {
        let text = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          text += chunk;
        });
        response.on('end', () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`provider http ${response.statusCode}: ${text}`));
            return;
          }
          resolve(text);
        });
      },
    );

    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`provider timeout after ${timeoutMs}ms`));
    });
    request.on('error', reject);
    request.write(body);
    request.end();
  });
}

function normalizeTimeout(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 8000;
  return Math.min(Math.max(Math.round(parsed), 1000), 30000);
}

function buildPrompt(request) {
  return [
    'You analyze a meal photo and must return strict JSON only.',
    'Return: {"suggestions":[{"foodName":string,"estimatedGrams":number,"confidence":number,"per100gGuess":{"calories":number,"protein":number,"carb":number,"fat":number},"matchedFoodId":string|null}]}',
    'Do not add markdown.',
    `Meal type hint: ${request.hintMealType || 'unknown'}.`,
    `Photo file id: ${request.photoFileId}.`,
  ].join(' ');
}

function parseProviderResponse(payloadText) {
  let parsed;
  try {
    parsed = JSON.parse(payloadText);
  } catch (error) {
    throw new Error('provider returned non-JSON payload');
  }

  if (parsed && Array.isArray(parsed.suggestions)) return parsed;

  const content = parsed &&
    parsed.choices &&
    parsed.choices[0] &&
    parsed.choices[0].message &&
    parsed.choices[0].message.content;

  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('provider response missing choices[0].message.content');
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error('provider message content is not valid JSON');
  }
}

function createOpenAiCompatibleProvider(env, deps = {}) {
  const transport = deps.transport || postJson;
  const endpoint = env.AI_API_URL;
  const apiKey = env.AI_API_KEY;
  const model = env.AI_MODEL;
  const timeoutMs = normalizeTimeout(env.AI_TIMEOUT_MS);

  return {
    name: env.AI_PROVIDER || 'openai_compatible',
    async analyze(request) {
      if (!endpoint || !apiKey || !model) {
        throw new Error('real AI provider is not fully configured');
      }

      const payload = {
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'user',
            content: buildPrompt(request),
          },
        ],
      };

      const raw = await transport({
        url: endpoint,
        timeoutMs,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      const parsed = parseProviderResponse(raw);
      if (!parsed || !Array.isArray(parsed.suggestions)) {
        throw new Error('provider JSON missing suggestions array');
      }

      return {
        provider: env.AI_PROVIDER || 'openai_compatible',
        status: 'succeeded',
        suggestions: parsed.suggestions,
      };
    },
  };
}

module.exports = {
  createOpenAiCompatibleProvider,
  normalizeTimeout,
  parseProviderResponse,
};
