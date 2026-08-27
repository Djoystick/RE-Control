// LLM Monitor — радар бесплатных моделей OpenRouter
// Запуск: OPENROUTER_API_KEY="sk-or-v1-..." node scripts/llm_monitor.js

const API_KEY = process.env.OPENROUTER_API_KEY;

if (!API_KEY) {
  console.error('❌ Не найден OPENROUTER_API_KEY');
  process.exit(1);
}

async function fetchModels() {
  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'HTTP-Referer': 'https://github.com/REControl',
      'X-Title': 'REControl Monitor'
    }
  });

  if (!res.ok) {
    console.error(`Ошибка: ${res.status} ${res.statusText}`);
    const body = await res.text();
    console.error('Ответ:', body);
    process.exit(1);
  }

  const { data } = await res.json();

  const free = data.filter(m =>
    (String(m.pricing?.prompt) === '0' && String(m.pricing?.completion) === '0') ||
    m.id.includes(':free')
  );

  console.log(`\n🔍 Найдено ${free.length} бесплатных моделей:\n`);
  free.forEach(m => {
    console.log(`ID: ${m.id}`);
    console.log(`Name: ${m.name}`);
    console.log(`Context Length: ${m.context_length}`);
    console.log('-'.repeat(40));
  });
}

fetchModels();

