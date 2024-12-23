import { finalize, scan, tap } from 'rxjs';
import { AiInterface, ChatRole } from '../lib/ai'

// const ai = new AiInterface({
//   apiKey: 'sk-',
//   model: 'gpt-3.5-turbo',
// });

const ai = new AiInterface({
  apiKey: 'ollama',
  model: 'llama3.1:latest',
  baseURL: 'http://localhost:7869/v1'
});

// const ai = new AiInterface({
//   apiKey: 'ollama',
//   model: 'codellama:7b',
//   baseURL: 'http://localhost:7869/v1'
// });

ai.prompt([{
  role: ChatRole.USER,
  content: 'Write 3 haiku about wrapping paper'
}]).pipe(
  tap(delta => process.stdout.write(delta)),
  finalize(() => process.stdout.write('\n\n')),
).subscribe();
