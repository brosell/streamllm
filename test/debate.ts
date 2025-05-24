import { filter, finalize, map, Observable, reduce, scan, shareReplay, skip, Subject, switchMap, take, tap } from 'rxjs';
import { Completion, AiInterface } from '../lib'
import OpenAI from 'openai';

// const openAi = new AiInterface(new OpenAI({
//     // apiKey: 'sk-****', // in process.env.OPENAI_API_KEY
//   }), 'gpt-4o'
// );

const llama = new AiInterface(new OpenAI({
    apiKey: 'ollama',
    baseURL: 'http://localhost:7869/v1'
  }), 'llama3.1:latest'
);

const codeLlama = new AiInterface(new OpenAI({
    apiKey: 'ollama',
    baseURL: 'http://localhost:7869/v1'
  }), 'codellama:7b'
);

const qwen  = new AiInterface(new OpenAI({
  apiKey: 'ollama',
  baseURL: 'http://localhost:7869/v1'
}), 'Qwen2.5:latest'
);

function assignModels() : [AiInterface, AiInterface, AiInterface] {
  return [qwen, qwen, qwen];
  // return [openAi, openAi, openAi];
  // if (Math.random() > .5) {
  //   return [llama, openAi, openAi];
  // } else {
  //   return [openAi, llama, openAi]
  // }
}
const iterations = 2;
const debateResponseWordCount = 100;
const conclusionWordCount = 250;

const preamble = `
This will be a discussion about a developing a strategy for leveraging LLMs like ChatGPT for use in
core game mechanics. There strong interest in leveraging Large Language Models for use as a game mechanic. 
LLMs must be utilized to drive NPC decisions and sentiment. It must be used things other than dialog 
generation and intent detection.

Respond concisely. No fillers. No acknowledgments. Answer directly. Ask clarifying questions.
`;

const positionOne = `Designer and Product Manager
${preamble} 
Your position is Designer and Product Manager. You are having a discussion with the programmer about 
game mechanics. Challenge assumptions being made.

Let the discussion flow organically. Let the other meeting attendees open new discussion points.

For each iteration with your colleague analyze if there are current relevant questions to discuss. 
`;

const positionOnePersona = positionOne.split('\n')[0].trim();

const positionTwo = `Programmer Lead and Project Manager
${preamble} 
Your position is Programmer Lead and Project Manager. You are having a discussion 
with others about game mechanics.

Let the discussion flow organically, but make sure to discuss how to construct SYSTEM and USER
prompts that drive the game mechanics.

As project manager always be thinking about how to organize the potential projects, but don't
comment on these aspects unless specifically asked about project management.

As Programmer Lead always evaluate the technical challenges and unknowns and when appropriate 
ask relevant questions.
`;

const positionTwoPersona = positionTwo.split('\n')[0].trim();

const kickoffPrompt = `
This is a general discussion about novel ways to use LLMs as a major game
mechanic. Open the discussion with your programmer lead. 

Use a tactical war simulation RPG as a backdrop. The choices made by the
NPCs must be made by an LLM like OpenAI and must be based on context setting
and current sentiment and reputation of the players and other NPCs. When feasible
players will chat with NPCs directly in a chat interface. The NPCs attributes changes
based on how the conversation goes. 

Start by introducing the discussion point and asking your counterpart their initial thoughts and questions.
`

const positionOneConclusionPrompt = `
  As a designer and product manager create a comprehensive description 
  of the game mechanics that have been discussed.

  Format:
  ### Abstract

  ### Details

  ### Summary and Recommendation
`;

const positionTwoConclusionPrompt = `
  As a programmer lead and project manager create a comprehensive description 
  of the game mechanics that have been discussed. List knowns and unknowns.

  Format:
  ### Abstract

  ### Details
  #### Game Mechanics

  #### Knowns

  #### Known Unknowns

  #### Blockers

  ### Project Plan Overview

  ### Summary and Recommendation
`;

const analysisPrompt = `
You are the CTO smf Chief Game Designer. 

Review this meeting transcript.

Create an executive summary for CEO and C-Suite. Leadership has expressed
strong interest in AI and LLM for use in NOVEL ways as a game mechanic.

Analyze this conversation and provide a comprehensive summary of its key points, 
outcomes, and conclusions. Identify any agreements, disagreements, or areas of 
uncertainty. Highlight the most important information and suggest potential next 
steps.

Output: A report (2 pages) summarizing the main takeaways from this conversation.

Format:
### Executive Summary
<<<an executive summary with remarks about how LLM and other AI tools can create 
interesting and unique gameplay details and what the team has been working on>>>

### Details
#### Current State

#### Future State (Beyond Dialog Generation and Sentiment Analysis)

#### SWOT Analysis
##### Strengths
##### Weaknesses
##### Opportunities
##### Threats

#### Summarize of meeting notes

### Conclusion and Recommendation

---
${preamble}
`



const [positionOneAi, positionTwoAi, analysisAi] = assignModels();

const dps = new Subject<string>();

const $limitedDps = dps.pipe(
  take(iterations),
);

const output = new Subject<string>();

let debateText = ''
output.pipe(
  tap(cur => process.stdout.write(cur)),
  tap(cur => debateText += cur)
).subscribe();

const $positionOneCompletions = $limitedDps.pipe(
  map(prompt => <Completion>{ role: 'SYSTEM', content: prompt }),
  scan<Completion, Completion[], Completion[]>((acc, completion, index) => {
    completion.role = index % 2 ? 'ASSISTANT' : 'USER';
    return [...acc, completion]
  }, [{role: 'SYSTEM', content: positionOne}]),
  shareReplay(1),
);

const $positionTwoCompletions = $limitedDps.pipe(
  skip(1),
  map(prompt => <Completion>{ role: 'SYSTEM', content: prompt }),
  scan<Completion, Completion[], Completion[]>((acc, completion, index) => {
    completion.role = index % 2 ? 'ASSISTANT' : 'USER';
    return [...acc, completion]
  }, [{role: 'SYSTEM', content: positionTwo}]),
  shareReplay(1),
);

const createPipeline = (completions$: Observable<Completion[]>, ai: AiInterface, label: string) => {
  return completions$.pipe(
    filter(completions => completions[completions.length - 1]?.role === 'USER'),
    tap(() => output.next(`\n\n### ${label}\n`)),
    switchMap(completions => ai.stream(completions).pipe(
      tap(delta => output.next(delta)),
      reduce((answer, delta) => answer + delta)
    )),
    tap(() => output.next('\n')),
    tap(answer => dps.next(answer))
  );
};

const complete = new Subject<void>();
const $complete = complete.pipe(
  shareReplay(1),
)

createPipeline($positionOneCompletions, positionOneAi, positionOnePersona).pipe(
  finalize(() => complete.next())
).subscribe();

createPipeline($positionTwoCompletions, positionTwoAi, positionTwoPersona).pipe(
  finalize(() => complete.next())
).subscribe();

const processCompletion = ($completions: Observable<Completion[]>, aiService: AiInterface, label: string, conclusionPrompt: string) => 
  $completions.pipe(
    reduce((acc, cur) => cur),
    tap(() => output.next(`\n\n## ${label} - Conclusion\n`)),
    switchMap((res: Completion[]) =>
      aiService.stream([...res, { role: 'USER', content: conclusionPrompt }]).pipe(
        tap(delta => output.next(delta)),
        reduce((acc, cur) => cur),
        tap(() => output.next('\n')),
      )
    )
  );

$complete.pipe(
  skip(1),
  take(1),
  switchMap(() => processCompletion($positionOneCompletions, positionOneAi, positionOnePersona, positionOneConclusionPrompt)),
  switchMap(() => processCompletion($positionTwoCompletions, positionTwoAi, positionTwoPersona, positionTwoConclusionPrompt)),
  tap(() => process.stdout.write('\n\n## Wrap up\n')),
  switchMap(() => analysisAi.stream([{
      role: 'USER',
      content: `
      ${analysisPrompt}

      ---
      ${debateText}
      `
    }]).pipe(
      tap(delta => output.next(delta)),
      reduce(() => true)
    )
  ),
  tap(() => process.stdout.write('\n\n')),
).subscribe(() =>{
  
});

dps.next(kickoffPrompt);


