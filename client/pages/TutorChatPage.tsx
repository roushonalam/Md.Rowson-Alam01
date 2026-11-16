import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Calendar,
  Loader2,
  MessageSquareText,
  RotateCcw,
  Send,
  Trash2,
} from 'lucide-react';
import { MarkdownMath } from '../components/MarkdownMath.tsx';
import { useSettings } from '../hooks/useSettings.tsx';
import {
  ClientApiError,
  requestStudyPlan,
  streamTutorChat,
} from '../lib/api.ts';
import {
  clearTutorHistory,
  loadTutorHistory,
  saveTutorHistory,
} from '../lib/storage.ts';
import type { StudyPlanResponse, TutorMessage } from '../types/index.ts';

const QUICK_PROMPTS = [
  'Explain a difficult topic.',
  'Check my paragraph.',
  'Give me a mathematics formula.',
  'Help me prepare for IELTS.',
  'Create a study routine.',
];

function isStudyRoutinePrompt(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes('study routine') ||
    lower.includes('study plan') ||
    lower.includes('weekly routine') ||
    lower.includes('রুটিন')
  );
}

function StudyPlanCard({ plan }: { plan: StudyPlanResponse }) {
  return (
    <div className="mt-3 rounded-2xl border border-border-subtle bg-canvas p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-indigo">
            <Calendar className="h-3.5 w-3.5" />
            <span>Weekly Study Routine</span>
          </div>
          <h3 className="mt-1 font-display text-base font-bold text-primary-dark">
            {plan.title}
          </h3>
          <p className="mt-1 text-xs text-text-secondary leading-relaxed">
            {plan.goalSummary}
          </p>
        </div>
        <span className="text-xs font-semibold text-primary-dark tabular-nums">
          {plan.weeklyHours} hrs / week
        </span>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {plan.days.map((d) => (
          <div
            key={d.day}
            className="rounded-xl border border-border-subtle bg-surface p-3.5"
          >
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-bold text-primary-dark">{d.day}</span>
              <span className="text-text-muted tabular-nums">{d.durationMinutes} min</span>
            </div>
            <p className="mt-1 text-xs font-semibold text-brand-indigo">{d.focusSubject}</p>
            <ul className="mt-1.5 list-disc pl-4 text-xs text-text-secondary space-y-0.5">
              {d.topics.map((t, idx) => (
                <li key={idx}>{t}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-text-muted">{d.activity}</p>
          </div>
        ))}
      </div>

      {plan.tips.length > 0 && (
        <div className="border-t border-border-subtle pt-3">
          <p className="text-xs font-semibold text-primary-dark">Study Tips</p>
          <ul className="mt-1.5 list-disc pl-4 text-xs text-text-secondary space-y-1">
            {plan.tips.map((tip, i) => (
              <li key={i}>{tip}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function TutorChatPage() {
  const { settings, addToast } = useSettings();
  const [searchParams, setSearchParams] = useSearchParams();

  const [messages, setMessages] = useState<TutorMessage[]>(() => loadTutorHistory());
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const autoSentRef = useRef(false);

  useEffect(() => {
    saveTutorHistory(messages);
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  async function sendMessage(rawText: string, options?: { forceStudyPlan?: boolean }) {
    const trimmed = rawText.trim();
    if (!trimmed || isStreaming) return;

    const historyForRequest = messages
      .filter((m) => !m.error && m.content.trim().length > 0)
      .slice(-12)
      .map((m) => ({ role: m.role, content: m.content }));

    const userMsg: TutorMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: trimmed,
      createdAt: new Date().toISOString(),
    };

    const assistantId = `a_${Date.now() + 1}`;
    const placeholderAssistant: TutorMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg, placeholderAssistant]);
    setInput('');
    setIsStreaming(true);

    const wantsPlan = options?.forceStudyPlan || isStudyRoutinePrompt(trimmed);

    if (wantsPlan) {
      try {
        const plan = await requestStudyPlan({
          goal: trimmed,
          language: 'both',
          model: settings.model || undefined,
          temperature: settings.temperature,
        });

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  content: `Here is your structured 7-day study routine for **${trimmed}**:`,
                  studyPlan: plan,
                }
              : m
          )
        );
      } catch (err) {
        const errPayload =
          err instanceof ClientApiError
            ? {
                messageEn: err.messageEn,
                messageBn: err.messageBn,
                retryPrompt: trimmed,
              }
            : {
                messageEn: 'Failed to create study routine. Please retry.',
                messageBn: 'স্টাডি রুটিন তৈরি করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
                retryPrompt: trimmed,
              };

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: '', error: errPayload } : m
          )
        );
      } finally {
        setIsStreaming(false);
      }
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamTutorChat(
        {
          message: trimmed,
          history: historyForRequest,
          model: settings.model || undefined,
          temperature: settings.temperature,
        },
        {
          onChunk: (chunkText) => {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: m.content + chunkText }
                  : m
              )
            );
          },
          onDone: () => {
            // Stream finalized cleanly
          },
        },
        controller.signal
      );
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      const errPayload =
        err instanceof ClientApiError
          ? {
              messageEn: err.messageEn,
              messageBn: err.messageBn,
              retryPrompt: trimmed,
            }
          : {
              messageEn: 'Unable to reach AI Tutor right now. Please retry.',
              messageBn: 'এই মুহূর্তে AI টিউটরের সাথে সংযোগ করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
              retryPrompt: trimmed,
            };

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId ? { ...m, error: errPayload } : m
        )
      );
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
    }
  }

  // Handle ?q=...&autoSend=1 from Landing page
  useEffect(() => {
    if (autoSentRef.current) return;
    const q = searchParams.get('q')?.trim();
    const autoSend = searchParams.get('autoSend');
    if (q) {
      autoSentRef.current = true;
      setSearchParams({}, { replace: true });
      if (autoSend === '1') {
        void sendMessage(q);
      } else {
        setInput(q);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    void sendMessage(input);
  }

  function handleQuickPrompt(prompt: string) {
    if (prompt === 'Create a study routine.') {
      void sendMessage(
        'Create a balanced 7-day study routine for HSC Science & Mathematics preparation.',
        { forceStudyPlan: true }
      );
      return;
    }
    if (prompt === 'Check my paragraph.') {
      setInput('Please check my paragraph for grammar, clarity, and structure:\n\n');
      return;
    }
    if (prompt === 'Explain a difficult topic.') {
      setInput('Explain this topic simply in Bengali and English: ');
      return;
    }
    void sendMessage(prompt);
  }

  function handleRetryMessage(failedMsgId: string, promptText: string) {
    setMessages((prev) => prev.filter((m) => m.id !== failedMsgId));
    void sendMessage(promptText);
  }

  function confirmClearConversation() {
    abortRef.current?.abort();
    setMessages([]);
    clearTutorHistory();
    setConfirmClearOpen(false);
    addToast({ variant: 'info', title: 'Conversation cleared' });
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-primary-dark sm:text-3xl">
            Live AI Tutor
          </h1>
          <p className="mt-1 text-sm text-text-secondary">
            Step-by-step guidance in Bengali and English, plus structured weekly study routines.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setConfirmClearOpen(true)}
          disabled={messages.length === 0 && !isStreaming}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-border-strong bg-surface px-3.5 py-2 text-xs font-semibold text-text-secondary hover:bg-surface-muted hover:text-error disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear Conversation
        </button>
      </div>

      {/* Quick Prompts */}
      <div className="mb-4 flex flex-wrap gap-2">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={isStreaming}
            onClick={() => handleQuickPrompt(prompt)}
            className="min-h-[36px] rounded-xl border border-border-subtle bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:border-brand-indigo/40 hover:text-primary-dark disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Chat Viewport */}
      <div className="flex min-h-[460px] flex-1 flex-col justify-between rounded-2xl border border-border-subtle bg-surface shadow-sm">
        <div className="max-h-[560px] flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
          {messages.length === 0 && (
            <div className="flex h-full min-h-[320px] flex-col items-center justify-center text-center px-4">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-indigo/10 text-brand-indigo">
                <MessageSquareText className="h-6 w-6" />
              </div>
              <h2 className="mt-4 font-display text-lg font-bold text-primary-dark">
                Start Learning with EduGenius Tutor
              </h2>
              <p className="mt-2 max-w-md text-sm text-text-secondary leading-relaxed">
                Ask any academic question in Bengali or English. Your tutor explains concepts
                with definitions, analogies, examples, and understanding checks.
              </p>
              <p className="mt-1.5 font-bengali text-sm text-text-muted">
                যেকোনো প্রশ্ন করুন বা উপরের দ্রুত প্রম্পট থেকে একটি বেছে নিন।
              </p>
            </div>
          )}

          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            const showTypingIndicator =
              !isUser && !msg.content && !msg.error && !msg.studyPlan && isStreaming;

            return (
              <div
                key={msg.id}
                className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[90%] sm:max-w-[80%] rounded-2xl px-4 py-3.5 ${
                    isUser
                      ? 'bg-primary-dark text-white'
                      : 'border border-border-subtle bg-canvas text-text-primary'
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                  ) : showTypingIndicator ? (
                    <div className="flex items-center gap-2 text-xs text-text-muted py-1">
                      <Loader2 className="h-4 w-4 animate-spin text-brand-indigo" />
                      <span>EduGenius AI is thinking...</span>
                    </div>
                  ) : msg.error ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-error">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>Tutor response interrupted</span>
                      </div>
                      <p className="text-sm text-text-primary">{msg.error.messageEn}</p>
                      <p className="font-bengali text-xs text-text-secondary">
                        {msg.error.messageBn}
                      </p>
                      {msg.error.retryPrompt && (
                        <button
                          type="button"
                          onClick={() =>
                            handleRetryMessage(msg.id, msg.error?.retryPrompt ?? '')
                          }
                          className="mt-1 inline-flex min-h-[36px] items-center gap-1.5 rounded-xl bg-error px-3 py-1.5 text-xs font-semibold text-white hover:bg-error/90"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Retry
                        </button>
                      )}
                    </div>
                  ) : (
                    <div>
                      <MarkdownMath content={msg.content} />
                      {msg.studyPlan && <StudyPlanCard plan={msg.studyPlan} />}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Message Input Composer */}
        <form
          onSubmit={handleFormSubmit}
          className="border-t border-border-subtle bg-canvas p-3 sm:p-4 rounded-b-2xl"
        >
          <div className="flex items-end gap-3">
            <label htmlFor="tutor-message-input" className="sr-only">
              Write your question for EduGenius AI Tutor
            </label>
            <textarea
              id="tutor-message-input"
              rows={2}
              maxLength={2000}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage(input);
                }
              }}
              placeholder="Ask in English or বাংলা (Press Enter to send, Shift+Enter for new line)..."
              className="flex-1 resize-none rounded-xl border border-border-strong bg-surface p-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-indigo focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              aria-label="Send message"
              className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-brand-indigo px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50 shrink-0"
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Send</span>
            </button>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-text-muted">
            <span>Chat text is saved locally in your browser.</span>
            <span className="tabular-nums">{input.length} / 2000</span>
          </div>
        </form>
      </div>

      {/* Confirm Clear Dialog */}
      {confirmClearOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="clear-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-primary-dark/45 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl border border-border-subtle bg-surface p-6 shadow-xl">
            <h2
              id="clear-dialog-title"
              className="font-display text-lg font-bold text-primary-dark"
            >
              Clear Conversation History?
            </h2>
            <p className="mt-2 text-sm text-text-secondary leading-relaxed">
              This will permanently remove all messages from this browser session. You can start
              a fresh conversation immediately.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirmClearOpen(false)}
                className="min-h-[40px] rounded-xl border border-border-strong bg-surface px-4 py-2 text-sm font-semibold text-text-primary hover:bg-surface-muted"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmClearConversation}
                className="min-h-[40px] rounded-xl bg-error px-4 py-2 text-sm font-semibold text-white hover:bg-error/90"
              >
                Clear Chat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
