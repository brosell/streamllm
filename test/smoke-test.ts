import { finalize, scan, tap } from 'rxjs';
import { AiInterface } from '../lib'
import OpenAI from 'openai';


const ai = new AiInterface(new OpenAI({
    // apiKey: 'sk-****', // in process.env.OPENAI_API_KEY
  }), 'gpt-4o'
);

// const ai = new AiInterface({
//   apiKey: 'ollama',
//   model: 'codellama:7b',
//   baseURL: 'http://localhost:7869/v1'
// });

ai.stream([{
  role: 'USER',
  content: 'Write 3 haiku about wrapping paper'
}]).pipe(
  tap(delta => process.stdout.write(delta)),
  finalize(() => process.stdout.write('\n\n')),
).subscribe();
