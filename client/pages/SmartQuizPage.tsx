import { useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Award,
  CheckCircle2,
  HelpCircle,
  PlusCircle,
  RotateCcw,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { BilingualErrorCard } from '../components/BilingualErrorCard.tsx';
import { MarkdownMath } from '../components/MarkdownMath.tsx';
import { QuizQuestionSkeleton } from '../components/Skeletons.tsx';
import { useSettings } from '../hooks/useSettings.tsx';
import {
  ClientApiError,
  requestQuizCheck,
  requestQuizGeneration,
} from '../lib/api.ts';
import type {
  QuizCheckResponse,
  QuizDifficulty,
  QuizGenerateResponse,
  QuizOptionKey,
  QuizReviewRecord,
  StudySubject,
} from '../types/index.ts';

const SUBJECTS: StudySubject[] = [
  'Science',
  'Mathematics',
  'English',
  'General Knowledge',
  'Programming',
];

const DIFFICULTIES: QuizDifficulty[] = ['Easy', 'Medium', 'Hard'];
const OPTION_KEYS: QuizOptionKey[] = ['A', 'B', 'C', 'D'];

export function SmartQuizPage() {
  const { settings } = useSettings();

  // Setup state
  const [subject, setSubject] = useState<StudySubject>('Science');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<QuizDifficulty>('Medium');
  const [count, setCount] = useState<5 | 10>(5);

  // Quiz session state (never stores correctOption until server verifies on submit)
  const [quiz, setQuiz] = useState<QuizGenerateResponse | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<QuizOptionKey | null>(null);
  const [checkedResult, setCheckedResult] = useState<QuizCheckResponse | null>(null);
  const [reviews, setReviews] = useState<QuizReviewRecord[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<{
    code?: string;
    messageEn: string;
    messageBn: string;
    retryAfterSeconds?: number;
  } | null>(null);

  const liveScore = reviews.filter((r) => r.isCorrect).length;
  const currentQuestion = quiz?.questions[currentIndex] ?? null;

  async function startGeneration() {
    const trimmed = topic.trim();
    if (trimmed.length < 2) {
      setError({
        code: 'VALIDATION_ERROR',
        messageEn: 'Please enter a chapter or topic for the quiz.',
        messageBn: 'অনুগ্রহ করে কুইজের জন্য একটি অধ্যায় বা বিষয় লিখুন।',
      });
      return;
    }

    setGenerating(true);
    setError(null);

    try {
      const data = await requestQuizGeneration({
        subject,
        topic: trimmed,
        difficulty,
        count,
        model: settings.model || undefined,
        temperature: settings.temperature,
      });
      setQuiz(data);
      setCurrentIndex(0);
      setSelectedOption(null);
      setCheckedResult(null);
      setReviews([]);
      setIsCompleted(false);
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
          messageEn: 'Failed to generate quiz questions. Please try again.',
          messageBn: 'কুইজের প্রশ্ন তৈরি করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
        });
      }
    } finally {
      setGenerating(false);
    }
  }

  function handleGenerateSubmit(e: FormEvent) {
    e.preventDefault();
    void startGeneration();
  }

  async function handleAnswerSubmit() {
    if (!quiz || !currentQuestion || !selectedOption || checkedResult) return;

    setChecking(true);
    setError(null);

    try {
      const res = await requestQuizCheck({
        quizId: quiz.quizId,
        questionId: currentQuestion.id,
        selectedOption,
      });
      setCheckedResult(res);
      setReviews((prev) => [
        ...prev,
        {
          questionId: currentQuestion.id,
          question: currentQuestion.question,
          options: currentQuestion.options,
          selectedOption: res.selectedOption,
          correctOption: res.correctOption,
          isCorrect: res.isCorrect,
          explanation: res.explanation,
        },
      ]);
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
          messageEn: 'Could not verify your answer. Please retry.',
          messageBn: 'উত্তর যাচাই করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।',
        });
      }
    } finally {
      setChecking(false);
    }
  }

  function handleNextQuestion() {
    if (!quiz) return;
    if (currentIndex + 1 >= quiz.questions.length) {
      setIsCompleted(true);
      return;
    }
    setCurrentIndex((prev) => prev + 1);
    setSelectedOption(null);
    setCheckedResult(null);
  }

  function handleRetrySameQuiz() {
    setCurrentIndex(0);
    setSelectedOption(null);
    setCheckedResult(null);
    setReviews([]);
    setIsCompleted(false);
    setError(null);
  }

  function handleNewQuiz() {
    setQuiz(null);
    setCurrentIndex(0);
    setSelectedOption(null);
    setCheckedResult(null);
    setReviews([]);
    setIsCompleted(false);
    setError(null);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold tracking-tight text-primary-dark sm:text-3xl">
          Smart Quiz Generator
        </h1>
        <p className="mt-1.5 text-sm text-text-secondary sm:text-base">
          Server-verified multiple-choice practice with instant explanations. Correct answers remain
          hidden until you submit each question.
        </p>
      </div>

      {error && (
        <div className="mb-6">
          <BilingualErrorCard
            code={error.code}
            messageEn={error.messageEn}
            messageBn={error.messageBn}
            retryAfterSeconds={error.retryAfterSeconds}
            onRetry={
              quiz && currentQuestion && !checkedResult && selectedOption
                ? () => void handleAnswerSubmit()
                : () => void startGeneration()
            }
          />
        </div>
      )}

      {/* Setup Form */}
      {!quiz && !generating && (
        <form
          onSubmit={handleGenerateSubmit}
          className="rounded-2xl border border-border-subtle bg-surface p-6 sm:p-8 shadow-sm space-y-6"
        >
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <label
                htmlFor="quiz-subject"
                className="block text-xs font-semibold text-text-secondary"
              >
                Subject
              </label>
              <select
                id="quiz-subject"
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
              <span className="block text-xs font-semibold text-text-secondary">
                Difficulty
              </span>
              <div
                role="group"
                aria-label="Quiz difficulty"
                className="mt-1.5 grid grid-cols-3 gap-1.5 rounded-xl bg-surface-muted p-1"
              >
                {DIFFICULTIES.map((d) => {
                  const active = difficulty === d;
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDifficulty(d)}
                      className={`min-h-[36px] rounded-lg px-2 py-1.5 text-xs font-medium transition-colors ${
                        active
                          ? 'bg-surface text-primary-dark shadow-sm font-semibold'
                          : 'text-text-secondary hover:text-text-primary'
                      }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <label
                htmlFor="quiz-topic"
                className="block text-xs font-semibold text-text-secondary"
              >
                Chapter or Topic
              </label>
              <span className="text-xs text-text-muted tabular-nums">{topic.length} / 400</span>
            </div>
            <input
              id="quiz-topic"
              type="text"
              maxLength={400}
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Optics & Lenses, Trigonometry Identities, বা বাংলাদেশের সংবিধান"
              className="mt-1.5 w-full min-h-[44px] rounded-xl border border-border-strong bg-surface px-3.5 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-indigo focus:outline-none"
            />
          </div>

          <div>
            <span className="block text-xs font-semibold text-text-secondary">
              Number of Questions
            </span>
            <div className="mt-1.5 flex gap-3">
              {([5, 10] as const).map((n) => {
                const active = count === n;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCount(n)}
                    className={`min-h-[42px] flex-1 rounded-xl border px-4 py-2 text-sm font-semibold transition-colors tabular-nums ${
                      active
                        ? 'border-brand-indigo bg-brand-indigo/10 text-brand-indigo'
                        : 'border-border-subtle bg-canvas text-text-secondary hover:bg-surface-muted'
                    }`}
                  >
                    {n} Questions
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="submit"
            className="inline-flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-brand-indigo px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
          >
            <Sparkles className="h-4 w-4" />
            Generate Quiz
          </button>
        </form>
      )}

      {/* Loading Skeleton */}
      {generating && <QuizQuestionSkeleton />}

      {/* Active Quiz Question */}
      {quiz && !generating && !isCompleted && currentQuestion && (
        <div className="rounded-2xl border border-border-subtle bg-surface p-6 sm:p-8 shadow-sm">
          {/* Header & Progress Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-text-secondary">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-primary-dark">{quiz.subject}</span>
              <span aria-hidden="true">·</span>
              <span>{quiz.difficulty}</span>
              <span aria-hidden="true">·</span>
              <span className="truncate max-w-[180px] sm:max-w-xs">{quiz.topic}</span>
            </div>
            <div className="flex items-center gap-3 tabular-nums">
              <span className="font-semibold text-primary-dark">
                Question {currentIndex + 1} of {quiz.totalQuestions}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-semibold text-success-emerald">
                Score: {liveScore}
              </span>
            </div>
          </div>

          <div
            role="progressbar"
            aria-valuenow={currentIndex + (checkedResult ? 1 : 0)}
            aria-valuemin={0}
            aria-valuemax={quiz.totalQuestions}
            className="mt-3 h-2 w-full overflow-hidden rounded-full bg-surface-muted"
          >
            <div
              className="h-full rounded-full bg-brand-indigo transition-all duration-300"
              style={{
                width: `${((currentIndex + (checkedResult ? 1 : 0)) / quiz.totalQuestions) * 100}%`,
              }}
            />
          </div>

          {/* Question Stem */}
          <div className="mt-6 text-base font-semibold text-primary-dark sm:text-lg">
            <MarkdownMath content={currentQuestion.question} />
          </div>

          {/* Options A-D */}
          <div role="radiogroup" aria-label="Quiz options" className="mt-6 space-y-3">
            {OPTION_KEYS.map((key) => {
              const isSelected = selectedOption === key;
              const isVerifiedCorrect = checkedResult?.correctOption === key;
              const isVerifiedWrongChoice =
                checkedResult && !checkedResult.isCorrect && checkedResult.selectedOption === key;

              let cardClasses =
                'border-border-subtle bg-canvas text-text-primary hover:border-brand-indigo/50 hover:bg-surface-muted';
              if (checkedResult) {
                if (isVerifiedCorrect) {
                  cardClasses = 'border-success-emerald bg-success-soft text-text-primary';
                } else if (isVerifiedWrongChoice) {
                  cardClasses = 'border-error bg-error-soft text-text-primary';
                } else {
                  cardClasses = 'border-border-subtle bg-canvas text-text-muted opacity-80';
                }
              } else if (isSelected) {
                cardClasses =
                  'border-brand-indigo bg-brand-indigo/10 text-primary-dark ring-1 ring-brand-indigo';
              }

              return (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  disabled={Boolean(checkedResult) || checking}
                  onClick={() => setSelectedOption(key)}
                  className={`flex min-h-[54px] w-full items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left transition-colors ${cardClasses}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border-strong bg-surface text-xs font-bold text-primary-dark">
                      {key}
                    </span>
                    <div className="text-sm leading-relaxed">
                      <MarkdownMath content={currentQuestion.options[key]} />
                    </div>
                  </div>

                  {isVerifiedCorrect && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-success-emerald shrink-0">
                      <CheckCircle2 className="h-4 w-4" />
                      Correct
                    </span>
                  )}

                  {isVerifiedWrongChoice && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-error shrink-0">
                      <XCircle className="h-4 w-4" />
                      Incorrect
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Feedback & Explanation after Submit */}
          {checkedResult && (
            <div
              className={`mt-6 rounded-2xl border p-5 ${
                checkedResult.isCorrect
                  ? 'border-success-emerald/40 bg-success-soft'
                  : 'border-error/35 bg-error-soft'
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-bold">
                {checkedResult.isCorrect ? (
                  <>
                    <CheckCircle2 className="h-5 w-5 text-success-emerald shrink-0" />
                    <span className="text-success-emerald">
                      Correct! Option {checkedResult.correctOption} is right.
                    </span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5 text-error shrink-0" />
                    <span className="text-error">
                      Incorrect — The correct answer is Option {checkedResult.correctOption}.
                    </span>
                  </>
                )}
              </div>
              <div className="mt-3 text-sm text-text-primary">
                <MarkdownMath content={checkedResult.explanation} />
              </div>
            </div>
          )}

          {/* Action Bar */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-5">
            <button
              type="button"
              onClick={handleNewQuiz}
              className="inline-flex min-h-[40px] items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-primary-dark"
            >
              Change Topic
            </button>

            {!checkedResult ? (
              <button
                type="button"
                disabled={!selectedOption || checking}
                onClick={() => void handleAnswerSubmit()}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-indigo px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {checking ? 'Verifying...' : 'Submit Answer'}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleNextQuestion}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-primary-dark px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-indigo"
              >
                <span>
                  {currentIndex + 1 >= quiz.totalQuestions ? 'View Final Score' : 'Next Question'}
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Final Results Summary */}
      {quiz && isCompleted && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-border-subtle bg-surface p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-brand-indigo">
                  <Award className="h-4 w-4" />
                  <span>Quiz Completed</span>
                </div>
                <h2 className="mt-2 font-display text-2xl font-bold text-primary-dark sm:text-3xl">
                  {liveScore} / {quiz.totalQuestions} Correct
                </h2>
                <p className="mt-1 text-sm text-text-secondary">
                  {quiz.subject} · {quiz.topic} · {quiz.difficulty}
                </p>
                <p className="mt-2 font-bengali text-sm text-text-secondary">
                  {liveScore / quiz.totalQuestions >= 0.8
                    ? 'দারুণ ফলাফল! আপনার প্রস্তুতি বেশ শক্তিশালী।'
                    : 'ভালো চেষ্টা! ভুল প্রশ্নগুলোর ব্যাখ্যা দেখে আবার অনুশীলন করুন।'}
                </p>
              </div>

              <div className="rounded-2xl border border-border-subtle bg-canvas px-6 py-4 text-center">
                <p className="text-xs font-medium text-text-muted">Accuracy</p>
                <p className="mt-1 font-display text-3xl font-extrabold text-primary-dark tabular-nums">
                  {Math.round((liveScore / quiz.totalQuestions) * 100)}%
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3 border-t border-border-subtle pt-5">
              <button
                type="button"
                onClick={handleRetrySameQuiz}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-border-strong bg-surface px-5 py-2.5 text-sm font-semibold text-primary-dark hover:bg-surface-muted"
              >
                <RotateCcw className="h-4 w-4" />
                Retry Quiz
              </button>
              <button
                type="button"
                onClick={handleNewQuiz}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand-indigo px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark"
              >
                <PlusCircle className="h-4 w-4" />
                New Quiz
              </button>
            </div>
          </div>

          {/* Per-Question Review */}
          <div className="space-y-4">
            <h3 className="font-display text-lg font-bold text-primary-dark">
              Question-by-Question Review
            </h3>
            {reviews.map((item, idx) => (
              <div
                key={item.questionId}
                className="rounded-2xl border border-border-subtle bg-surface p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-semibold">
                  <span className="text-text-muted tabular-nums">Question {idx + 1}</span>
                  {item.isCorrect ? (
                    <span className="inline-flex items-center gap-1 text-success-emerald">
                      <CheckCircle2 className="h-4 w-4" />
                      Correct
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-error">
                      <XCircle className="h-4 w-4" />
                      Incorrect
                    </span>
                  )}
                </div>

                <div className="mt-2 font-medium text-primary-dark">
                  <MarkdownMath content={item.question} />
                </div>

                <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
                  <span className="text-text-secondary">
                    Your choice:{' '}
                    <strong className={item.isCorrect ? 'text-success-emerald' : 'text-error'}>
                      {item.selectedOption}. {item.options[item.selectedOption]}
                    </strong>
                  </span>
                  {!item.isCorrect && (
                    <span className="text-text-secondary">
                      Correct answer:{' '}
                      <strong className="text-success-emerald">
                        {item.correctOption}. {item.options[item.correctOption]}
                      </strong>
                    </span>
                  )}
                </div>

                <div className="mt-3 rounded-xl bg-canvas p-3.5 text-xs text-text-secondary">
                  <div className="flex items-center gap-1.5 font-semibold text-primary-dark mb-1">
                    <HelpCircle className="h-3.5 w-3.5 text-brand-indigo" />
                    Explanation
                  </div>
                  <MarkdownMath content={item.explanation} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
