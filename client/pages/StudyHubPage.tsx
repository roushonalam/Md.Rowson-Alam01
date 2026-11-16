import { useState, type FormEvent } from 'react';
import {
  BookOpen,
  Check,
  Copy,
  Download,
  Lightbulb,
  ListChecks,
  RotateCw,
  Sparkles,
} from 'lucide-react';
import { BilingualErrorCard } from '../components/BilingualErrorCard.tsx';
import { MarkdownMath } from '../components/MarkdownMath.tsx';
import { StudyHubSkeleton } from '../components/Skeletons.tsx';
import { useSettings } from '../hooks/useSettings.tsx';
import { ClientApiError, requestExplanation } from '../lib/api.ts';
import type {
  OutputLanguage,
  StudyExplanationResponse,
  StudyLevel,
  StudyStyle,
  StudySubject,
} from '../types/index.ts';

const SUBJECTS: StudySubject[] = [
  'Science',
  'Mathematics',
  'English',
  'General Knowledge',
  'Programming',
];

const LEVELS: StudyLevel[] = [
  'Beginner',
  'SSC',
  'HSC',
  'University',
  'Job Preparation',
];

const STYLES: StudyStyle[] = [
  'Short Summary',
  'Detailed Explanation',
  'Flashcard Points',
];

const LANGUAGES: Array<{ value: OutputLanguage; label: string }> = [
  { value: 'both', label: 'Both (EN + বাংলা)' },
  { value: 'bengali', label: 'Bengali (বাংলা)' },
  { value: 'english', label: 'English' },
];

const SAMPLE_TOPICS = [
  { label: 'Photosynthesis (SSC)', subject: 'Science' as StudySubject, level: 'SSC' as StudyLevel, topic: 'Photosynthesis light and dark reactions' },
  { label: 'Quadratic Formula (HSC)', subject: 'Mathematics' as StudySubject, level: 'HSC' as StudyLevel, topic: 'Derivation and discriminant of quadratic equations' },
  { label: 'নিউটনের গতিসূত্র', subject: 'Science' as StudySubject, level: 'SSC' as StudyLevel, topic: 'নিউটনের গতির তিনটি সূত্র ও বাস্তব উদাহরণ' },
  { label: 'Async/Await in JS', subject: 'Programming' as StudySubject, level: 'University' as StudyLevel, topic: 'JavaScript Promises and async/await error handling' },
];

function buildMarkdownDocument(data: StudyExplanationResponse): string {
  const lines: string[] = [
    `# ${data.title}`,
    `Subject: ${data.subject} | Level: ${data.level} | Style: ${data.style}`,
    '',
    '## Simple Explanation',
    data.simpleExplanation,
    '',
    '## Concept Definition',
    data.conceptDefinition,
    '',
    '## Real-world Analogy',
    data.realWorldAnalogy,
    '',
    '## Practical Examples',
    ...data.practicalExamples.map((ex, i) => `${i + 1}. ${ex}`),
    '',
    '## Important Points',
    ...data.importantPoints.map((pt) => `- ${pt}`),
    '',
    '## Summary',
    data.summary,
  ];

  if (data.flashcards && data.flashcards.length > 0) {
    lines.push('', '## Flashcards');
    data.flashcards.forEach((fc, idx) => {
      lines.push(`### Card ${idx + 1}: ${fc.front}`, `Answer: ${fc.back}`);
      if (fc.hint) lines.push(`Hint: ${fc.hint}`);
      lines.push('');
    });
  }

  return lines.join('\n');
}

function buildPlainTextDocument(data: StudyExplanationResponse): string {
  return buildMarkdownDocument(data)
    .replace(/^#{1,3}\s+/gm, '')
    .replace(/\*\*(.*?)\*\*/g, '$1');
}

export function StudyHubPage() {
  const { settings, addToast } = useSettings();

  const [subject, setSubject] = useState<StudySubject>('Science');
  const [level, setLevel] = useState<StudyLevel>('HSC');
  const [style, setStyle] = useState<StudyStyle>('Detailed Explanation');
  const [language, setLanguage] = useState<OutputLanguage>('both');
  const [topic, setTopic] = useState('');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StudyExplanationResponse | null>(null);
  const [error, setError] = useState<{
    code?: string;
    messageEn: string;
    messageBn: string;
    retryAfterSeconds?: number;
  } | null>(null);

  const [copied, setCopied] = useState(false);
  const [flippedIds, setFlippedIds] = useState<Set<string>>(new Set());

  async function runExplain() {
    const trimmed = topic.trim();
    if (trimmed.length < 2) {
      setError({
        code: 'VALIDATION_ERROR',
        messageEn: 'Please enter a topic of at least 2 characters.',
        messageBn: 'অনুগ্রহ করে কমপক্ষে ২ অক্ষরের একটি বিষয় লিখুন।',
      });
      return;
    }

    setLoading(true);
    setError(null);
    setFlippedIds(new Set());

    try {
      const data = await requestExplanation({
        subject,
        level,
        style,
        language,
        topic: trimmed,
        model: settings.model || undefined,
        temperature: settings.temperature,
      });
      setResult(data);
    } catch (err) {
      if (err instanceof ClientApiError) {
        setError({
          code: err.code,
          messageEn: err.messageEn,
          messageBn: err.messageBn,
          retryAfterSeconds: err.retryAfterSeconds,
        });
      } else {
        setError({
          messageEn: 'Could not generate study guide. Please try again.',
          messageBn: 'স্টাডি গাইড তৈরি করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
        });
      }
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    void runExplain();
  }

  async function handleCopy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(buildMarkdownDocument(result));
      setCopied(true);
      addToast({ variant: 'success', title: 'Notes copied to clipboard' });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      addToast({
        variant: 'error',
        title: 'Copy failed',
        description: 'Browser clipboard access was denied.',
      });
    }
  }

  function handleDownload(ext: 'md' | 'txt') {
    if (!result) return;
    const content =
      ext === 'md' ? buildMarkdownDocument(result) : buildPlainTextDocument(result);
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const slug = result.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'edugenius-notes';

    const a = document.createElement('a');
    a.href = url;
    a.download = `${slug}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    addToast({
      variant: 'success',
      title: `Downloaded .${ext} notes`,
    });
  }

  function toggleCard(id: string) {
    setFlippedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function flipAllCards() {
    if (!result?.flashcards) return;
    if (flippedIds.size === result.flashcards.length) {
      setFlippedIds(new Set());
    } else {
      setFlippedIds(new Set(result.flashcards.map((c) => c.id)));
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold tracking-tight text-primary-dark sm:text-3xl">
          AI Study Hub
        </h1>
        <p className="mt-1.5 text-sm text-text-secondary sm:text-base">
          Generate structured concept guides, mathematical breakdowns, and interactive flashcards in
          Bengali, English, or both.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
        {/* Left Control Panel */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm lg:col-span-4 space-y-5"
        >
          <div>
            <label
              htmlFor="study-subject"
              className="block text-xs font-semibold text-text-secondary"
            >
              Subject
            </label>
            <select
              id="study-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value as StudySubject)}
              className="mt-1.5 w-full min-h-[42px] rounded-xl border border-border-strong bg-surface px-3 text-sm text-text-primary focus:border-brand-indigo focus:outline-none"
            >
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="study-level"
              className="block text-xs font-semibold text-text-secondary"
            >
              Academic Level
            </label>
            <select
              id="study-level"
              value={level}
              onChange={(e) => setLevel(e.target.value as StudyLevel)}
              className="mt-1.5 w-full min-h-[42px] rounded-xl border border-border-strong bg-surface px-3 text-sm text-text-primary focus:border-brand-indigo focus:outline-none"
            >
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="block text-xs font-semibold text-text-secondary">
              Study Style
            </span>
            <div className="mt-1.5 grid grid-cols-1 gap-1.5">
              {STYLES.map((item) => {
                const active = style === item;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setStyle(item)}
                    className={`min-h-[40px] rounded-xl border px-3.5 py-2 text-left text-sm font-medium transition-colors ${
                      active
                        ? 'border-brand-indigo bg-brand-indigo/10 text-brand-indigo font-semibold'
                        : 'border-border-subtle bg-canvas text-text-secondary hover:bg-surface-muted hover:text-text-primary'
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <span className="block text-xs font-semibold text-text-secondary">
              Output Language
            </span>
            <div
              role="group"
              aria-label="Output language"
              className="mt-1.5 grid grid-cols-3 gap-1.5 rounded-xl bg-surface-muted p-1"
            >
              {LANGUAGES.map((lang) => {
                const active = language === lang.value;
                return (
                  <button
                    key={lang.value}
                    type="button"
                    onClick={() => setLanguage(lang.value)}
                    className={`min-h-[38px] rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                      active
                        ? 'bg-surface text-primary-dark shadow-sm font-semibold'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    {lang.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="study-topic"
                className="block text-xs font-semibold text-text-secondary"
              >
                Topic or Concept
              </label>
              <span className="text-xs text-text-muted tabular-nums">
                {topic.length} / 1000
              </span>
            </div>
            <textarea
              id="study-topic"
              rows={4}
              maxLength={1000}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Explain Doppler Effect with formulas and everyday examples..."
              className="mt-1.5 w-full rounded-xl border border-border-strong bg-surface p-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-indigo focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-brand-indigo px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            {loading ? 'Generating Notes...' : 'Generate Study Guide'}
          </button>

          <div className="border-t border-border-subtle pt-4">
            <p className="text-xs font-medium text-text-muted">Quick sample topics:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SAMPLE_TOPICS.map((sample) => (
                <button
                  key={sample.label}
                  type="button"
                  onClick={() => {
                    setSubject(sample.subject);
                    setLevel(sample.level);
                    setTopic(sample.topic);
                  }}
                  className="rounded-lg border border-border-subtle bg-canvas px-2.5 py-1.5 text-xs text-text-secondary hover:border-brand-indigo/40 hover:text-primary-dark"
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </div>
        </form>

        {/* Right Output Area */}
        <div className="lg:col-span-8 space-y-6">
          {error && (
            <BilingualErrorCard
              code={error.code}
              messageEn={error.messageEn}
              messageBn={error.messageBn}
              retryAfterSeconds={error.retryAfterSeconds}
              onRetry={() => void runExplain()}
            />
          )}

          {loading && <StudyHubSkeleton />}

          {!loading && !result && !error && (
            <div className="rounded-2xl border border-border-subtle bg-surface p-10 text-center">
              <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-indigo/10 text-brand-indigo">
                <BookOpen className="h-6 w-6" />
              </div>
              <h2 className="mt-4 font-display text-lg font-bold text-primary-dark">
                Ready to Build Your Study Notes
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm text-text-secondary leading-relaxed">
                Choose your subject, academic level, and output language on the left, then enter
                any chapter or concept to generate structured notes or flashcards.
              </p>
              <p className="mt-2 font-bengali text-sm text-text-muted">
                আপনার বিষয় ও শ্রেণি নির্বাচন করে যেকোনো টপিক লিখুন।
              </p>
            </div>
          )}

          {!loading && result && (
            <div className="space-y-6">
              {/* Result Header & Export Actions */}
              <div className="rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                      <span>{result.subject}</span>
                      <span aria-hidden="true">·</span>
                      <span>{result.level}</span>
                      <span aria-hidden="true">·</span>
                      <span>{result.style}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{result.modelUsed}</span>
                    </div>
                    <h2 className="mt-1.5 font-display text-xl font-bold text-primary-dark sm:text-2xl">
                      {result.title}
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleCopy()}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-border-strong bg-surface px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-surface-muted whitespace-nowrap"
                    >
                      {copied ? (
                        <Check className="h-3.5 w-3.5 text-success-emerald" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload('md')}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-border-strong bg-surface px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-surface-muted whitespace-nowrap"
                    >
                      <Download className="h-3.5 w-3.5" />
                      .md
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload('txt')}
                      className="inline-flex min-h-[38px] items-center gap-1.5 rounded-xl border border-border-strong bg-surface px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-surface-muted whitespace-nowrap"
                    >
                      <Download className="h-3.5 w-3.5" />
                      .txt
                    </button>
                  </div>
                </div>
              </div>

              {/* Flashcards Deck when Flashcard Points style is active */}
              {result.flashcards && result.flashcards.length > 0 && (
                <section aria-label="Interactive Flashcards" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg font-bold text-primary-dark">
                      Interactive Flashcards ({result.flashcards.length})
                    </h3>
                    <button
                      type="button"
                      onClick={flipAllCards}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-border-strong bg-surface px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-surface-muted"
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                      {flippedIds.size === result.flashcards.length ? 'Reset All' : 'Flip All'}
                    </button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    {result.flashcards.map((card, index) => {
                      const isFlipped = flippedIds.has(card.id);
                      return (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => toggleCard(card.id)}
                          aria-pressed={isFlipped}
                          className="flashcard-perspective h-52 w-full text-left focus-visible:outline-2 focus-visible:outline-brand-indigo rounded-2xl"
                        >
                          <div className={`flashcard-inner ${isFlipped ? 'is-flipped' : ''}`}>
                            {/* Front */}
                            <div className="flashcard-face flex flex-col justify-between rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm">
                              <div className="flex items-center justify-between text-xs text-text-muted">
                                <span className="tabular-nums font-medium">
                                  Card {index + 1} · Prompt
                                </span>
                                <span>Click to flip</span>
                              </div>
                              <div className="my-auto font-medium text-primary-dark">
                                <MarkdownMath content={card.front} />
                              </div>
                              {card.hint ? (
                                <p className="text-xs text-text-muted truncate">
                                  Hint: {card.hint}
                                </p>
                              ) : (
                                <span className="text-xs text-brand-indigo font-medium">
                                  Reveal answer
                                </span>
                              )}
                            </div>

                            {/* Back */}
                            <div className="flashcard-face flashcard-back flex flex-col justify-between rounded-2xl border border-brand-indigo/35 bg-primary-dark p-5 text-white shadow-sm">
                              <div className="flex items-center justify-between text-xs text-white/70">
                                <span className="tabular-nums font-medium">
                                  Card {index + 1} · Answer
                                </span>
                                <span>Click to flip back</span>
                              </div>
                              <div className="my-auto overflow-y-auto text-sm text-white [&_.edugenius-prose]:text-white">
                                <MarkdownMath content={card.back} />
                              </div>
                              <span className="text-xs text-success-emerald font-medium">
                                Verified key point
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* Six Structured Section Cards */}
              <div className="grid gap-6 md:grid-cols-2">
                <article className="rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm md:col-span-2">
                  <h3 className="font-display text-base font-bold text-primary-dark">
                    Simple Explanation
                  </h3>
                  <div className="mt-3">
                    <MarkdownMath content={result.simpleExplanation} />
                  </div>
                </article>

                <article className="rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm">
                  <h3 className="font-display text-base font-bold text-primary-dark">
                    Concept Definition
                  </h3>
                  <div className="mt-3">
                    <MarkdownMath content={result.conceptDefinition} />
                  </div>
                </article>

                <article className="rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-ai-violet shrink-0" />
                    <h3 className="font-display text-base font-bold text-primary-dark">
                      Real-world Analogy
                    </h3>
                  </div>
                  <div className="mt-3">
                    <MarkdownMath content={result.realWorldAnalogy} />
                  </div>
                </article>

                <article className="rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm">
                  <h3 className="font-display text-base font-bold text-primary-dark">
                    Practical Examples
                  </h3>
                  <ol className="mt-3 space-y-3 list-decimal pl-5 text-sm text-text-primary">
                    {result.practicalExamples.map((example, idx) => (
                      <li key={idx}>
                        <MarkdownMath content={example} />
                      </li>
                    ))}
                  </ol>
                </article>

                <article className="rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm">
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-success-emerald shrink-0" />
                    <h3 className="font-display text-base font-bold text-primary-dark">
                      Important Points
                    </h3>
                  </div>
                  <ul className="mt-3 space-y-2.5 list-disc pl-5 text-sm text-text-primary">
                    {result.importantPoints.map((pt, idx) => (
                      <li key={idx}>
                        <MarkdownMath content={pt} />
                      </li>
                    ))}
                  </ul>
                </article>

                <article className="rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm md:col-span-2">
                  <h3 className="font-display text-base font-bold text-primary-dark">Summary</h3>
                  <div className="mt-3">
                    <MarkdownMath content={result.summary} />
                  </div>
                </article>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
