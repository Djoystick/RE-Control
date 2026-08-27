// OpenRouter Worker — отправляет задачи к любой модели OpenRouter
// Запуск: MODEL_ID="poolside/laguna-s-2.1:free" OPENROUTER_API_KEY="sk-..." node scripts/openrouter_worker.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL_ID = process.env.MODEL_ID || 'poolside/laguna-s-2.1:free';
const TASK_FILE = process.env.TASK_FILE || path.join(__dirname, '../local_docs/current_task.md');
const OUTPUT_FILE = process.env.OUTPUT_FILE || path.join(__dirname, '../local_docs/llm_output.md');

if (!API_KEY) {
  console.error('❌ Не найден OPENROUTER_API_KEY');
  process.exit(1);
}

if (!fs.existsSync(TASK_FILE)) {
  console.error(`❌ Файл с задачей не найден: ${TASK_FILE}`);
  console.error('Создай файл local_docs/current_task.md с описанием задачи');
  process.exit(1);
}

const task = fs.readFileSync(TASK_FILE, 'utf-8');

console.log(`🚀 Отправка задачи на модель: ${MODEL_ID}`);
console.log(`📄 Задача из: ${TASK_FILE}`);

async function runTask() {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://github.com/REControl',
      'X-Title': 'REControl Dev'
    },
    body: JSON.stringify({
      model: MODEL_ID,
      messages: [
        {
          role: 'system',
          content: 'You are a senior software engineer. Write clean, production-ready code. When asked to write code, provide only the code without explanations unless explicitly asked.'
        },
        {
          role: 'user',
          content: task
        }
      ]
    })
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`❌ API Error ${res.status}:`, body);
    process.exit(1);
  }

  const data = await res.json();
  const result = data.choices?.[0]?.message?.content || 'Пустой ответ от модели';

  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, result, 'utf-8');

  console.log(`✅ Готово! Результат сохранён в: ${OUTPUT_FILE}`);
  console.log(`📊 Использовано токенов: ${data.usage?.total_tokens || 'неизвестно'}`);
}

runTask().catch(err => {
  console.error('❌ Неожиданная ошибка:', err);
  process.exit(1);
});

