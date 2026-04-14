// packages/shared/src/agentProvider.ts
//
// Universal AI Provider Abstraction for Chainbook
//
// Swap the brain with ONE env var:
//   AGENT_PROVIDER=anthropic -> claude-haiku-4-5-20251001
//   AGENT_PROVIDER=openai    -> gpt-4o-mini
//   AGENT_PROVIDER=gemini    -> gemini-2.0-flash
//   AGENT_PROVIDER=groq      -> llama-3.3-70b-versatile

export type ProviderName = 'anthropic' | 'openai' | 'gemini' | 'groq'

export interface ToolDefinition {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export interface ToolCall {
  id: string
  name: string
  input: Record<string, unknown>
}

export interface TextBlock { type: 'text'; text: string }
export interface ToolUseBlock { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
export interface ToolResultBlock { type: 'tool_result'; tool_use_id: string; tool_name?: string; content: string }

export type NormedBlock = TextBlock | ToolUseBlock | ToolResultBlock

export interface NormedMessage {
  role: 'user' | 'assistant'
  content: string | NormedBlock[]
}

export interface StepResult {
  done: boolean
  text: string
  toolCalls: ToolCall[]
}

export interface AgentProvider {
  readonly name: ProviderName
  step(
    messages: NormedMessage[],
    tools: ToolDefinition[],
    system: string,
    maxTokens?: number,
  ): Promise<StepResult>
}

export function createProviderFromEnv(): AgentProvider {
  const name = (process.env.AGENT_PROVIDER ?? 'anthropic') as ProviderName
  const key = process.env.AGENT_API_KEY ?? process.env.ANTHROPIC_API_KEY ?? ''
  if (!key) throw new Error('[AgentProvider] No API key found. Set AGENT_API_KEY in your env.')
  return createProvider(name, key)
}

export function createProvider(name: ProviderName, apiKey: string): AgentProvider {
  switch (name) {
    case 'anthropic': return new AnthropicProvider(apiKey)
    case 'openai': return new OpenAIProvider(apiKey)
    case 'gemini': return new GeminiProvider(apiKey)
    case 'groq': return new GroqProvider(apiKey)
    default: throw new Error(`[AgentProvider] Unknown provider "${String(name)}". Valid: anthropic | openai | gemini | groq`)
  }
}

export interface AgentLoopOptions {
  provider: AgentProvider
  initialMessages: NormedMessage[]
  tools: ToolDefinition[]
  system: string
  executor: (calls: ToolCall[]) => Promise<Array<{ id: string; result: unknown }>>
  maxRounds?: number
  maxTokens?: number
}

export async function runAgentLoop(opts: AgentLoopOptions): Promise<string> {
  const { provider, tools, system, executor, maxRounds = 5, maxTokens = 1024 } = opts
  let messages: NormedMessage[] = [...opts.initialMessages]

  for (let round = 0; round < maxRounds; round += 1) {
    const step = await provider.step(messages, tools, system, maxTokens)

    if (step.done) return step.text || 'Done.'

    const results = await executor(step.toolCalls)

    const toolResultBlocks: ToolResultBlock[] = results.map(({ id, result }) => {
      const call = step.toolCalls.find((tc) => tc.id === id)
      return {
        type: 'tool_result',
        tool_use_id: id,
        tool_name: call?.name,
        content: typeof result === 'string' ? result : JSON.stringify(result),
      }
    })

    const assistantBlocks: NormedBlock[] = [
      ...(step.text ? [{ type: 'text' as const, text: step.text }] : []),
      ...step.toolCalls.map((tc): ToolUseBlock => ({
        type: 'tool_use',
        id: tc.id,
        name: tc.name,
        input: tc.input,
      })),
    ]

    messages = [
      ...messages,
      { role: 'assistant', content: assistantBlocks },
      { role: 'user', content: toolResultBlocks },
    ]
  }

  return 'Analysis limit reached.'
}

const ANTHROPIC_DEFAULT_MODEL = 'claude-haiku-4-5-20251001'

class AnthropicProvider implements AgentProvider {
  readonly name: ProviderName = 'anthropic'
  private readonly model: string

  constructor(private readonly apiKey: string) {
    this.model = process.env.AGENT_MODEL ?? ANTHROPIC_DEFAULT_MODEL
  }

  async step(messages: NormedMessage[], tools: ToolDefinition[], system: string, maxTokens = 1024): Promise<StepResult> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        system,
        tools: tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })),
        messages: toAnthropicMessages(messages),
      }),
    })

    if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`)

    const data = await res.json() as {
      stop_reason: 'end_turn' | 'tool_use' | 'max_tokens'
      content: Array<{ type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> }>
    }

    const text = data.content.filter((b) => b.type === 'text').map((b) => b.text ?? '').join('')

    if (data.stop_reason === 'tool_use') {
      return {
        done: false,
        text,
        toolCalls: data.content
          .filter((b) => b.type === 'tool_use')
          .map((b) => ({ id: b.id!, name: b.name!, input: b.input ?? {} })),
      }
    }

    return { done: true, text, toolCalls: [] }
  }
}

function toAnthropicMessages(messages: NormedMessage[]) {
  return messages.map((m) => {
    if (typeof m.content === 'string') return { role: m.role, content: m.content }
    return {
      role: m.role,
      content: m.content.map((b) => {
        if (b.type === 'text') return { type: 'text', text: b.text }
        if (b.type === 'tool_use') return { type: 'tool_use', id: b.id, name: b.name, input: b.input }
        if (b.type === 'tool_result') return { type: 'tool_result', tool_use_id: b.tool_use_id, content: b.content }
        return b
      }),
    }
  })
}

const OPENAI_DEFAULT_MODEL = 'gpt-4o-mini'

class OpenAIProvider implements AgentProvider {
  readonly name: ProviderName = 'openai'
  private readonly model: string

  constructor(private readonly apiKey: string) {
    this.model = process.env.AGENT_MODEL ?? OPENAI_DEFAULT_MODEL
  }

  async step(messages: NormedMessage[], tools: ToolDefinition[], system: string, maxTokens = 1024): Promise<StepResult> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        tools: tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })),
        tool_choice: 'auto',
        messages: toOpenAIMessages(messages, system),
      }),
    })

    if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`)

    const data = await res.json() as {
      choices: Array<{
        finish_reason: string
        message: {
          content: string | null
          tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>
        }
      }>
    }

    const choice = data.choices[0]
    if (!choice) throw new Error('OpenAI returned no choices')

    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
      return {
        done: false,
        text: choice.message.content ?? '',
        toolCalls: choice.message.tool_calls.map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments) as Record<string, unknown>,
        })),
      }
    }

    return { done: true, text: choice.message.content ?? '', toolCalls: [] }
  }
}

function toOpenAIMessages(messages: NormedMessage[], system: string): Array<Record<string, unknown>> {
  const out: Array<Record<string, unknown>> = [{ role: 'system', content: system }]

  for (const m of messages) {
    if (typeof m.content === 'string') {
      out.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })
      continue
    }

    const toolResults = m.content.filter((b): b is ToolResultBlock => b.type === 'tool_result')
    const toolUseBlocks = m.content.filter((b): b is ToolUseBlock => b.type === 'tool_use')
    const textBlocks = m.content.filter((b): b is TextBlock => b.type === 'text')

    if (toolResults.length > 0) {
      for (const tr of toolResults) {
        out.push({ role: 'tool', tool_call_id: tr.tool_use_id, content: tr.content })
      }
    } else if (toolUseBlocks.length > 0) {
      out.push({
        role: 'assistant',
        content: textBlocks.map((b) => b.text).join('') || null,
        tool_calls: toolUseBlocks.map((b) => ({
          id: b.id,
          type: 'function',
          function: { name: b.name, arguments: JSON.stringify(b.input) },
        })),
      })
    } else {
      out.push({ role: m.role === 'assistant' ? 'assistant' : 'user', content: textBlocks.map((b) => b.text).join('') })
    }
  }

  return out
}

const GEMINI_DEFAULT_MODEL = 'gemini-2.0-flash'

class GeminiProvider implements AgentProvider {
  readonly name: ProviderName = 'gemini'
  private readonly model: string

  constructor(private readonly apiKey: string) {
    this.model = process.env.AGENT_MODEL ?? GEMINI_DEFAULT_MODEL
  }

  async step(messages: NormedMessage[], tools: ToolDefinition[], system: string, maxTokens = 1024): Promise<StepResult> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        tools: [{ functionDeclarations: tools.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters })) }],
        generationConfig: { maxOutputTokens: maxTokens },
        contents: toGeminiContents(messages),
      }),
    })

    if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`)

    const data = await res.json() as {
      candidates: Array<{
        content: {
          parts: Array<{
            text?: string
            functionCall?: { name: string; args: Record<string, unknown> }
          }>
        }
      }>
    }

    const parts = data.candidates[0]?.content?.parts ?? []
    const fnCalls = parts.filter((p) => p.functionCall)
    const text = parts.filter((p) => p.text).map((p) => p.text ?? '').join('')

    if (fnCalls.length > 0) {
      return {
        done: false,
        text,
        toolCalls: fnCalls.map((p, i) => ({
          id: `gemini-${Date.now()}-${i}`,
          name: p.functionCall!.name,
          input: p.functionCall!.args ?? {},
        })),
      }
    }

    return { done: true, text, toolCalls: [] }
  }
}

function toGeminiContents(messages: NormedMessage[]) {
  return messages.map((m) => {
    const role = m.role === 'assistant' ? 'model' : 'user'
    if (typeof m.content === 'string') return { role, parts: [{ text: m.content }] }

    const parts: unknown[] = []
    for (const b of m.content) {
      if (b.type === 'text') parts.push({ text: b.text })
      if (b.type === 'tool_use') parts.push({ functionCall: { name: b.name, args: b.input } })
      if (b.type === 'tool_result') parts.push({ functionResponse: { name: b.tool_name ?? b.tool_use_id, response: { content: b.content } } })
    }
    return { role, parts }
  })
}

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_DEFAULT_MODEL = 'llama-3.3-70b-versatile'

class GroqProvider implements AgentProvider {
  readonly name: ProviderName = 'groq'
  private readonly model: string

  constructor(private readonly apiKey: string) {
    this.model = process.env.AGENT_MODEL ?? GROQ_DEFAULT_MODEL
  }

  async step(messages: NormedMessage[], tools: ToolDefinition[], system: string, maxTokens = 1024): Promise<StepResult> {
    const res = await fetch(GROQ_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        parallel_tool_calls: false,
        tools: tools.map((t) => ({
          type: 'function',
          function: { name: t.name, description: t.description, parameters: t.parameters },
        })),
        tool_choice: 'auto',
        messages: toOpenAIMessages(messages, system),
      }),
    })

    if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`)

    const data = await res.json() as {
      choices: Array<{
        finish_reason: string
        message: {
          content: string | null
          tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>
        }
      }>
    }

    const choice = data.choices[0]
    if (!choice) throw new Error('Groq returned no choices')

    if (choice.finish_reason === 'tool_calls' && choice.message.tool_calls?.length) {
      return {
        done: false,
        text: choice.message.content ?? '',
        toolCalls: choice.message.tool_calls.map((tc) => ({
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments) as Record<string, unknown>,
        })),
      }
    }

    return { done: true, text: choice.message.content ?? '', toolCalls: [] }
  }
}
