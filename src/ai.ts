import OpenAI, { ClientOptions } from "openai";
import { ChatCompletionMessageParam } from "openai/resources";
import { Observable, Subject } from "rxjs";

export enum ChatRole {
  SYSTEM = 'SYSTEM',
  USER = 'USER',
  ASSISTANT = 'ASSISTANT'
}
export interface Completion {
  role: ChatRole;
  content: string;
}

export interface ObservableLlmOptions extends ClientOptions {
  model: string;
}

export class AiInterface {
  private openai!: OpenAI;

  constructor(private config: ObservableLlmOptions) {
    this.openai = new OpenAI(this.config);
  }

  prompt(completions: Completion[]): Observable<string> {
    const deltas = new Subject<string>();

    (async () => {
      try {
        const stream = await this.openai.chat.completions.create({
          messages: completions.map(c => ({ role: c.role.toLowerCase(), content: c.content } as ChatCompletionMessageParam)), 
          model: this.config.model,
          stream: true,
        });

        let content = '';
        for await (const part of stream) {
          content += part.choices[0]?.delta?.content || '';
          deltas.next(part?.choices[0]?.delta?.content || '');
        }
  
        deltas.complete();
      } catch(error) {
        deltas.error(error)
      }
    })();

    return deltas;
  }
}