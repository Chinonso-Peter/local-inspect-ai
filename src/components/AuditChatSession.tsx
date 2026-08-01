import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, DragEvent, KeyboardEvent } from "react";
import ReactMarkdown from "react-markdown";
import {
  AlertTriangle,
  ImagePlus,
  Paperclip,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { readImagePathAsBase64, sendChatMessage } from "../lib/ollamaApi";
import type { ChatMessage } from "../types/chat";

interface AttachmentDraft {
  id: string;
  file: File;
  previewUrl: string;
  label: string;
  sizeLabel: string;
}

interface AuditChatSessionProps {
  imagePath: string;
}

const INITIAL_AUDIT_PROMPT =
  "Perform a complete physical security and safety audit of this facility photo.";

export default function AuditChatSession({ imagePath }: AuditChatSessionProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<AttachmentDraft[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [sessionStatus, setSessionStatus] = useState("Preparing initial scan");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const endOfThreadRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;

    const startInitialScan = async () => {
      // Each new image starts a fresh audit thread so the assistant stays anchored to the current asset.
      setErrorMessage("");
      setSessionStatus("Loading image");
      clearAttachmentDrafts();
      setMessages([]);
      setDraft("");
      setIsStreaming(true);

      try {
        const rawBase64 = await readImagePathAsBase64(imagePath);
        if (cancelled) {
          return;
        }

        const userMessage: ChatMessage = {
          id: createId(),
          role: "user",
          content: INITIAL_AUDIT_PROMPT,
          images: [rawBase64],
          timestamp: Date.now(),
        };

        const assistantMessageId = createId();
        let assistantText = "";

        setMessages([
          userMessage,
          {
            id: assistantMessageId,
            role: "assistant",
            content: "",
            timestamp: Date.now(),
          },
        ]);

        await sendChatMessage({
          messages: [userMessage],
          onChunk: (chunk) => {
            assistantText += chunk;
            setMessages((current) =>
              current.map((message) =>
                message.id === assistantMessageId ? { ...message, content: assistantText } : message,
              ),
            );
          },
          onError: (err) => {
            if (!cancelled) {
              setErrorMessage(err);
            }
          },
        });

        if (!cancelled) {
          setSessionStatus("Initial scan complete");
        }
      } catch (err: any) {
        if (!cancelled) {
          const detail = typeof err === "string" ? err : err?.message || String(err);
          setErrorMessage(detail);
          setSessionStatus("Scan failed");
          setMessages([
            {
              id: createId(),
              role: "user",
              content: INITIAL_AUDIT_PROMPT,
              timestamp: Date.now(),
            },
          ]);
        }
      } finally {
        if (!cancelled) {
          setIsStreaming(false);
        }
      }
    };

    startInitialScan();

    return () => {
      cancelled = true;
    };
  }, [imagePath]);

  useEffect(() => {
    endOfThreadRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, isStreaming]);

  useEffect(() => {
    return () => {
      clearAttachmentDrafts();
    };
  }, []);

  const hasThread = messages.length > 0;

  const handleFileSelect = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";
    await addAttachments(files);
  };

  const handleDrop = async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (isStreaming) {
      return;
    }

    const files = Array.from(event.dataTransfer.files ?? []);
    await addAttachments(files);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
  };

  const handleSend = async () => {
    if (isStreaming) {
      return;
    }

    const attachmentCount = attachments.length;
    const userText = draft.trim();
    if (!userText && attachmentCount === 0) {
      return;
    }

    setIsStreaming(true);
    setErrorMessage("");
    setSessionStatus("Waiting for model");

    try {
      // Attachments are converted here so follow-up questions can include fresh visual evidence.
      const imagePayloads = await Promise.all(attachments.map((attachment) => fileToBase64(attachment.file)));
      const userMessage: ChatMessage = {
        id: createId(),
        role: "user",
        content:
          userText ||
          (imagePayloads.length > 0
            ? "Please review this remediation photo and tell me whether the fix looks complete."
            : ""),
        images: imagePayloads.length > 0 ? imagePayloads : undefined,
        timestamp: Date.now(),
      };
      const assistantMessageId = createId();
      const requestMessages = [...messages, userMessage];
      let assistantText = "";

      setMessages([
        ...messages,
        userMessage,
        {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          timestamp: Date.now(),
        },
      ]);
      setDraft("");
      clearAttachmentDrafts();

      await sendChatMessage({
        messages: requestMessages,
        onChunk: (chunk) => {
          assistantText += chunk;
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantMessageId ? { ...message, content: assistantText } : message,
            ),
          );
        },
        onError: (err) => {
          setErrorMessage(err);
        },
      });

      setSessionStatus("Ready");
    } catch (err: any) {
      const detail = typeof err === "string" ? err : err?.message || String(err);
      setErrorMessage(detail);
      setSessionStatus("Follow-up failed");
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((current) => {
      const next = current.filter((attachment) => attachment.id !== id);
      const removed = current.find((attachment) => attachment.id === id);
      if (removed) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return next;
    });
  };

  async function addAttachments(files: File[]) {
    const imageFiles = files.filter(
      (file) => file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name),
    );

    if (imageFiles.length === 0) {
      return;
    }

    const newDrafts = imageFiles.map((file) => ({
      id: createId(),
      file,
      previewUrl: URL.createObjectURL(file),
      label: file.name,
      sizeLabel: formatFileSize(file.size),
    }));

    setAttachments((current) => [...current, ...newDrafts]);
  }

  function clearAttachmentDrafts() {
    setAttachments((current) => {
      current.forEach((attachment) => URL.revokeObjectURL(attachment.previewUrl));
      return [];
    });
  }

  return (
    <section className="chat-session" aria-label="Audit chat session">
      <div className="chat-session-header">
        <div>
          <span className="eyebrow">
            <Sparkles size={14} />
            Multi-turn audit session
          </span>
          <h2>Discussion, remediation, and verification in one thread</h2>
          <p>
            Ask follow-up questions, attach new remediation photos, and keep the original scan
            in context while the model responds locally through Ollama.
          </p>
        </div>

        <div className={`status-pill status-${errorMessage ? "danger" : isStreaming ? "warning" : "success"}`}>
          {errorMessage ? "Needs attention" : isStreaming ? sessionStatus : sessionStatus}
        </div>
      </div>

      <div className="chat-session-topline">
        <div className="chat-session-note">
          <ShieldCheck size={16} />
          <span>Initial scan source</span>
        </div>
        <div className="chat-session-path">{imagePath}</div>
      </div>

      {errorMessage ? (
        <div className="error-callout chat-error">
          <strong>
            <AlertTriangle size={16} />
            Session error
          </strong>
          <p>{errorMessage}</p>
        </div>
      ) : null}

      <div className="chat-thread">
        {hasThread ? (
          messages.map((message) => (
            <article
              key={message.id}
              className={`chat-message ${message.role === "user" ? "user" : "assistant"}`}
            >
              <div className="message-meta">
                <span className="message-role">
                  {message.role === "user" ? "You" : "LocalInspect AI"}
                </span>
                <span className="message-time">{formatTimestamp(message.timestamp)}</span>
              </div>

              <div className="message-bubble">
                {message.role === "assistant" ? (
                  <ReactMarkdown
                    components={{
                      h1: ({ children }) => <h3>{children}</h3>,
                      h2: ({ children }) => <h3>{children}</h3>,
                      h3: ({ children }) => <h4>{children}</h4>,
                      p: ({ children }) => <p>{children}</p>,
                      ul: ({ children }) => <ul>{children}</ul>,
                      ol: ({ children }) => <ol>{children}</ol>,
                      li: ({ children }) => <li>{children}</li>,
                      strong: ({ children }) => <strong>{children}</strong>,
                      blockquote: ({ children }) => <blockquote>{children}</blockquote>,
                      code: ({ children }) => <code>{children}</code>,
                    }}
                  >
                    {message.content || (isStreaming ? "Scanning the image..." : "")}
                  </ReactMarkdown>
                ) : (
                  <p>{message.content}</p>
                )}

                {message.images?.length ? (
                  <div className="message-image-grid">
                    {message.images.map((image, index) => (
                      <figure className="message-image-card" key={`${message.id}-${index}`}>
                        <img src={resolveBase64ImageSource(image)} alt={`Attached remediation ${index + 1}`} />
                        <span className="image-badge">Remediation Check</span>
                      </figure>
                    ))}
                  </div>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state chat-empty">
            <div className="empty-state-title">Starting your first scan</div>
            <p>We are preparing the initial audit thread and streaming the first findings now.</p>
          </div>
        )}
        <div ref={endOfThreadRef} />
      </div>

      {attachments.length > 0 ? (
        <div className="attachment-strip" aria-label="Attached remediation photos">
          {attachments.map((attachment) => (
            <div className="attachment-chip" key={attachment.id}>
              <div className="attachment-preview">
                <img src={attachment.previewUrl} alt={attachment.label} />
                <span className="image-badge">Remediation Check</span>
              </div>
              <div className="attachment-copy">
                <strong>{attachment.label}</strong>
                <span>{attachment.sizeLabel}</span>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => removeAttachment(attachment.id)}
                aria-label={`Remove ${attachment.label}`}
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="chat-composer-shell" onDrop={handleDrop} onDragOver={handleDragOver}>
        <div className="chat-composer-hint">
          <Paperclip size={15} />
          <span>Drop a remediation photo anywhere here or attach files with the button below.</span>
        </div>

        <textarea
          className="chat-composer"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a follow-up, discuss a remediation step, or ask the model to verify a fix..."
          rows={4}
          disabled={isStreaming}
        />

        <div className="chat-composer-actions">
          <div className="chat-composer-left">
            <button
              type="button"
              className="action-button secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming}
            >
              <ImagePlus size={16} />
              <span>Attach Remediation Photo</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              hidden
            />
          </div>

          <button
            type="button"
            className="action-button primary"
            onClick={() => void handleSend()}
            disabled={isStreaming || (!draft.trim() && attachments.length === 0)}
          >
            <Send size={16} />
            <span>{isStreaming ? "Thinking..." : "Send"}</span>
          </button>
        </div>
      </div>
    </section>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.includes(",") ? result.split(",").pop() ?? "" : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error(`Unable to read ${file.name} as an image attachment.`));
    reader.readAsDataURL(file);
  });
}

function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function createId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function resolveBase64ImageSource(base64: string): string {
  const mime = detectImageMimeType(base64);
  return `data:${mime};base64,${base64}`;
}

function detectImageMimeType(base64: string): string {
  if (base64.startsWith("iVBORw0KGgo")) {
    return "image/png";
  }

  if (base64.startsWith("/9j/")) {
    return "image/jpeg";
  }

  if (base64.startsWith("UklGR")) {
    return "image/webp";
  }

  if (base64.startsWith("R0lGOD")) {
    return "image/gif";
  }

  if (base64.startsWith("Qk")) {
    return "image/bmp";
  }

  return "image/jpeg";
}
