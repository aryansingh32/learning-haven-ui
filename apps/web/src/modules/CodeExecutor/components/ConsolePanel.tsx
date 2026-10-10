import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExecutionResult, TestCase } from '../types';
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, XCircle, Terminal, PlayCircle, ClipboardList, Keyboard, Play, Cpu, Info } from "lucide-react";
import { formatMemory } from '../customRun';
import type { CustomRunInput } from '../customRun';

interface ConsolePanelProps {
  testCases: TestCase[];
  executionResult: ExecutionResult | null;
  isExecuting: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  /** Offer a "Custom input" tab: run the code on an input the learner types. */
  onRunCustom?: (custom: CustomRunInput) => void;
  /** How inputs look, e.g. the first example's input, used to prefill the custom input. */
  inputExample?: string;
}

/** "Runtime 12 ms · Memory 3.4 MB", saying plainly when memory wasn't measured. */
function RunStats({ result }: { result: ExecutionResult }) {
  const memory = formatMemory(result.memoryUsage);
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-400" data-testid="run-stats">
      {result.executionTime != null && <span>Runtime <span className="font-mono text-zinc-200">{result.executionTime} ms</span></span>}
      {memory ? (
        <span className="inline-flex items-center gap-1"><Cpu className="h-3 w-3" aria-hidden /> Peak memory <span className="font-mono text-zinc-200">{memory}</span>
          <span className="text-zinc-500">(whole run)</span></span>
      ) : (
        <span className="inline-flex items-center gap-1 text-zinc-500"><Info className="h-3 w-3" aria-hidden />
          {result.ranIn === 'browser' ? 'Memory isn\'t measured when code runs in your browser — Submit to see it.' : 'Memory not reported for this run.'}
        </span>
      )}
    </p>
  );
}

function CustomInputForm({ onRun, isExecuting, inputExample }: { onRun: (c: CustomRunInput) => void; isExecuting: boolean; inputExample?: string }) {
  const [input, setInput] = useState(inputExample ?? '');
  const [expected, setExpected] = useState('');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isExecuting) return;
    onRun({ input: input.trim(), ...(expected.trim() ? { expected: expected.trim() } : {}) });
  };
  return (
    <form onSubmit={submit} className="p-4 sm:p-6 space-y-3" aria-label="Run with custom input">
      <p className="text-xs text-zinc-400 leading-relaxed">
        Your function is called with these arguments — write them like the examples, e.g.
        <code className="ml-1 font-mono text-emerald-400 break-all">{inputExample || 'nums = [1,2,3], target = 4'}</code>.
        Leave <span className="font-semibold text-zinc-300">Expected output</span> empty to just see what it returns.
      </p>
      <div className="space-y-1">
        <label htmlFor="custom-input" className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Input</label>
        <textarea id="custom-input" value={input} onChange={(e) => setInput(e.target.value)} rows={3} maxLength={5000} spellCheck={false}
          className="w-full rounded-lg bg-black/40 border border-white/10 p-3 font-mono text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
      </div>
      <div className="space-y-1">
        <label htmlFor="custom-expected" className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">Expected output (optional)</label>
        <input id="custom-expected" value={expected} onChange={(e) => setExpected(e.target.value)} maxLength={5000} spellCheck={false}
          className="w-full rounded-lg bg-black/40 border border-white/10 px-3 py-2 font-mono text-xs text-zinc-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
      </div>
      <button type="submit" disabled={isExecuting || !input.trim()}
        className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 text-zinc-100 text-xs font-bold disabled:opacity-50">
        <Play className="h-3 w-3" /> Run with this input
      </button>
    </form>
  );
}

function CustomResult({ result }: { result: ExecutionResult }) {
  const c = result.custom!;
  const tone = c.error ? 'border-rose-500/20 bg-rose-500/5' : c.matched === false ? 'border-rose-500/20 bg-rose-500/5' : c.matched ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-sky-500/20 bg-sky-500/5';
  const heading = c.error ? result.status : c.matched === true ? 'Matches your expected output' : c.matched === false ? "Doesn't match your expected output" : 'Ran on your input';
  return (
    <div className="space-y-4" data-testid="custom-result">
      <div className={cn('p-4 rounded-2xl border space-y-1', tone)}>
        <h4 className={cn('text-lg font-bold tracking-tight', c.error || c.matched === false ? 'text-rose-400' : c.matched ? 'text-emerald-400' : 'text-sky-300')}>{heading}</h4>
        <RunStats result={result} />
      </div>
      <div className="grid gap-3">
        <div>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Input</p>
          <code className="block bg-black/40 p-2 text-xs rounded-lg text-zinc-300 border border-white/5 break-all whitespace-pre-wrap">{c.input}</code>
        </div>
        {c.error ? (
          <div>
            <p className="text-[10px] font-bold text-rose-500/70 uppercase tracking-wider mb-1">Error</p>
            <pre className="bg-rose-500/5 p-2 text-xs rounded-lg text-rose-200 border border-rose-500/10 whitespace-pre-wrap break-all">{c.error}</pre>
          </div>
        ) : (
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Your output</p>
            <code className="block bg-zinc-900 p-2 text-xs rounded-lg text-zinc-100 border border-white/5 break-all whitespace-pre-wrap">{c.output ?? '(nothing returned)'}</code>
          </div>
        )}
        {c.expected !== null && (
          <div>
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-1">Expected</p>
            <code className="block bg-black/40 p-2 text-xs rounded-lg text-zinc-300 border border-white/5 break-all whitespace-pre-wrap">{c.expected}</code>
          </div>
        )}
      </div>
    </div>
  );
}

export const ConsolePanel: React.FC<ConsolePanelProps> = ({
  testCases,
  executionResult,
  isExecuting,
  activeTab,
  setActiveTab,
  onRunCustom,
  inputExample,
}) => {
  const isAccepted = executionResult?.status === 'Accepted';
  const isErrorOrTimeout = executionResult && executionResult.status !== 'Accepted';
  const isFreeForm = !!(executionResult as any)?.freeForm;

  return (
    <div className="h-full flex flex-col bg-zinc-950 border-t border-border/50">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <div className="px-2 sm:px-4 py-2 border-b border-border/50 bg-zinc-900/30 backdrop-blur-sm flex items-center justify-between gap-2 overflow-x-auto">
          <TabsList className="bg-zinc-900/50 p-1 rounded-lg border border-white/5 shrink-0">
            <TabsTrigger value="testcases" className="h-7 text-[11px] uppercase tracking-wider font-semibold data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 transition-all">
              <ClipboardList className="h-3 w-3 mr-2 opacity-60 hidden sm:inline" />
              Test Cases
            </TabsTrigger>
            {onRunCustom && (
              <TabsTrigger value="custom" className="h-7 text-[11px] uppercase tracking-wider font-semibold data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 transition-all">
                <Keyboard className="h-3 w-3 mr-2 opacity-60 hidden sm:inline" />
                Custom input
              </TabsTrigger>
            )}
            <TabsTrigger value="result" className="h-7 text-[11px] uppercase tracking-wider font-semibold data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 transition-all">
              <PlayCircle className="h-3 w-3 mr-2 opacity-60 hidden sm:inline" />
              Result
              {executionResult && (
                <span className={cn(
                  "ml-2 w-1.5 h-1.5 rounded-full shrink-0",
                  isAccepted || executionResult.status === 'Ran' ? "bg-emerald-500 animate-pulse" : "bg-rose-500 animate-pulse"
                )} />
              )}
            </TabsTrigger>
            <TabsTrigger value="console" className="h-7 text-[11px] uppercase tracking-wider font-semibold data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 transition-all">
              <Terminal className="h-3 w-3 mr-2 opacity-60 hidden sm:inline" />
              Console
            </TabsTrigger>
          </TabsList>
          <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-[0.2em] hidden lg:block">Output Terminal</div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <TabsContent value="testcases" className="flex-1 m-0 mt-0 overflow-hidden data-[state=inactive]:hidden">
            <ScrollArea className="h-full">
              <div className="p-4 sm:p-6 space-y-6">
                {testCases.map((tc, idx) => (
                  <div key={`tc-${idx}`} className="group p-4 bg-zinc-900/40 border border-white/5 rounded-xl hover:bg-zinc-900/60 transition-all">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-[10px] font-bold">
                        0{idx + 1}
                      </div>
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Test Case</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-600 uppercase">Input</label>
                        <div className="bg-black/40 p-3 rounded-lg font-mono text-xs text-zinc-300 border border-white/5 break-all">{tc.input}</div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold text-zinc-600 uppercase">Output</label>
                        <div className="bg-black/40 p-3 rounded-lg font-mono text-xs text-zinc-300 border border-white/5 break-all">{tc.output}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {onRunCustom && (
            <TabsContent value="custom" forceMount className="flex-1 m-0 mt-0 overflow-hidden data-[state=inactive]:hidden">
              <ScrollArea className="h-full">
                <CustomInputForm onRun={onRunCustom} isExecuting={isExecuting} inputExample={inputExample} />
              </ScrollArea>
            </TabsContent>
          )}

          <TabsContent value="result" className="flex-1 m-0 mt-0 overflow-hidden data-[state=inactive]:hidden">
            <ScrollArea className="h-full">
              <div className="p-4 sm:p-6 min-h-[200px]">
                {!executionResult && !isExecuting && (
                  <div className="h-[200px] flex flex-col items-center justify-center text-zinc-600 space-y-3 grayscale opacity-50">
                    <PlayCircle className="h-10 w-10 stroke-[1.5px]" />
                    <p className="text-xs font-medium uppercase tracking-widest">Execute code to see results</p>
                  </div>
                )}

                {isExecuting && (
                  <div className="h-[200px] flex flex-col items-center justify-center space-y-4">
                    <div className="h-8 w-8 rounded-full border-2 border-zinc-800 border-t-emerald-500 animate-spin" />
                    <p className="text-xs font-medium text-emerald-500/80 animate-pulse uppercase tracking-widest">Testing your solution...</p>
                  </div>
                )}

                {executionResult && !isExecuting && (
                  <div className="space-y-6">
                    {/* Free-form output: just show the raw terminal output */}
                    {executionResult.custom ? (
                      <CustomResult result={executionResult} />
                    ) : isFreeForm ? (
                      <div className="bg-black/60 border border-emerald-500/20 rounded-2xl p-5 space-y-3">
                        <div className="flex items-center gap-2 mb-3">
                          <Terminal className="h-4 w-4 text-emerald-500" />
                          <span className="text-[11px] font-bold text-emerald-500/70 uppercase tracking-wider">Program Output</span>
                        </div>
                        <pre className="text-sm text-emerald-400 font-mono whitespace-pre-wrap leading-relaxed select-text">
                          {executionResult.output || '(no output)'}
                        </pre>
                      </div>
                    ) : (
                      <>
                        <div className={cn(
                          "p-4 sm:p-6 rounded-2xl border flex items-center justify-between",
                          isAccepted ? "bg-emerald-500/5 border-emerald-500/20" : "bg-rose-500/5 border-rose-500/20"
                        )}>
                          <div className="flex items-center gap-4">
                            {isAccepted ? (
                              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                            ) : (
                              <XCircle className="h-8 w-8 text-rose-500" />
                            )}
                            <div>
                              <h4 className={cn(
                                "text-xl font-bold tracking-tight",
                                isAccepted ? "text-emerald-500" : "text-rose-500"
                              )}>{executionResult.status}</h4>
                              {executionResult.judged && (
                                <p className="text-xs text-zinc-500 mt-1 font-medium tracking-wide">
                                  Passed {executionResult.judged.passed} of {executionResult.judged.total} tests, including hidden ones
                                </p>
                              )}
                              <div className="mt-1.5"><RunStats result={executionResult} /></div>
                            </div>
                          </div>
                        </div>

                        {isErrorOrTimeout && executionResult.output && (
                          <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4 space-y-2">
                            <label className="text-[11px] font-bold text-rose-500/70 uppercase tracking-wider">Details</label>
                            <pre className="text-xs text-rose-300 font-mono whitespace-pre-wrap leading-relaxed select-text">
                              {executionResult.output}
                            </pre>
                          </div>
                        )}

                        {executionResult.testCaseResults && executionResult.testCaseResults.length > 0 && (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {executionResult.testCaseResults.map((res, idx) => (
                              <motion.div
                                key={`res-${idx}`}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: idx * 0.05 }}
                                className={cn(
                                  "p-4 rounded-xl border bg-black/40 transition-all hover:bg-zinc-900/50",
                                  res.passed ? "border-emerald-500/10" : "border-rose-500/10"
                                )}
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{res.label ?? `Case ${idx + 1}`}</span>
                                  {res.passed ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                  ) : (
                                    <XCircle className="h-3.5 w-3.5 text-rose-500" />
                                  )}
                                </div>
                                {!res.passed && res.hidden && (
                                  <p className="text-[11px] text-rose-300/80 leading-relaxed">
                                    {res.error || "Your output didn't match on this hidden test. Check edge cases (empty input, duplicates, negatives)."}
                                  </p>
                                )}
                                {!res.passed && !res.hidden && (
                                  <div className="space-y-3 mt-4">
                                    <div>
                                      <label className="text-[9px] font-bold text-rose-500/50 uppercase block mb-1">Expected</label>
                                      <code className="block bg-rose-500/5 p-2 text-xs rounded-lg text-rose-200 border border-rose-500/10 break-all">{res.expectedOutput}</code>
                                    </div>
                                    <div>
                                      <label className="text-[9px] font-bold text-rose-500/50 uppercase block mb-1">Actual</label>
                                      <code className="block bg-zinc-900 p-2 text-xs rounded-lg text-zinc-300 border border-white/5 break-all">{res.actualOutput}</code>
                                    </div>
                                  </div>
                                )}
                                {res.passed && (
                                  <div className="h-4 flex items-center">
                                    <span className="text-[10px] text-emerald-500/60 font-medium tracking-wide">Output matches expected</span>
                                  </div>
                                )}
                              </motion.div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="console" className="flex-1 m-0 mt-0 overflow-hidden data-[state=inactive]:hidden">
            <ScrollArea className="h-full">
              <div className="p-6 font-mono text-sm">
                <div className="bg-black/50 p-4 rounded-xl border border-white/5 min-h-[150px] relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/20" />
                  <pre className="text-emerald-500/90 whitespace-pre-wrap leading-relaxed pl-2">
                    {executionResult?.output ? (
                      <>
                        <span className="text-emerald-500/30 mr-2">$</span>
                        {executionResult.output}
                      </>
                    ) : (
                      <span className="text-zinc-700 italic">No console output yet. Run your code to see output.</span>
                    )}
                  </pre>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
};
