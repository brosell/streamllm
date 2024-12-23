import { concat, filter, finalize, map, Observable, of, reduce, scan, shareReplay, skip, Subject, switchMap, take, tap } from 'rxjs';
import { AiInterface, ChatRole, Completion } from '../lib/ai'

const gpt35 = new AiInterface({
  apiKey: 'sk-',
  model: 'gpt-3.5-turbo',
});

const llama = new AiInterface({
  apiKey: 'ollama',
  model: 'llama3.1:latest',
  baseURL: 'http://localhost:7869/v1'
});

function assignModels() : [AiInterface, AiInterface] {
  return [llama, llama];
  // return [gpt35, gpt35];
  if (Math.random() > .5) {
    return [llama, gpt35];
  } else {
    return [gpt35, llama]
  }
}

const preamble = `You are a debate student in a mock debate.
"Which band has had a more significant influence on the evolution of heavy metal music: Iron Maiden or Metallica?"

This debate prompt invites an exploration of each band's contributions to the genre, their innovation in music
and live performances, their global impact, and their influence on subsequent generations of musicians.

Use 50 or fewer words per response.
`;

const maidenPreamble = `${preamble} You will be arguing that Iron Maiden is more significant than Metallica. You are a PhD candidate`;
const metallicaPreamble = `${preamble} You will be arguing that Metallica is more significant than Iron Maiden. you are a 5 year old girl`;

const [maidenAi, metallicaAi] = assignModels();

const dps = new Subject<string>();

const $limitedDps = dps.pipe(
  take(4),
);

const maidenCompletions = $limitedDps.pipe(
  map(prompt => <Completion>{ role: ChatRole.SYSTEM, content: prompt }),
  scan<Completion, Completion[], Completion[]>((acc, completion, index) => {
    completion.role = index % 2 ? ChatRole.ASSISTANT : ChatRole.USER;
    return [...acc, completion]
  }, [{role: ChatRole.SYSTEM, content: maidenPreamble}]),
  shareReplay(1),
);

const metallicaCompletions = $limitedDps.pipe(
  skip(1),
  map(prompt => <Completion>{ role: ChatRole.SYSTEM, content: prompt }),
  scan<Completion, Completion[], Completion[]>((acc, completion, index) => {
    completion.role = index % 2 ? ChatRole.ASSISTANT : ChatRole.USER;
    return [...acc, completion]
  }, [{role: ChatRole.SYSTEM, content: metallicaPreamble}]),
  shareReplay(1),
);

const createPipeline = (completions$: Observable<Completion[]>, ai: AiInterface, label: string) => {
  return completions$.pipe(
    filter(completions => completions[completions.length - 1]?.role === ChatRole.USER),
    tap(() => console.log(`\n\n**${label}**\n`)),
    switchMap(completions => ai.prompt(completions).pipe(
      tap(delta => process.stdout.write(delta)),
      reduce((answer, delta) => answer + delta)
    )),
    tap(() => process.stdout.write('\n')),
    tap(answer => dps.next(answer))
  );
};

createPipeline(maidenCompletions, maidenAi, 'Iron Maiden').subscribe();
createPipeline(metallicaCompletions, metallicaAi, 'Metallica').subscribe();

dps.next('You go first. Begin');


