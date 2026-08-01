# LocalInspect AI
## Local-first multimodal facility auditing and architectural generation with Gemma 4
**Track:** Creative Tools / Applied AI

### Project Summary
LocalInspect AI is a desktop-first multimodal application that turns Gemma 4 into a practical architectural assistant. The app runs locally through Tauri, React, TypeScript, Three.js, and Ollama, and it supports three connected workflows: photo-based physical security audits, spatial and structural analysis from multiple visual references, and procedural 3D building generation from natural-language briefs.

The goal of the project was not just to demo model output, but to build an engineering-grade workflow around the model: image ingestion, streaming responses, prompt control, structured fallback behavior, and an interactive 3D rendering loop. That makes the demo useful even under partial model failure and gives judges a clear view of how Gemma 4 was integrated end to end.

### Architecture
The app is organized as a local desktop shell with a shared model layer.

- `src/App.tsx` routes users between the three modes and manages the active session state.
- `src/components/AuditChatSession.tsx` handles a single-image inspection thread. It loads the selected facility image, sends it to Gemma 4, and streams the response into a markdown chat UI. Users can continue the conversation and attach additional remediation images without losing context.
- `src/components/SpatialAnalysisPanel.tsx` supports multi-image reasoning for exterior photos, blueprints, and site references. It packages the selected assets as base64 data and asks Gemma 4 for structural type, load-path reasoning, vulnerabilities, evidence versus inference, and a Building Safety Index.
- `src/components/Building3DViewer.tsx` is the procedural architecture workspace. It requests executable Three.js code from the model, evaluates the returned script in a controlled scene wrapper, centers the generated object, and frames the camera around the result.
- `src/lib/ollamaApi.ts` is the shared model bridge. It normalizes file paths, converts local images into base64, streams chat responses from Ollama, and enforces configurable request timeouts.
- `src/lib/spatialAnalysis.ts` and `src/lib/architectEngine.ts` define the system prompts, fallback outputs, and prompt-building logic that keep the app stable when the model is slow or unavailable.

This structure keeps the model integration isolated from the UI, which made the application easier to test and safer to extend during the sprint.

### How Gemma 4 Was Implemented
Gemma 4 is used as the core reasoning engine in all three modes through a local Ollama API endpoint at `http://localhost:11434/api/chat`. The app uses the configured default model `gemma4:e2b`, with the model name and timeout both overrideable through environment variables.

Implementation details:

- Images are loaded from disk through Tauri plugins, converted to base64, and attached directly to chat messages.
- Responses are streamed token by token so the UI feels interactive rather than blocking on a full completion.
- The system prompts are specialized for each mode: physical safety audit, spatial reasoning, and architectural code generation.
- The architectural generator asks Gemma 4 to return executable JavaScript inside a fenced code block, then normalizes the response before rendering.
- If the model times out or returns unusable output, the app falls back to deterministic reports or fallback Three.js geometry instead of failing silently.

That combination lets Gemma 4 behave like a real application component rather than a standalone prompt demo.

### Challenges Solved During the Sprint
The two-week build required solving a few practical integration problems:

1. Local model reliability.
   - A desktop app needs to keep working when the model is slow, temporarily unavailable, or returns malformed output. I added fallback reports and fallback geometry so every workflow has a usable result.

2. Image handling across desktop and web contexts.
   - The app accepts both file paths and uploaded files, normalizes them into base64, and passes them consistently into the model layer.

3. Executable code generation.
   - Instead of treating the 3D architect mode as plain text, the app validates and normalizes the model output so it can be rendered directly in Three.js.

4. Prompt control and context management.
   - Each workflow has a dedicated prompt tuned to the task, and the chat pipeline trims older turns so longer sessions remain within context limits.

5. Testing model-adjacent logic.
   - The project includes unit tests around timeout resolution, fallback report generation, prompt synthesis, and code normalization so the app behavior stays predictable.

### Impact
The finished system is valuable because it combines reasoning, visualization, and local privacy in one workflow.

- Facility teams can inspect images and discuss remediation steps in one thread.
- Structural reviewers can reason about load points, envelope weaknesses, and safety risk from multiple references.
- Designers can move from a text brief to a live 3D architectural concept without leaving the app.
- Because the experience runs locally, the workflow is better suited to sensitive spaces, internal design iterations, and low-connectivity environments.

In practice, the project demonstrates that Gemma 4 can serve as a foundation for a polished, domain-specific desktop tool rather than only a chat interface.

### Engineering Outcome
The codebase is now structured around reusable model utilities, explicit prompts, and deterministic fallback paths. That makes the app easier to review, easier to validate, and better prepared for public submission. The repository includes test coverage and documentation so judges can inspect how the model is integrated and how the app behaves when the model is not available.

### Project Links

- Public repository: `https://github.com/<your-username>/local-inspect-ai`
- Public Kaggle notebook, if used instead of GitHub: `<your-public-kaggle-notebook-link>`

### Suggested Short Version
If you need a shorter summary for a form field, use this:

> LocalInspect AI is a local-first multimodal desktop app powered by Gemma 4 through Ollama. It supports photo-based security audits, spatial/structural reasoning, and procedural 3D building generation, with streaming responses, structured fallback behavior, and a live Three.js renderer for generated architecture.

> To run it locally, open a terminal at the project root and use `npm run tauri dev`.
