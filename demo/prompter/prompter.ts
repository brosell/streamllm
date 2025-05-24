#!/usr/bin/env ts-node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { AiModel } from '@barosell/streamllm'
import OpenAI from 'openai';
import { tap, finalize, fromEvent, map, reduce, switchMap, takeUntil } from 'rxjs';
import { readFileSync } from 'fs';

const argv: any = yargs(hideBin(process.argv))
  .scriptName('prompter')
  .option('prompt', {
    alias: 'p',
    type: 'string',
    description: 'prompt to send to the model',
    demandOption: true,
  }).option('quiet', {
    alias: 'q',
    type: 'boolean',
    description: 'don\'t print the input',
  })
  .parse();

function getPrompt(input: string): string {
  if (input.startsWith('@')) {
    const filePath = input.slice(1);
    return readFileSync(filePath, 'utf8');
  }
  return input;
}
const prompt = getPrompt(argv.prompt);
const userPrompt = prompt.indexOf('{{content}}') > -1 ? prompt : `${prompt}\n---\n{{content}}`;
  
const ai = new AiModel(
  new OpenAI({
    // apiKey: 'sk-****', // in process.env.OPENAI_API_KEY
  }), 
  'gpt-4o'
);

process.stdin.setEncoding('utf8');

fromEvent(process.stdin, 'data').pipe(
  takeUntil(fromEvent(process.stdin, 'end')),
  tap(chunk => {
    if (!argv.q) {
       process.stdout.write(chunk as string);
    }
  }),
  reduce((acc, chunk) => acc + chunk, ''),
  map(data => userPrompt.replace('{{content}}', data.trim())),
  switchMap(content  => ai.stream([{
    role: 'USER',
    content
  }])),
  tap(delta =>  process.stdout.write(delta)),
  finalize(() => console.log('\n\n')),
).subscribe();
