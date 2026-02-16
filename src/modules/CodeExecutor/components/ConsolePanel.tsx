import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ExecutionResult, TestCase } from '../types';
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, CheckCircle2, XCircle, Terminal, PlayCircle, ClipboardList } from "lucide-react";

interface ConsolePanelProps {
  testCases: TestCase[];
  executionResult: ExecutionResult | null;
  isExecuting: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const ConsolePanel: React.FC<ConsolePanelProps> = ({
  testCases,
  executionResult,
  isExecuting,
  activeTab,
  setActiveTab
}) => {

  return (
    <div className="h-full flex flex-col bg-zinc-950 border-t border-border/50">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
        <div className="px-4 py-2 border-b border-border/50 bg-zinc-900/30 backdrop-blur-sm flex items-center justify-between">
          <TabsList className="bg-zinc-900/50 p-1 rounded-lg border border-white/5">
            <TabsTrigger value="testcases" className="h-7 text-[11px] uppercase tracking-wider font-semibold data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 transition-all">
              <ClipboardList className="h-3 w-3 mr-2 opacity-60" />
              Test Cases
            </TabsTrigger>
            <TabsTrigger value="result" className="h-7 text-[11px] uppercase tracking-wider font-semibold data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 transition-all">
              <PlayCircle className="h-3 w-3 mr-2 opacity-60" />
              Test Result
              {executionResult && (
                <span className={cn(
                  "ml-2 w-1.5 h-1.5 rounded-full shrink-0",
                  executionResult.status === 'Accepted' ? "bg-emerald-500 animate-pulse" : "bg-rose-500 animate-pulse"
                )} />
              )}
            </TabsTrigger>
            <TabsTrigger value="console" className="h-7 text-[11px] uppercase tracking-wider font-semibold data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-100 transition-all">
              <Terminal className="h-3 w-3 mr-2 opacity-60" />
              Console
            </TabsTrigger>
          </TabsList>

          <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-[0.2em]">Output Terminal</div>
        </div>

        <div className="flex-1 min-h-0 relative">
          <AnimatePresence mode="wait">
            <TabsContent key={activeTab} value={activeTab} className="absolute inset-0 m-0 p-0 focus-visible:outline-none">
              <ScrollArea className="h-full">
                {activeTab === 'testcases' && (
                  <motion.div
                    key="testcases-content"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-6 space-y-6"
                  >
                    {testCases.map((tc, idx) => (
                      <div key={`tc-${idx}`} className="group p-4 bg-zinc-900/40 border border-white/5 rounded-xl hover:bg-zinc-900/60 transition-all">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-6 h-6 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center text-[10px] font-bold">
                            0{idx + 1}
                          </div>
                          <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Test Case</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-zinc-600 uppercase">Input</label>
                            <div className="bg-black/40 p-3 rounded-lg font-mono text-xs text-zinc-300 border border-white/5">{tc.input}</div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-bold text-zinc-600 uppercase">Output</label>
                            <div className="bg-black/40 p-3 rounded-lg font-mono text-xs text-zinc-300 border border-white/5">{tc.output}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </motion.div>
                )}

                {activeTab === 'result' && (
                  <motion.div
                    key="result-content"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="p-6"
                  >
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

                    {executionResult && (
                      <div className="space-y-6">
                        <div className={cn(
                          "p-6 rounded-2xl border flex items-center justify-between",
                          executionResult.status === 'Accepted'
                            ? "bg-emerald-500/5 border-emerald-500/20"
                            : "bg-rose-500/5 border-rose-500/20"
                        )}>
                          <div className="flex items-center gap-4">
                            {executionResult.status === 'Accepted'
                              ? <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                              : <XCircle className="h-8 w-8 text-rose-500" />
                            }
                            <div>
                              <h4 className={cn(
                                "text-xl font-bold tracking-tight",
                                executionResult.status === 'Accepted' ? "text-emerald-500" : "text-rose-500"
                              )}>{executionResult.status}</h4>
                              <p className="text-xs text-zinc-500 mt-1 font-medium tracking-wide">
                                {executionResult.executionTime ? `Execution time: ${executionResult.executionTime}ms` : 'Performance tests complete'}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Error Output Display */}
                        {executionResult.status !== 'Accepted' && executionResult.output && (
                          <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4 space-y-2">
                            <label className="text-[11px] font-bold text-rose-500/70 uppercase tracking-wider">Error Details</label>
                            <pre className="text-xs text-rose-300 font-mono whitespace-pre-wrap leading-relaxed select-text">
                              {executionResult.output}
                            </pre>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {executionResult.testCaseResults?.map((res, idx) => (
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
                                <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Case {idx + 1}</span>
                                {res.passed
                                  ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                                  : <XCircle className="h-3.5 w-3.5 text-rose-500" />
                                }
                              </div>

                              {!res.passed && (
                                <div className="space-y-3 mt-4">
                                  <div>
                                    <label className="text-[9px] font-bold text-rose-500/50 uppercase block mb-1">Expected</label>
                                    <code className="block bg-rose-500/5 p-2 text-xs rounded-lg text-rose-200 border border-rose-500/10">{res.expectedOutput}</code>
                                  </div>
                                  <div>
                                    <label className="text-[9px] font-bold text-rose-500/50 uppercase block mb-1">Actual</label>
                                    <code className="block bg-zinc-900 p-2 text-xs rounded-lg text-zinc-300 border border-white/5">{res.actualOutput}</code>
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
                      </div>
                    )}
                  </motion.div>
                )}

                {activeTab === 'console' && (
                  <motion.div
                    key="console-content"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-6 font-mono text-sm"
                  >
                    <div className="bg-black/50 p-4 rounded-xl border border-white/5 min-h-[150px] relative overflow-hidden group">
                      <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500/20" />
                      <pre className="text-emerald-500/90 whitespace-pre-wrap leading-relaxed">
                        {executionResult?.output ? (
                          <>
                            <span className="text-emerald-500/30 mr-2">$</span>
                            {executionResult.output}
                          </>
                        ) : (
                          <span className="text-zinc-700 italic">No console logs recorded...</span>
                        )}
                      </pre>
                    </div>
                  </motion.div>
                )}
              </ScrollArea>
            </TabsContent>
          </AnimatePresence>
        </div>
      </Tabs>
    </div>
  );
};
