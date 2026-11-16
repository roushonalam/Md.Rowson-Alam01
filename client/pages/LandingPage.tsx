import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight,
  BookOpen,
  CheckSquare,
  MessageSquareText,
  Sparkles,
} from 'lucide-react';
import heroLearningImage from '@/src/assets/images/hero_edugenius_learning_1794629816376.jpg';

const FEATURE_CARDS = [
  {
    title: 'Instant Concept Explainer',
    titleBn: 'সহজ ব্যাখ্যা ও ফ্ল্যাশকার্ড',
    description:
      'Break down Physics, Calculus, Grammar, or Programming into clear definitions, real-world analogies, worked examples, and interactive flashcards.',
    to: '/study-hub',
    actionLabel: 'Open Study Hub',
    icon: BookOpen,
  },
  {
    title: 'Smart AI Quiz Generator',
    titleBn: 'স্মার্ট কুইজ ও তাৎক্ষণিক মূল্যায়ন',
    description:
      'Practice 5 or 10 targeted MCQs by subject and difficulty. Answers are verified securely on the server with step-by-step explanations.',
    to: '/quiz',
    actionLabel: 'Start a Quiz',
    icon: CheckSquare,
  },
  {
    title: '24/7 Personal AI Tutor',
    titleBn: 'বাংলা ও ইংরেজি AI টিউটর',
    description:
      'Chat step by step in Bengali or English, review paragraphs, derive formulas, or generate a balanced 7-day study routine.',
    to: '/tutor',
    actionLabel: 'Ask Live Tutor',
    icon: MessageSquareText,
  },
];

const DEMO_STATS = [
  { value: '50,000+', label: 'Questions Solved', sublabel: 'SSC, HSC & University topics' },
  { value: '10,000+', label: 'Quizzes Generated', sublabel: 'Timed & untimed practice sets' },
  { value: '99.4%', label: 'Satisfaction', sublabel: 'Learner clarity rating' },
];

export function LandingPage() {
  const [question, setQuestion] = useState('');
  const [imageFailed, setImageFailed] = useState(false);
  const navigate = useNavigate();

  function handleAskSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) {
      navigate('/tutor');
      return;
    }
    const params = new URLSearchParams({
      q: trimmed,
      autoSend: '1',
    });
    navigate(`/tutor?${params.toString()}`);
  }

  return (
    <div className="bg-canvas">
      {/* Hero Section */}
      <section className="border-b border-border-subtle bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16 lg:px-8 lg:py-20">
          <div className="grid items-stretch gap-10 lg:grid-cols-12 lg:gap-12">
            {/* Left Column: Headline + Interactive Ask Input */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="flex flex-col justify-center lg:col-span-7"
            >
              <p className="text-sm font-semibold text-brand-indigo">
                Apex Edutech Labs Inc. · Class 9–12, SSC/HSC, University &amp; Job Prep
              </p>

              <h1 className="mt-3 text-balance font-display text-4xl font-extrabold tracking-tight text-primary-dark sm:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
                Learn Smarter. Understand Faster. Grow Further.
              </h1>

              <p className="mt-4 font-bengali text-lg font-medium text-text-secondary sm:text-xl leading-relaxed">
                AI-এর সাহায্যে কঠিন বিষয় শিখুন সহজে, নিজের গতিতে।
              </p>

              <p className="mt-3 max-w-2xl text-base text-text-secondary leading-relaxed">
                Master complex concepts in Bengali and English with structured explanations,
                server-verified quizzes, and a step-by-step AI mentor built for focused study.
              </p>

              <form onSubmit={handleAskSubmit} className="mt-7 max-w-2xl">
                <label htmlFor="hero-ask-input" className="sr-only">
                  Ask EduGenius AI any study question
                </label>
                <div className="flex flex-col gap-3 rounded-2xl border border-border-strong bg-canvas p-2 shadow-sm sm:flex-row sm:items-center">
                  <input
                    id="hero-ask-input"
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    maxLength={500}
                    placeholder="Ask anything — e.g. নিউটনের দ্বিতীয় সূত্র ব্যাখ্যা করো or Explain quadratic roots"
                    className="min-h-[46px] flex-1 bg-transparent px-3.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none"
                  />
                  <button
                    type="submit"
                    className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-brand-indigo px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary-dark whitespace-nowrap shrink-0"
                  >
                    <Sparkles className="h-4 w-4" />
                    Ask AI
                  </button>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-text-muted">
                  <span>Try asking:</span>
                  <button
                    type="button"
                    onClick={() =>
                      setQuestion('সালোকসংশ্লেষণ প্রক্রিয়া সহজভাবে বুঝিয়ে দাও।')
                    }
                    className="underline decoration-border-strong underline-offset-4 hover:text-primary-dark"
                  >
                    সালোকসংশ্লেষণ প্রক্রিয়া
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuestion('Derive the quadratic formula step by step.')}
                    className="underline decoration-border-strong underline-offset-4 hover:text-primary-dark"
                  >
                    Quadratic formula derivation
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuestion('Create an HSC Physics weekly study routine.')}
                    className="underline decoration-border-strong underline-offset-4 hover:text-primary-dark"
                  >
                    HSC Physics routine
                  </button>
                </div>
              </form>
            </motion.div>

            {/* Right Column: Editorial Learning Visual */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.05 }}
              className="lg:col-span-5"
            >
              <div className="relative h-full min-h-[260px] overflow-hidden rounded-2xl border border-border-subtle bg-primary-dark shadow-sm">
                {!imageFailed ? (
                  <img
                    src={heroLearningImage}
                    alt="Student desk with open geometric study notebook and laptop in natural daylight"
                    referrerPolicy="no-referrer"
                    onError={() => setImageFailed(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full min-h-[280px] flex-col items-center justify-center bg-gradient-to-br from-primary-dark via-brand-indigo to-ai-violet p-8 text-center text-white">
                    <BookOpen className="h-12 w-12 text-success-emerald" />
                    <p className="mt-4 font-display text-xl font-bold">
                      Bilingual Academic Workspace
                    </p>
                    <p className="mt-1 font-bengali text-sm text-white/80">
                      গণিত, বিজ্ঞান, প্রোগ্রামিং ও পরীক্ষার প্রস্তুতি
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Three Core Feature Cards */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <h2 className="font-display text-2xl font-bold tracking-tight text-primary-dark sm:text-3xl">
            Three Focused Tools for Deep Mastery
          </h2>
          <p className="mt-2 text-sm sm:text-base text-text-secondary">
            Move seamlessly from understanding a new chapter to testing recall and planning your
            week.
          </p>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {FEATURE_CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.to}
                to={card.to}
                className="group flex flex-col justify-between rounded-2xl border border-border-subtle bg-surface p-6 shadow-sm transition-all hover:border-brand-indigo/45 hover:shadow-md"
              >
                <div>
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-indigo/10 text-brand-indigo">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 font-display text-lg font-bold text-primary-dark">
                    {card.title}
                  </h3>
                  <p className="mt-0.5 font-bengali text-xs font-medium text-text-muted">
                    {card.titleBn}
                  </p>
                  <p className="mt-3 text-sm text-text-secondary leading-relaxed">
                    {card.description}
                  </p>
                </div>

                <div className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-indigo group-hover:text-primary-dark">
                  <span>{card.actionLabel}</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Demo Stats Section (Explicitly labeled per Rule 4) */}
      <section className="border-t border-border-subtle bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-warning">
                Demo figures
              </p>
              <h2 className="mt-1 font-display text-xl font-bold text-primary-dark sm:text-2xl">
                Built for Learners Across Bangladesh &amp; Beyond
              </h2>
            </div>
            <p className="text-xs text-text-muted">
              Illustrative demo figures for platform preview — not verified live usage telemetry.
            </p>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {DEMO_STATS.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-border-subtle bg-canvas p-6"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-3xl font-extrabold text-primary-dark tabular-nums">
                    {stat.value}
                  </span>
                  <span className="text-xs font-medium text-text-muted">Demo figures</span>
                </div>
                <p className="mt-2 text-sm font-semibold text-text-primary">{stat.label}</p>
                <p className="mt-0.5 text-xs text-text-secondary">{stat.sublabel}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
