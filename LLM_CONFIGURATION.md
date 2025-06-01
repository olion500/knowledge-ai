# LLM Provider Configuration

This application now supports both OpenAI and Ollama as LLM providers. You can switch between them using environment variables.

## Environment Variables

### Core LLM Settings
```bash
# Choose provider: 'openai' or 'ollama'
LLM_PROVIDER=openai

# Global LLM Settings
LLM_MAX_TOKENS=4000
LLM_TEMPERATURE=0.3
```

### OpenAI Configuration
When using `LLM_PROVIDER=openai`:
```bash
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4-turbo-preview
# Optional: Custom OpenAI base URL (for OpenAI-compatible APIs)
OPENAI_BASE_URL=https://api.openai.com/v1
```

### Ollama Configuration  
When using `LLM_PROVIDER=ollama`:
```bash
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama2
```

## Ollama Setup

### 1. Install Ollama
```bash
# On macOS/Linux
curl -fsSL https://ollama.ai/install.sh | sh

# Or visit https://ollama.ai for other installation methods
```

### 2. Pull a Model
```bash
# Pull Llama 2 (7B parameters)
ollama pull llama2

# Or other models
ollama pull codellama      # For code generation
ollama pull mistral        # Alternative model
ollama pull mixtral        # Larger model for better performance
```

### 3. Start Ollama Server
```bash
ollama serve
```

The server will start on `http://localhost:11434` by default.

## Popular Ollama Models

| Model | Size | Use Case |
|-------|------|----------|
| `llama2` | 7B | General purpose, good balance |
| `codellama` | 7B | Code generation and understanding |
| `mistral` | 7B | Fast and efficient |
| `mixtral` | 8x7B | High quality, larger model |
| `llama2:13b` | 13B | Better quality, slower |

## Switching Providers

To switch from OpenAI to Ollama:
1. Set `LLM_PROVIDER=ollama` in your environment
2. Ensure Ollama is running locally
3. Set `OLLAMA_MODEL` to your preferred model
4. Restart the application

To switch back to OpenAI:
1. Set `LLM_PROVIDER=openai` 
2. Ensure `OPENAI_API_KEY` is set
3. Restart the application

## Health Check

The application provides a health check endpoint to verify provider availability:
```typescript
// Available in LLMService
const status = await llmService.checkProviderAvailability();
console.log(status);
// { available: true, provider: "OpenAIProvider", model: "gpt-4-turbo-preview" }
```

## Troubleshooting

### Ollama Issues
- **Connection refused**: Ensure Ollama server is running (`ollama serve`)
- **Model not found**: Pull the model first (`ollama pull <model_name>`)
- **Port conflicts**: Change `OLLAMA_BASE_URL` if using different port

### OpenAI Issues  
- **401 Unauthorized**: Check your `OPENAI_API_KEY`
- **Model not found**: Verify the model name in `OPENAI_MODEL`
- **Rate limits**: Consider upgrading your OpenAI plan

### JSON Response Issues
Both providers are configured to return JSON responses. Ollama responses are processed to extract JSON when the `response_format: { type: 'json_object' }` option is used. 