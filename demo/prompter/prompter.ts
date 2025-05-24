#!/usr/bin/env ts-node
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { AiModel } from '@barosell/streamllm'
import OpenAI from 'openai';
import { tap, finalize } from 'rxjs';
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

let inputData = '';

// Collect data from stdin
process.stdin.on('data', (chunk) => {
  if (!argv.q) {
    process.stdout.write(chunk);
  }
  inputData += chunk;
});

process.stdin.on('end', () => {
  const content = userPrompt.replace('{{content}}', inputData.trim());
  ai.stream([{
  role: 'USER',
  content
}]).pipe(
  tap(delta => process.stdout.write(delta)),
  finalize(() => process.stdout.write('\n\n')),
).subscribe();
});

