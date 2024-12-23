import { concat, debounce, debounceTime, delay, filter, finalize, map, Observable, of, reduce, scan, shareReplay, skip, Subject, switchMap, take, tap } from 'rxjs';
import { AiInterface, ChatRole, Completion } from '../lib/ai'
import { access } from 'fs';

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
const iterations = 4;
const debateResponseWordCount = 100;
const conclusionWordCount = 150;

const preamble = `Debate Topic: "Should genetic modification technologies be used to enhance human capabilities beyond therapeutic purposes?"

Context: With the advent of CRISPR and other gene-editing technologies, the possibility of genetically enhancing human traits such as intelligence, physical ability, or psychological resilience is becoming more plausible. Proponents argue that this could lead to a new era of human potential, addressing issues such as disease prevention, enhanced cognitive abilities, and overall improved quality of life. Opponents raise concerns about ethical implications, societal inequality, and the fundamental nature of humanity. This topic invites exploration of scientific, ethical, and philosophical perspectives.

Key Points to Explore:

The ethical implications of genetic enhancement and the concept of "playing God"
Potential social inequality resulting from access to genetic enhancements
Scientific feasibility and the current state of genetic technology
Long-term societal impacts, including the concept of eugenics
Legal and regulatory challenges associated with genetic enhancement policy
Using this topic, students are encouraged to delve into interdisciplinary research, examining the implications from various angles including ethics, law, biotechnology, and sociology.

Use ${debateResponseWordCount} or fewer words per response. Use active voice. Tone is professional and sincere. 

It is fair to attack your opponents points.
`;

const positionOne = `${preamble} 
Your position is For.`;

const positionTwo = `${preamble} 
Your position is Against.`;

const conclusionPrompt = `
Now provide a conclusion to _your_ argument. Incorporate your opponents points. ${conclusionWordCount} words. You may only refer the the content of this debate. Outside sources are not allowed'
`

const [positionOneAi, positionTwoAi] = assignModels();

const dps = new Subject<string>();

const $limitedDps = dps.pipe(
  take(iterations),
);

const $positionOneCompletions = $limitedDps.pipe(
  map(prompt => <Completion>{ role: ChatRole.SYSTEM, content: prompt }),
  scan<Completion, Completion[], Completion[]>((acc, completion, index) => {
    completion.role = index % 2 ? ChatRole.ASSISTANT : ChatRole.USER;
    return [...acc, completion]
  }, [{role: ChatRole.SYSTEM, content: positionOne}]),
  shareReplay(1),
);

const $positionTwoCompletions = $limitedDps.pipe(
  skip(1),
  map(prompt => <Completion>{ role: ChatRole.SYSTEM, content: prompt }),
  scan<Completion, Completion[], Completion[]>((acc, completion, index) => {
    completion.role = index % 2 ? ChatRole.ASSISTANT : ChatRole.USER;
    return [...acc, completion]
  }, [{role: ChatRole.SYSTEM, content: positionTwo}]),
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

const complete = new Subject<void>();
const $complete = complete.pipe(
  shareReplay(1),
)

createPipeline($positionOneCompletions, positionOneAi, 'For').pipe(
  finalize(() => complete.next())
).subscribe();

createPipeline($positionTwoCompletions, positionTwoAi, 'Against').pipe(
  finalize(() => complete.next())
).subscribe();

$complete.pipe(
  skip(1), take(1),
  switchMap(() => $positionOneCompletions.pipe(
    reduce((acc, cur) => cur),
    take(1),
    tap(() => process.stdout.write('\n\nFor - Conclusion\n')),
    switchMap((res: Completion[]) => positionOneAi.prompt([
      ...res, {
        role: ChatRole.USER,
        content: conclusionPrompt
      }]).pipe(
        tap(delta => process.stdout.write(delta)),
       )
    ),
    reduce((acc, cur) => cur),
    tap(() => process.stdout.write('\n')),
    switchMap(() => $positionTwoCompletions.pipe(
      reduce((acc, cur) => cur),
      tap(() => process.stdout.write('\n\nAgainst - Conclusion\n')),
      switchMap((res: Completion[]) => positionTwoAi.prompt([
        ...res, {
          role: ChatRole.USER,
          content: conclusionPrompt
        }]).pipe(
          tap(delta => process.stdout.write(delta)),
        )
      ),
      finalize(() => process.stdout.write('\n'))
    )),
  )),
  
).subscribe();

dps.next('You go first. Begin');


