import { Component, useEffect, useMemo, useState } from "react";
import {
  difficultyConfig,
  difficultyOrder,
  roleConfig,
  scenarioLookup,
  scenarios,
  views,
} from "./data/scenarios";
import { cn } from "./utils/cn";

const STORAGE_KEY = "phishguard.attempts.v1";
const ROLE_KEY = "phishguard.role.v1";

function makeAttemptId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `attempt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readStoredAttempts() {
  if (typeof window === "undefined") return { data: [] };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { data: [] };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("Saved progress is not a list.");
    return {
      data: parsed.filter((item) => item && typeof item.id === "string" && typeof item.scenarioId === "string"),
    };
  } catch {
    return { data: [], error: "Saved progress could not be loaded. A fresh local session has started." };
  }
}

function readStoredRole() {
  if (typeof window === "undefined") return "trainee";
  const storedRole = window.localStorage.getItem(ROLE_KEY);
  return storedRole === "lead" || storedRole === "admin" || storedRole === "trainee" ? storedRole : "trainee";
}

function summarizeProgress(attempts) {
  const byDifficulty = difficultyOrder.reduce((acc, difficulty) => {
    acc[difficulty] = { attempted: 0, correct: 0, score: 0, possible: 0 };
    return acc;
  }, {});

  attempts.forEach((attempt) => {
    byDifficulty[attempt.difficulty].attempted += 1;
    byDifficulty[attempt.difficulty].correct += attempt.correct ? 1 : 0;
    byDifficulty[attempt.difficulty].score += attempt.earned;
    byDifficulty[attempt.difficulty].possible += attempt.possible;
  });

  const completed = attempts.length;
  const correct = attempts.filter((attempt) => attempt.correct).length;
  const score = attempts.reduce((total, attempt) => total + attempt.earned, 0);
  const possible = attempts.reduce((total, attempt) => total + attempt.possible, 0);
  const averageConfidence = completed ? Math.round(attempts.reduce((total, attempt) => total + attempt.confidence, 0) / completed) : 0;
  let streak = 0;

  for (const attempt of attempts) {
    if (!attempt.correct) break;
    streak += 1;
  }

  return {
    completed,
    correct,
    accuracy: completed ? Math.round((correct / completed) * 100) : 0,
    score,
    possible,
    streak,
    averageConfidence,
    byDifficulty,
  };
}

function formatTime(value) {
  try {
    return new Intl.DateTimeFormat("en", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return "Recent";
  }
}

function classifyLabel(classification) {
  return classification === "phishing" ? "Phishing" : "Legitimate";
}

function getRecommendations(attempts) {
  if (attempts.length === 0) {
    return ["Complete one simulation to unlock coaching recommendations.", "Start with Beginner if you want to calibrate your baseline."];
  }

  const misses = attempts.filter((attempt) => !attempt.correct);
  const highConfidenceMisses = misses.filter((attempt) => attempt.confidence >= 75);
  const becMisses = misses.filter((attempt) => scenarioLookup.get(attempt.scenarioId)?.tags.some((tag) => tag.includes("fraud")));
  const advancedAttempts = attempts.filter((attempt) => attempt.difficulty === "advanced");
  const recommendations = [];

  if (highConfidenceMisses.length > 0) {
    recommendations.push("Review high-confidence misses first. They indicate habits that feel reliable but need correction.");
  }
  if (becMisses.length > 0) {
    recommendations.push("Practice payment-change and executive-impersonation scenarios before approving finance workflows.");
  }
  if (advancedAttempts.length < 2 && attempts.length >= 4) {
    recommendations.push("Move into Advanced mode to test OAuth consent and business email compromise scenarios.");
  }
  if (recommendations.length === 0) {
    recommendations.push("Accuracy is trending well. Increase difficulty or coach a peer using your recent explanations.");
  }

  return recommendations;
}

class AppErrorBoundary extends Component {
  state = { hasError: false, message: "" };

  static getDerivedStateFromError(error) {
    return { hasError: true, message: error.message || "The simulator hit an unexpected error." };
  }

  componentDidCatch(error, info) {
    console.error("PhishGuard runtime error", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
          <div className="mx-auto max-w-2xl rounded-3xl border border-rose-300/30 bg-rose-950/30 p-8 shadow-2xl shadow-rose-950/30">
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-rose-200">Simulator error</p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight">The training session needs a refresh.</h1>
            <p className="mt-3 text-slate-300">{this.state.message}</p>
            <button
              className="mt-6 rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-100"
              onClick={() => window.location.reload()}
              type="button"
            >
              Reload simulator
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <AppErrorBoundary>
      <PhishingTrainingApp />
    </AppErrorBoundary>
  );
}

function PhishingTrainingApp() {
  const [boot] = useState(readStoredAttempts);
  const [attempts, setAttempts] = useState(boot.data);
  const [storageError, setStorageError] = useState(boot.error || null);
  const [role, setRole] = useState(readStoredRole);
  const [view, setView] = useState("simulator");
  const [difficulty, setDifficulty] = useState("beginner");
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [choice, setChoice] = useState(null);
  const [selectedSignals, setSelectedSignals] = useState([]);
  const [confidence, setConfidence] = useState(62);
  const [reveal, setReveal] = useState(false);
  const [error, setError] = useState(null);
  const [lastAttempt, setLastAttempt] = useState(null);

  const allowedViews = roleConfig[role].views;
  const filteredScenarios = useMemo(() => scenarios.filter((scenario) => scenario.difficulty === difficulty), [difficulty]);
  const currentScenario = filteredScenarios[scenarioIndex % Math.max(filteredScenarios.length, 1)];
  const progress = useMemo(() => summarizeProgress(attempts), [attempts]);
  const recommendations = useMemo(() => getRecommendations(attempts), [attempts]);

  useEffect(() => {
    if (!allowedViews.includes(view)) {
      setView("simulator");
      setError(`${roleConfig[role].label} access does not include that area.`);
    }
  }, [allowedViews, role, view]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(attempts));
    } catch {
      setStorageError("Progress is running locally but could not be saved in this browser.");
    }
  }, [attempts]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(ROLE_KEY, role);
    } catch {
      setStorageError("Role selection could not be saved in this browser.");
    }
  }, [role]);

  function resetInteraction() {
    setChoice(null);
    setSelectedSignals([]);
    setConfidence(62);
    setReveal(false);
    setError(null);
    setLastAttempt(null);
  }

  function handleDifficultyChange(nextDifficulty) {
    setDifficulty(nextDifficulty);
    setScenarioIndex(0);
    resetInteraction();
  }

  function toggleSignal(signalId) {
    if (reveal) return;
    setSelectedSignals((current) => (current.includes(signalId) ? current.filter((id) => id !== signalId) : [...current, signalId]));
  }

  function handleSubmit() {
    if (!currentScenario) {
      setError("No scenario is available for the selected difficulty. Choose another level.");
      return;
    }
    if (!choice) {
      setError("Choose Phishing or Legitimate before submitting your decision.");
      return;
    }

    const validSignals = selectedSignals.filter((signalId) => currentScenario.signals.find((signal) => signal.id === signalId)?.valid).length;
    const invalidSignals = selectedSignals.length - validSignals;
    const validSignalCount = currentScenario.signals.filter((signal) => signal.valid).length;
    const signalRatio = validSignalCount ? validSignals / validSignalCount : 0;
    const correct = choice === currentScenario.classification;
    const evidenceBonus = Math.round(10 * signalRatio);
    const partialCredit = correct ? currentScenario.points : Math.round(currentScenario.points * 0.2 * signalRatio);
    const earned = Math.max(0, Math.min(currentScenario.points + 10, partialCredit + evidenceBonus - invalidSignals * 3));

    const attempt = {
      id: makeAttemptId(),
      scenarioId: currentScenario.id,
      scenarioTitle: currentScenario.title,
      difficulty: currentScenario.difficulty,
      expected: currentScenario.classification,
      selected: choice,
      correct,
      earned,
      possible: currentScenario.points + 10,
      confidence,
      selectedSignals,
      validSignals,
      invalidSignals,
      createdAt: new Date().toISOString(),
      role,
    };

    setAttempts((current) => [attempt, ...current].slice(0, 100));
    setLastAttempt(attempt);
    setReveal(true);
    setError(null);
  }

  function handleNextScenario() {
    if (!filteredScenarios.length) {
      setError("No scenario is available. Switch difficulty to continue.");
      return;
    }
    setScenarioIndex((current) => (current + 1) % filteredScenarios.length);
    resetInteraction();
  }

  function clearProgress() {
    setAttempts([]);
    setError(null);
    setLastAttempt(null);
  }

  function exportReport() {
    try {
      const report = { product: "PhishGuard Lab", generatedAt: new Date().toISOString(), role, progress, attempts };
      const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = "phishguard-progress-report.json";
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("The report could not be exported. Your browser may be blocking downloads.");
    }
  }

  function navigate(nextView) {
    if (!allowedViews.includes(nextView)) {
      setError(`${roleConfig[role].label} access does not include ${views.find((item) => item.id === nextView)?.label}.`);
      return;
    }
    setView(nextView);
    setError(null);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07111f] text-slate-100">
      <BackgroundSystem />
      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6 px-5 py-5 sm:px-8 lg:px-10">
        <AppHeader activeView={view} allowedViews={allowedViews} navigate={navigate} progress={progress} role={role} setRole={setRole} />
        {(error || storageError) && <Alert message={error || storageError} onDismiss={() => (error ? setError(null) : setStorageError(null))} />}

        {view === "simulator" && (
          <SimulatorView
            choice={choice}
            confidence={confidence}
            currentScenario={currentScenario}
            difficulty={difficulty}
            filteredCount={filteredScenarios.length}
            handleDifficultyChange={handleDifficultyChange}
            handleNextScenario={handleNextScenario}
            handleSubmit={handleSubmit}
            lastAttempt={lastAttempt}
            progress={progress}
            reveal={reveal}
            selectedSignals={selectedSignals}
            setChoice={setChoice}
            setConfidence={setConfidence}
            toggleSignal={toggleSignal}
          />
        )}

        {view === "dashboard" && <DashboardView attempts={attempts} clearProgress={clearProgress} exportReport={exportReport} progress={progress} recommendations={recommendations} />}

        {view === "team" && (
          <TeamView
            allowed={allowedViews.includes("team")}
            progress={progress}
            role={role}
            setDifficulty={(nextDifficulty) => {
              handleDifficultyChange(nextDifficulty);
              setView("simulator");
            }}
          />
        )}

        {view === "library" && <LibraryView allowed={allowedViews.includes("library")} clearProgress={clearProgress} exportReport={exportReport} role={role} />}
      </div>
    </div>
  );
}

function BackgroundSystem() {
  return (
    <div aria-hidden="true" className="fixed inset-0 -z-0">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_20%,rgba(34,211,238,0.20),transparent_28%),radial-gradient(circle_at_82%_8%,rgba(16,185,129,0.14),transparent_24%),linear-gradient(135deg,#07111f_0%,#0d1728_48%,#020617_100%)]" />
      <div className="scan-grid absolute inset-0 opacity-[0.22]" />
      <div className="slow-drift absolute left-[-10%] top-[22%] h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="slow-drift-delayed absolute bottom-[-12%] right-[4%] h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />
    </div>
  );
}

function AppHeader({ activeView, allowedViews, navigate, progress, role, setRole }) {
  return (
    <header className="motion-panel flex flex-col gap-4 rounded-[2rem] border border-white/10 bg-white/[0.055] p-4 shadow-2xl shadow-cyan-950/20 backdrop-blur-2xl lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-3">
        <div className="threat-orbit relative flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-200/30 bg-cyan-300/10 text-cyan-100 shadow-lg shadow-cyan-950/30">
          <ShieldIcon />
        </div>
        <div>
          <p className="text-lg font-semibold tracking-tight text-white">PhishGuard Lab</p>
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-100/70">Awareness simulator</p>
        </div>
      </div>

      <nav className="flex flex-wrap items-center gap-2" aria-label="Primary navigation">
        {views.map((item) => {
          const allowed = allowedViews.includes(item.id);
          return (
            <button
              aria-disabled={!allowed}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-semibold transition",
                activeView === item.id ? "bg-cyan-200 text-slate-950 shadow-lg shadow-cyan-950/20" : "text-slate-300 hover:bg-white/10 hover:text-white",
                !allowed && "cursor-not-allowed opacity-45 hover:bg-transparent hover:text-slate-300",
              )}
              key={item.id}
              onClick={() => navigate(item.id)}
              type="button"
            >
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-2 text-sm text-slate-300">
          <span className="text-white">{progress.score}</span>
          <span className="text-slate-500"> / {progress.possible || 0} pts</span>
        </div>
        <label className="sr-only" htmlFor="role-select">Select access role</label>
        <select
          className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-2 text-sm font-semibold text-slate-100 outline-none transition focus:border-cyan-200"
          id="role-select"
          onChange={(event) => setRole(event.target.value)}
          value={role}
        >
          {Object.entries(roleConfig).map(([id, config]) => (
            <option key={id} value={id}>{config.label}</option>
          ))}
        </select>
      </div>
    </header>
  );
}

function Alert({ message, onDismiss }) {
  return (
    <div aria-live="polite" className="motion-panel flex flex-col gap-3 rounded-3xl border border-amber-200/30 bg-amber-300/10 p-4 text-amber-50 shadow-lg shadow-amber-950/20 sm:flex-row sm:items-center sm:justify-between" role="status">
      <p className="text-sm font-medium">{message}</p>
      <button className="rounded-full border border-amber-100/30 px-3 py-1 text-xs font-semibold transition hover:bg-amber-100/15" onClick={onDismiss} type="button">Dismiss</button>
    </div>
  );
}

function SimulatorView(props) {
  const {
    choice, confidence, currentScenario, difficulty, filteredCount, handleDifficultyChange, handleNextScenario, handleSubmit, lastAttempt, progress, reveal, selectedSignals, setChoice, setConfidence, toggleSignal,
  } = props;

  return (
    <main className="grid min-h-[calc(100vh-9rem)] gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
      <section className="motion-panel flex flex-col justify-center gap-8 py-6 lg:py-10">
        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.34em] text-cyan-200/80">Cybersecurity awareness</p>
          <h1 className="mt-5 text-5xl font-semibold tracking-[-0.06em] text-white sm:text-6xl lg:text-7xl">
            PhishGuard Lab
            <span className="block text-cyan-100/70">turns inbox instincts into evidence.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-8 text-slate-300 sm:text-lg">
            Inspect realistic emails, choose phishing or legitimate, then get scored feedback that adapts to difficulty, confidence, and the evidence you selected.
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Difficulty</p>
            <p className="text-sm text-slate-400">{filteredCount} scenarios</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {difficultyOrder.map((level) => (
              <button
                className={cn(
                  "group rounded-3xl border p-4 text-left transition duration-300 hover:-translate-y-1 hover:bg-white/[0.08]",
                  difficulty === level ? cn("bg-white/[0.09] shadow-xl shadow-cyan-950/20", difficultyConfig[level].border) : "border-white/10 bg-white/[0.035]",
                )}
                key={level}
                onClick={() => handleDifficultyChange(level)}
                type="button"
              >
                <span className={cn("text-sm font-semibold", difficultyConfig[level].accent)}>{difficultyConfig[level].label}</span>
                <span className="mt-2 block text-xs leading-5 text-slate-400">{difficultyConfig[level].description}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 text-center">
          <MiniMetric label="Completed" value={progress.completed.toString()} />
          <MiniMetric label="Accuracy" value={`${progress.accuracy}%`} />
          <MiniMetric label="Streak" value={progress.streak.toString()} />
        </div>
      </section>

      {currentScenario ? (
        <EmailSimulator
          choice={choice}
          confidence={confidence}
          handleNextScenario={handleNextScenario}
          handleSubmit={handleSubmit}
          lastAttempt={lastAttempt}
          reveal={reveal}
          scenario={currentScenario}
          selectedSignals={selectedSignals}
          setChoice={setChoice}
          setConfidence={setConfidence}
          toggleSignal={toggleSignal}
        />
      ) : (
        <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-8">
          <h2 className="text-2xl font-semibold text-white">No scenario found</h2>
          <p className="mt-3 text-slate-300">Switch difficulty to continue the training path.</p>
        </div>
      )}
    </main>
  );
}

function EmailSimulator({ choice, confidence, handleNextScenario, handleSubmit, lastAttempt, reveal, scenario, selectedSignals, setChoice, setConfidence, toggleSignal }) {
  return (
    <section className="motion-panel relative overflow-hidden rounded-[2.25rem] border border-white/10 bg-slate-950/[0.82] shadow-2xl shadow-cyan-950/30 backdrop-blur-2xl">
      <div className="scan-beam absolute left-0 top-0 h-px w-1/2 bg-cyan-200/80" />
      <div className="border-b border-white/10 bg-white/[0.04] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-rose-400/80" />
            <span className="h-3 w-3 rounded-full bg-amber-300/80" />
            <span className="h-3 w-3 rounded-full bg-emerald-300/80" />
          </div>
          <div className={cn("rounded-full border px-3 py-1 text-xs font-semibold", difficultyConfig[scenario.difficulty].soft, difficultyConfig[scenario.difficulty].border, difficultyConfig[scenario.difficulty].accent)}>
            {difficultyConfig[scenario.difficulty].label} drill
          </div>
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[1fr_0.78fr]">
        <article className="border-white/10 p-5 sm:p-7 xl:border-r">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-5">
            <div>
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Inbox sample</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">{scenario.subject}</h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-400">{scenario.preview}</p>
            </div>
            <p className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400">{scenario.received}</p>
          </div>

          <dl className="mt-5 grid gap-3 text-sm">
            <MetaRow label="From" value={`${scenario.senderName} <${scenario.senderEmail}>`} />
            <MetaRow label="Reply-to" value={scenario.replyTo} />
            {scenario.attachment && <MetaRow label="Attachment" value={scenario.attachment} warning />}
          </dl>

          <div className="mt-6 space-y-4 rounded-3xl border border-white/10 bg-white/[0.035] p-5 leading-7 text-slate-200">
            {scenario.body.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
            {scenario.linkLabel && scenario.linkUrl && (
              <div className="pt-2">
                <span className="block text-sm font-semibold text-cyan-200">{scenario.linkLabel}</span>
                <span className="break-all font-mono text-xs text-cyan-100/70">{scenario.linkUrl}</span>
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {scenario.tags.map((tag) => (
              <span className="rounded-full border border-white/10 bg-white/[0.035] px-3 py-1 text-xs text-slate-300" key={tag}>{tag}</span>
            ))}
          </div>
        </article>

        <aside className="space-y-5 p-5 sm:p-7">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Decision</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <DecisionButton active={choice === "phishing"} disabled={reveal} label="Phishing" onClick={() => setChoice("phishing")} tone="risk" />
              <DecisionButton active={choice === "legitimate"} disabled={reveal} label="Legitimate" onClick={() => setChoice("legitimate")} tone="trust" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Evidence</p>
              <p className="text-xs text-slate-500">{selectedSignals.length} selected</p>
            </div>
            <div className="mt-3 space-y-2">
              {scenario.signals.map((signal) => (
                <button
                  className={cn(
                    "w-full rounded-2xl border p-3 text-left text-sm leading-5 transition",
                    selectedSignals.includes(signal.id) ? "border-cyan-200/60 bg-cyan-200/10 text-cyan-50" : "border-white/10 bg-white/[0.025] text-slate-300 hover:bg-white/[0.06]",
                    reveal && signal.valid && "border-emerald-200/50 bg-emerald-300/10 text-emerald-50",
                    reveal && selectedSignals.includes(signal.id) && !signal.valid && "border-rose-200/50 bg-rose-300/10 text-rose-50",
                  )}
                  disabled={reveal}
                  key={signal.id}
                  onClick={() => toggleSignal(signal.id)}
                  type="button"
                >
                  <span className="flex items-start gap-3">
                    <span className={cn("mt-0.5 h-4 w-4 shrink-0 rounded border transition", selectedSignals.includes(signal.id) ? "border-cyan-100 bg-cyan-200" : "border-slate-500", reveal && signal.valid && "border-emerald-100 bg-emerald-200")} />
                    <span>{signal.label}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="flex items-center justify-between text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">
              Confidence <span className="tracking-normal text-cyan-100">{confidence}%</span>
            </span>
            <input className="mt-4 w-full accent-cyan-200" disabled={reveal} max="100" min="0" onChange={(event) => setConfidence(Number(event.target.value))} type="range" value={confidence} />
          </label>

          {reveal && lastAttempt ? <ResultPanel attempt={lastAttempt} scenario={scenario} /> : null}

          <div className="flex flex-col gap-3 sm:flex-row">
            {!reveal ? (
              <button className="rounded-full bg-cyan-200 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-white" onClick={handleSubmit} type="button">Submit decision</button>
            ) : (
              <button className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:-translate-y-0.5 hover:bg-cyan-100" onClick={handleNextScenario} type="button">Next email</button>
            )}
            <button className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white" onClick={handleNextScenario} type="button">Skip</button>
          </div>
        </aside>
      </div>
    </section>
  );
}

function DecisionButton({ active, disabled, label, onClick, tone }) {
  return (
    <button
      className={cn(
        "rounded-3xl border p-4 text-left transition duration-300 hover:-translate-y-1 disabled:cursor-not-allowed disabled:hover:translate-y-0",
        active && tone === "risk" && "border-rose-200/70 bg-rose-300/15 text-rose-50 shadow-lg shadow-rose-950/20",
        active && tone === "trust" && "border-emerald-200/70 bg-emerald-300/15 text-emerald-50 shadow-lg shadow-emerald-950/20",
        !active && "border-white/10 bg-white/[0.035] text-slate-300 hover:bg-white/[0.08]",
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className="block text-lg font-semibold">{label}</span>
      <span className="mt-1 block text-xs text-slate-400">{tone === "risk" ? "Report and avoid interaction" : "Proceed through trusted channel"}</span>
    </button>
  );
}

function ResultPanel({ attempt, scenario }) {
  const signalCount = scenario.signals.filter((signal) => signal.valid).length;
  const evidenceQuality = signalCount ? Math.round((attempt.validSignals / signalCount) * 100) : 0;
  const confidenceNote = !attempt.correct && attempt.confidence >= 75
    ? "High confidence miss: slow down and verify sender, request, and destination before acting."
    : attempt.correct && attempt.confidence < 45
      ? "Correct but uncertain: your evidence was useful. Keep practicing until the pattern feels repeatable."
      : "Confidence and evidence are aligned enough for this drill.";

  return (
    <div className={cn("rounded-3xl border p-4", attempt.correct ? "border-emerald-200/40 bg-emerald-300/10" : "border-rose-200/40 bg-rose-300/10")}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-300">Feedback</p>
        <p className="rounded-full bg-slate-950/40 px-3 py-1 text-sm font-semibold text-white">{attempt.earned} / {attempt.possible} pts</p>
      </div>
      <h3 className="mt-3 text-xl font-semibold text-white">{attempt.correct ? "Correct classification" : "Missed classification"}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-300">You chose {classifyLabel(attempt.selected)}. The correct answer is {classifyLabel(scenario.classification)}.</p>
      <p className="mt-3 text-sm leading-6 text-slate-200">{scenario.explanation}</p>
      <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-2xl bg-slate-950/35 p-3"><span className="text-slate-400">Evidence quality</span><strong className="mt-1 block text-white">{evidenceQuality}%</strong></div>
        <div className="rounded-2xl bg-slate-950/35 p-3"><span className="text-slate-400">False cues selected</span><strong className="mt-1 block text-white">{attempt.invalidSignals}</strong></div>
      </div>
      <p className="mt-4 text-sm leading-6 text-cyan-100">{confidenceNote}</p>
      <p className="mt-2 text-sm leading-6 text-slate-300">Recommended action: {scenario.recommendedAction}</p>
    </div>
  );
}

function MetaRow({ label, value, warning = false }) {
  return (
    <div className="grid gap-1 rounded-2xl bg-white/[0.025] px-4 py-3 sm:grid-cols-[5.5rem_1fr]">
      <dt className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</dt>
      <dd className={cn("break-all font-mono text-xs", warning ? "text-amber-200" : "text-slate-300")}>{value}</dd>
    </div>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-2xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
    </div>
  );
}

function DashboardView({ attempts, clearProgress, exportReport, progress, recommendations }) {
  return (
    <main className="motion-panel grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-6 backdrop-blur-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200/80">Progress tracking</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white">Personal dashboard</h1>
        <p className="mt-4 leading-7 text-slate-300">Track decisions, confidence, and evidence habits. Data is saved in local browser storage so this demo remains deployable without a backend.</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <DashboardMetric label="Accuracy" value={`${progress.accuracy}%`} />
          <DashboardMetric label="Score" value={`${progress.score}`} helper={`${progress.possible || 0} possible`} />
          <DashboardMetric label="Streak" value={`${progress.streak}`} />
          <DashboardMetric label="Confidence" value={`${progress.averageConfidence}%`} />
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button className="rounded-full bg-cyan-200 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white" onClick={exportReport} type="button">Export report</button>
          <button className="rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white" onClick={clearProgress} type="button">Reset progress</button>
        </div>
      </section>

      <section className="grid gap-6">
        <div className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 backdrop-blur-2xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Difficulty performance</p><h2 className="mt-2 text-2xl font-semibold text-white">Evidence over guessing</h2></div>
            <p className="text-sm text-slate-400">{progress.completed} completed</p>
          </div>
          <div className="mt-6 space-y-5">
            {difficultyOrder.map((level) => {
              const stats = progress.byDifficulty[level];
              const accuracy = stats.attempted ? Math.round((stats.correct / stats.attempted) * 100) : 0;
              return <ProgressBar key={level} label={`${difficultyConfig[level].label} accuracy`} value={accuracy} />;
            })}
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-2xl">
            <h2 className="text-2xl font-semibold text-white">Coaching recommendations</h2>
            <div className="mt-4 space-y-3">
              {recommendations.map((item) => <p className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-sm leading-6 text-slate-300" key={item}>{item}</p>)}
            </div>
          </div>
          <div className="rounded-[2rem] border border-white/10 bg-white/[0.045] p-6 backdrop-blur-2xl">
            <h2 className="text-2xl font-semibold text-white">Recent attempts</h2>
            <div className="mt-4 max-h-[21rem] space-y-3 overflow-auto pr-1">
              {attempts.length === 0 ? (
                <p className="rounded-2xl border border-white/10 bg-slate-950/45 p-4 text-sm text-slate-400">No attempts yet. Run the simulator to populate this feed.</p>
              ) : (
                attempts.slice(0, 8).map((attempt) => (
                  <div className="rounded-2xl border border-white/10 bg-slate-950/45 p-4" key={attempt.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div><p className="font-semibold text-white">{attempt.scenarioTitle}</p><p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{difficultyConfig[attempt.difficulty].label}</p></div>
                      <span className={cn("rounded-full px-3 py-1 text-xs font-semibold", attempt.correct ? "bg-emerald-300/15 text-emerald-200" : "bg-rose-300/15 text-rose-200")}>{attempt.correct ? "Correct" : "Miss"}</span>
                    </div>
                    <p className="mt-3 text-sm text-slate-400">{attempt.earned}/{attempt.possible} pts - {formatTime(attempt.createdAt)}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function DashboardMetric({ label, value, helper }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-950/45 p-4">
      <p className="text-3xl font-semibold text-white">{value}</p>
      <p className="mt-1 text-sm text-slate-400">{label}</p>
      {helper && <p className="mt-1 text-xs text-slate-500">{helper}</p>}
    </div>
  );
}

function TeamView({ allowed, progress, role, setDifficulty }) {
  if (!allowed) return <AccessDenied role={role} required="Team Lead or Security Admin" />;

  const teamRows = [
    { name: "Finance Ops", completion: 82, accuracy: 71, risk: "Payment-change requests", difficulty: "intermediate" },
    { name: "Executive Assistants", completion: 64, accuracy: 68, risk: "Gift card and urgent favors", difficulty: "advanced" },
    { name: "New Hires", completion: 48, accuracy: 76, risk: "Credential reset lures", difficulty: "beginner" },
    { name: "IT Support", completion: 91, accuracy: 84, risk: "MFA code theft", difficulty: "intermediate" },
  ];
  const averageAccuracy = Math.round((teamRows.reduce((sum, row) => sum + row.accuracy, 0) + progress.accuracy) / (teamRows.length + 1));

  return (
    <main className="motion-panel grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-6 backdrop-blur-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200/80">Role-based access</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white">Team coaching console</h1>
        <p className="mt-4 leading-7 text-slate-300">Leads and admins can view aggregate training signals and route people into the right difficulty path. Demo team rows are seeded for deployment without external services.</p>
        <div className="mt-6 grid grid-cols-2 gap-3"><DashboardMetric label="Team accuracy" value={`${averageAccuracy}%`} /><DashboardMetric label="Active groups" value={teamRows.length.toString()} /></div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 backdrop-blur-2xl">
        <div><p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Risk map</p><h2 className="mt-2 text-2xl font-semibold text-white">Recommended drills by group</h2></div>
        <div className="mt-6 space-y-4">
          {teamRows.map((row) => (
            <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-5" key={row.name}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div><h3 className="text-lg font-semibold text-white">{row.name}</h3><p className="mt-1 text-sm text-slate-400">Highest risk: {row.risk}</p></div>
                <button className="rounded-full bg-cyan-200 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-white" onClick={() => setDifficulty(row.difficulty)} type="button">Launch {difficultyConfig[row.difficulty].label}</button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2"><ProgressBar label="Completion" value={row.completion} /><ProgressBar label="Accuracy" value={row.accuracy} /></div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function LibraryView({ allowed, clearProgress, exportReport, role }) {
  if (!allowed) return <AccessDenied role={role} required="Security Admin" />;

  return (
    <main className="motion-panel grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
      <section className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-6 backdrop-blur-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-200/80">Admin library</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-white">Scenario controls</h1>
        <p className="mt-4 leading-7 text-slate-300">The deployable version ships with a seeded library, local progress storage, report export, and guarded admin controls.</p>
        <div className="mt-6 space-y-3">
          <button className="w-full rounded-full bg-cyan-200 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-white" onClick={exportReport} type="button">Export progress JSON</button>
          <button className="w-full rounded-full border border-white/10 px-5 py-3 text-sm font-semibold text-slate-300 transition hover:bg-white/10 hover:text-white" onClick={clearProgress} type="button">Clear local progress</button>
        </div>
        <div className="mt-6 rounded-3xl border border-white/10 bg-slate-950/45 p-4"><p className="text-sm font-semibold text-white">Deployable mode</p><p className="mt-2 text-sm leading-6 text-slate-400">No server secrets, no private API calls, and no database dependency are required for this version.</p></div>
      </section>

      <section className="rounded-[2rem] border border-white/10 bg-slate-950/70 p-6 backdrop-blur-2xl">
        <div><p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Seeded scenario library</p><h2 className="mt-2 text-2xl font-semibold text-white">{scenarios.length} simulations ready</h2></div>
        <div className="mt-6 overflow-hidden rounded-3xl border border-white/10">
          <div className="grid grid-cols-[1.2fr_0.7fr_0.7fr] gap-3 border-b border-white/10 bg-white/[0.06] px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400"><span>Scenario</span><span>Difficulty</span><span>Answer</span></div>
          <div className="divide-y divide-white/10">
            {scenarios.map((scenario) => (
              <div className="grid grid-cols-[1.2fr_0.7fr_0.7fr] gap-3 px-4 py-4 text-sm" key={scenario.id}>
                <div><p className="font-semibold text-white">{scenario.title}</p><p className="mt-1 text-xs text-slate-500">{scenario.tags.slice(0, 2).join(" / ")}</p></div>
                <span className={difficultyConfig[scenario.difficulty].accent}>{difficultyConfig[scenario.difficulty].label}</span>
                <span className={scenario.classification === "phishing" ? "text-rose-200" : "text-emerald-200"}>{classifyLabel(scenario.classification)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

function AccessDenied({ role, required }) {
  return (
    <main className="motion-panel rounded-[2rem] border border-amber-200/30 bg-amber-300/10 p-8 text-amber-50 backdrop-blur-2xl">
      <p className="text-sm font-semibold uppercase tracking-[0.3em]">Access control</p>
      <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em]">Restricted area</h1>
      <p className="mt-4 max-w-2xl leading-7">Your current role is {roleConfig[role].label}. This area requires {required}. Change roles from the header to preview the protected workflow.</p>
    </main>
  );
}

function ProgressBar({ label, value }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm"><span className="text-slate-400">{label}</span><span className="font-semibold text-white">{value}%</span></div>
      <div className="h-3 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-200 transition-all duration-700" style={{ width: `${value}%` }} /></div>
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg aria-hidden="true" className="h-6 w-6" fill="none" viewBox="0 0 24 24">
      <path d="M12 3.25 5.25 5.8v5.1c0 4.35 2.75 8.25 6.75 9.85 4-1.6 6.75-5.5 6.75-9.85V5.8L12 3.25Z" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.7" />
      <path d="m8.6 12.15 2.2 2.2 4.8-5.05" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" />
    </svg>
  );
}















































