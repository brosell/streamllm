import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources";
import { filter, map, Observable, Subject } from "rxjs";

export type ChatRole = 'SYSTEM' | 'USER' | 'ASSISTANT';

export interface Completion {
  role: ChatRole;
  content: string;
}

export class AiInterface {
  constructor(
    private openai: OpenAI,
    private model: string
  ) {  }

  stream(completions: Completion[]): Observable<string> {
    const subject = new Subject<{content: string, type: string}>();
    const deltas = subject.pipe(
      filter(c => c.type == 'delta'),
      map(c => c.content),
    );

    const response = subject.pipe(
      filter(c => c.type == 'response'),
      map(c => c.content)
    );

    (async () => {
      try {
        const stream = await this.openai.chat.completions.create({
          messages: completions.map(c => ({ role: c.role.toLowerCase(), content: c.content } as ChatCompletionMessageParam)), 
          model: this.model,
          stream: true,
        });

        let content = '';
        for await (const part of stream) {
          const delta = part.choices[0]?.delta?.content || '';
          content += delta;
          subject.next({type: 'delta', content: delta});
        }
  
        subject.next({type: 'response', content});
        subject.complete();
      } catch(error) {
        subject.error(error);
        subject.complete();
      }
    })();

    return deltas;
  }
}