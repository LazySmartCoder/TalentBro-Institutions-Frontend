// On-device AI (Chrome Gemini Nano "Built-in AI") wrapper. Lets the
// communication coach reply entirely in the browser — no server round-trip —
// so responses feel instant. Falls back to the backend when unavailable.

export type BrowserAIStatus = "readily" | "after-download" | "no" | "unsupported";

export type BrowserAISession = {
  prompt(text: string): Promise<string>;
  destroy(): void;
};

interface LanguageModelCapabilities {
  available: string;
}

interface LanguageModelOptions {
  systemPrompt?: string;
  initialPrompts?: Array<{ role: "user" | "assistant"; content: string }>;
  temperature?: number;
  topK?: number;
  signal?: AbortSignal;
}

interface LanguageModelSession {
  prompt(text: string): Promise<string>;
  temperature: number;
  topK: number;
  destroy(): void;
}

interface LanguageModelFactory {
  capabilities(): Promise<LanguageModelCapabilities> | LanguageModelCapabilities;
  create(options?: LanguageModelOptions): Promise<LanguageModelSession>;
}

declare global {
  interface Window {
    ai?: { languageModel?: LanguageModelFactory };
    model?: LanguageModelFactory;
  }
}

function normalize(factory: LanguageModelFactory | undefined | null): LanguageModelFactory | null {
  return factory ?? null;
}

export function getBrowserAIFactory(): LanguageModelFactory | null {
  return normalize(window.ai?.languageModel) ?? normalize(window.model);
}

async function availability(factory: LanguageModelFactory | null): Promise<BrowserAIStatus> {
  if (!factory || typeof factory.capabilities !== "function") return "unsupported";
  try {
    const caps = await factory.capabilities();
    const status = typeof caps === "string" ? caps : caps?.available;
    if (status === "readily" || status === "after-download" || status === "no") return status;
    return "unsupported";
  } catch {
    return "unsupported";
  }
}

// Takes a status probe so the caller can react in the UI; falls back to a
// quick "no download wait" policy (only a model already on-device is used).
export async function browserAIStatus(): Promise<BrowserAIStatus> {
  return availability(getBrowserAIFactory());
}

export async function createBrowserSession(
  systemPrompt: string,
  initialPrompts?: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<BrowserAISession | null> {
  const factory = getBrowserAIFactory();
  if (!factory) return null;
  if ((await availability(factory)) !== "readily") return null;
  try {
    const session = await factory.create(
      initialPrompts && initialPrompts.length > 0
        ? { systemPrompt, initialPrompts, temperature: 0.7 }
        : { systemPrompt, temperature: 0.7 },
    );
    return {
      prompt: (text: string) => session.prompt(text),
      destroy: () => {
        try {
          session.destroy();
        } catch {
          // noop
        }
      },
    };
  } catch {
    return null;
  }
}
