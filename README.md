# LocalInspect AI

LocalInspect AI is a local-first multimodal desktop app built with Tauri, React, TypeScript, and Three.js. It uses Gemma through a local Ollama runtime to support three workflows:

1. Physical security and hazard audits from photos
2. Spatial and structural reasoning from multiple images or blueprints
3. Procedural 3D building generation through prompt-to-code synthesis

## What makes it submission-ready

- Local model execution through Ollama, with no cloud dependency in the core workflow
- Streaming chat UX for image-grounded audit sessions
- Structured fallback outputs so the app remains usable if the model is unavailable or times out
- A procedural architecture generator that returns executable Three.js code and renders it in a live viewer
- Test coverage for prompt construction, fallback behavior, and timeout resolution

## Project Structure

- `src/App.tsx`: mode selection and top-level workflow orchestration
- `src/components/AuditChatSession.tsx`: single-image audit chat experience
- `src/components/SpatialAnalysisPanel.tsx`: multi-image spatial and structural review
- `src/components/Building3DViewer.tsx`: procedural 3D architecture viewer and code executor
- `src/lib/ollamaApi.ts`: Ollama streaming client, image encoding, and timeout handling
- `src/lib/spatialAnalysis.ts`: spatial reasoning prompt and fallback report generation
- `src/lib/architectEngine.ts`: building presets, prompt synthesis, fallback geometry, and code normalization
- `src/lib/*.test.ts`: unit tests for the critical model-facing utilities

## Gemma Integration

How Gemma 4 Was Implemented
Gemma 4 is used as the core reasoning engine in all three modes through a local Ollama API endpoint at `http://localhost:11434/api/chat`. The app uses the configured default model gemma4:e2b, with the model name and timeout both overrideable through environment variables.

Implementation details:

Images are loaded from disk through Tauri plugins, converted to base64, and attached directly to chat messages.
Responses are streamed token by token so the UI feels interactive rather than blocking on a full completion.
The system prompts are specialized for each mode: physical safety audit, spatial reasoning, and architectural code generation.
The architectural generator asks Gemma 4 to return executable JavaScript inside a fenced code block, then normalizes the response before rendering.
If the model times out or returns unusable output, the app falls back to deterministic reports or fallback Three.js geometry instead of failing silently.

The app is configured to talk to a local Ollama server at `http://localhost:11434/api/chat`.

Default model:

```text
gemma4:e2b
```

You can override the model and timeout with environment variables:

```bash
VITE_OLLAMA_MODEL=gemma4:e2b
VITE_OLLAMA_TIMEOUT_MS=300000
```

## Local Setup

Install and launch Ollama and pull the gemma4 model e2b:

```bash
ollama pull gemma4:e2b
```

Install dependencies:

```bash
npm install
```

Run the test suite:

```bash
npm test
```

Run the web app in development:

```bash
npm run dev
```

Build the frontend:

```bash
npm run build
```

Run the desktop app from the project root:

```bash
npm run tauri dev
```

If you are running the desktop shell, make sure Ollama is already running locally and the Gemma model is available.
