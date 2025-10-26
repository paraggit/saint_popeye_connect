import type { OllamaTagResponse, OllamaChatChunk, ChatMessage, OllamaPullStatus, OllamaModelInfo } from '../types';

export class OllamaService {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  }

  async listModels(): Promise<OllamaTagResponse> {
    const response = await fetch(`${this.baseUrl}/api/tags`);
    if (!response.ok) {
      throw new Error('Failed to fetch models from Ollama.');
    }
    return response.json();
  }
  
  async getModelInfo(modelName: string): Promise<OllamaModelInfo> {
    const response = await fetch(`${this.baseUrl}/api/show`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: modelName }),
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch model info for ${modelName}.`);
    }
    return response.json();
  }


  async pullModel(modelName: string, onProgress: (status: OllamaPullStatus) => void): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/pull`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: modelName, stream: true }),
    });

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        
        // Sometimes multiple JSON objects come in one chunk
        const jsonObjects = chunk.split('\n').filter(s => s.trim() !== '');
        jsonObjects.forEach(jsonObj => {
          try {
            const parsed = JSON.parse(jsonObj);
            onProgress(parsed as OllamaPullStatus);
          } catch (e) {
            console.error("Failed to parse pull status chunk:", e, jsonObj);
          }
        });
      }
    } finally {
      reader.releaseLock();
    }
  }

  async streamChat(
    model: string,
    messages: ChatMessage[],
    onChunk: (chunk: string) => void
  ): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, messages, stream: true }),
    });

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });

      // Process complete JSON objects from the buffer
      let boundary = buffer.indexOf('\n');
      while (boundary !== -1) {
        const jsonStr = buffer.substring(0, boundary);
        buffer = buffer.substring(boundary + 1);
        if (jsonStr.trim()) {
          try {
            const chunk = JSON.parse(jsonStr) as OllamaChatChunk;
            if (chunk.message && chunk.message.content) {
              onChunk(chunk.message.content);
            }
            if (chunk.done) {
              return;
            }
          } catch (e) {
            console.error('Failed to parse chat chunk:', e, jsonStr);
          }
        }
        boundary = buffer.indexOf('\n');
      }
    }
  }
}