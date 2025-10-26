export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  images?: string[]; // Array of base64 encoded images
}

export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

export interface OllamaTagResponse {
  models: OllamaModel[];
}

export interface OllamaChatChunk {
  model: string;
  created_at: string;
  message: {
    role: 'assistant';
    content: string;
  };
  done: boolean;
}

export interface OllamaPullStatus {
  status: string;
  digest?: string;
  total?: number;
  completed?: number;
  error?: string;
}

export interface OllamaModelDetails {
  parent_model: string;
  format: string;
  family: string;
  families: string[] | null;
  parameter_size: string;
  quantization_level: string;
}

export interface OllamaModelInfo {
  license: string;
  modelfile: string;
  parameters: string;
  template: string;
  details: OllamaModelDetails;
}