import React, { useState, useEffect, useMemo, Component, ErrorInfo, ReactNode } from 'react';
import { 
  auth, db, loginWithGoogle, logout, onAuthStateChanged, 
  collection, query, orderBy, limit, onSnapshot, User as FirebaseUser,
  OperationType, handleFirestoreError, addDoc
} from './firebase';
import { Commit, FileRisk, Repository, TeamMember, ChatMessage } from './types';
import { cn } from './lib/utils';
import { 
  Shield, AlertTriangle, CheckCircle, Activity, 
  GitCommit, FileCode, BarChart3, LogOut, Github,
  Search, Filter, ChevronRight, AlertCircle, Terminal,
  Zap, Lock, Cpu, Database, RefreshCw, Info, ExternalLink,
  Users, MessageSquare, Send, User, Bot
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer 
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { Toaster, toast } from 'sonner';

// --- Error Boundary ---

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center justify-center p-8 text-center">
          <AlertCircle className="text-rose-500 mb-4" size={48} />
          <h1 className="text-xl font-mono text-white mb-2">SYSTEM_FAILURE_DETECTED</h1>
          <p className="text-[#888] text-sm font-mono mb-6 max-w-md">
            {this.state.error?.message || "An unexpected error occurred in the sentinel core."}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="bg-white text-black px-6 py-2 rounded font-mono text-xs uppercase font-bold"
          >
            REBOOT_SYSTEM
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- UI Components ---

const Badge = ({ children, variant = 'low' }: { children: React.ReactNode, variant?: string }) => {
  const styles: Record<string, string> = {
    low: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
    medium: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    high: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    critical: 'bg-rose-500/10 text-rose-500 border-rose-500/20',
  };
  return (
    <span className={cn('px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border', styles[variant])}>
      {children}
    </span>
  );
};

const Card = ({ children, className, title, icon: Icon }: { children: React.ReactNode, className?: string, title?: string, icon?: any }) => (
  <div className={cn('bg-[#111111] border border-[#222222] rounded-lg overflow-hidden shadow-2xl', className)}>
    {title && (
      <div className="px-4 py-2 bg-[#161616] border-b border-[#222222] flex items-center justify-between">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={12} className="text-emerald-500" />}
          <h3 className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#666]">{title}</h3>
        </div>
        <div className="flex gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-[#222222]" />
          <div className="w-1.5 h-1.5 rounded-full bg-[#222222]" />
        </div>
      </div>
    )}
    <div className="p-4">{children}</div>
  </div>
);

// --- Main App ---

function CodeSentinel() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [fileRisks, setFileRisks] = useState<FileRisk[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<Commit | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'commits' | 'files' | 'repos' | 'team' | 'chat'>('dashboard');
  const [repos, setRepos] = useState<Repository[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) return;

    const commitsQuery = query(collection(db, 'commits'), orderBy('timestamp', 'desc'), limit(50));
    const unsubCommits = onSnapshot(commitsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data() } as Commit));
      setCommits(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'commits'));

    const fileRisksQuery = query(collection(db, 'fileRisks'), orderBy('riskScore', 'desc'), limit(20));
    const unsubFiles = onSnapshot(fileRisksQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data() } as FileRisk));
      setFileRisks(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'fileRisks'));

    const reposQuery = query(collection(db, 'repositories'), orderBy('lastAnalysis', 'desc'));
    const unsubRepos = onSnapshot(reposQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data() } as Repository));
      setRepos(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'repositories'));

    const teamQuery = query(collection(db, 'team'), orderBy('lastActive', 'desc'));
    const unsubTeam = onSnapshot(teamQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ ...doc.data() } as TeamMember));
      setTeam(data);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'team'));

    return () => {
      unsubCommits();
      unsubFiles();
      unsubRepos();
      unsubTeam();
    };
  }, [user]);

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isSendingChat) return;
    
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput,
      timestamp: new Date().toISOString()
    };
    
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsSendingChat(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...chatMessages, userMsg],
          context: {
            activeTab,
            selectedCommit,
            avgRisk: 24.5,
            criticalCommits: 2
          }
        })
      });
      const data = await res.json();
      
      const assistantMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.content,
        timestamp: new Date().toISOString()
      };
      setChatMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      toast.error("Failed to communicate with Sentinel AI");
    } finally {
      setIsSendingChat(false);
    }
  };

  const chartData = useMemo(() => {
    return [...commits].reverse().map(c => ({
      time: format(new Date(c.timestamp), 'HH:mm'),
      score: c.riskScore
    }));
  }, [commits]);

  const handleAnalyzeSimulation = async () => {
    setIsAnalyzing(true);
    const promise = new Promise(async (resolve, reject) => {
      try {
        const mockData = {
          commitMessage: "Refactor auth logic and update dependencies",
          author: user?.displayName || "Developer",
          repository: "codesentinel-core",
          codeChanges: `
            - import { verify } from 'jsonwebtoken';
            + import { verify } from 'jose';
            
            function validateToken(token) {
            -   return verify(token, process.env.SECRET);
            +   try {
            +     return verify(token, process.env.SECRET);
            +   } catch (e) {
            +     console.log("Auth failed");
            +     return null;
            +   }
            }
          `
        };

        const res = await fetch('/api/analyze-commit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mockData)
        });
        const data = await res.json();
        
        // Save to Firestore
        await addDoc(collection(db, 'commits'), {
          ...data,
          timestamp: new Date().toISOString()
        });

        setSelectedCommit(data);
        setActiveTab('commits');
        resolve(data);
      } catch (error) {
        reject(error);
      } finally {
        setIsAnalyzing(false);
      }
    });

    toast.promise(promise, {
      loading: 'ANALYZING_CODE_SENTINEL_CORE...',
      success: 'ANALYSIS_COMPLETE_RISK_SCORED',
      error: 'ANALYSIS_FAILURE_CHECK_LOGS'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center font-mono text-[#444]">
        <div className="flex flex-col items-center gap-4">
          <RefreshCw className="animate-spin text-emerald-500" size={32} />
          <p className="text-[10px] tracking-[0.4em] uppercase">Booting_Sentinel_OS</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-[#111111] border border-[#222222] p-10 rounded-2xl text-center shadow-[0_0_50px_rgba(0,0,0,0.5)]"
        >
          <div className="relative w-20 h-20 mx-auto mb-8">
            <div className="absolute inset-0 bg-emerald-500/20 blur-2xl rounded-full" />
            <div className="relative w-full h-full bg-[#161616] border border-[#222222] rounded-full flex items-center justify-center">
              <Shield className="text-emerald-500" size={36} />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-3 tracking-tight">CodeSentinel</h1>
          <p className="text-[#666] mb-10 text-sm font-mono leading-relaxed">
            AI-DRIVEN_CODE_RISK_PREVENTION_SYSTEM
            <br />
            VERSION_4.0.2_STABLE
          </p>
          <button 
            onClick={loginWithGoogle}
            className="w-full bg-emerald-500 text-black font-bold py-4 rounded-xl flex items-center justify-center gap-3 hover:bg-emerald-400 transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <Github size={20} />
            AUTHORIZE_SESSION
          </button>
          <div className="mt-8 pt-8 border-t border-[#222222] flex justify-center gap-6">
            <div className="flex flex-col items-center gap-1">
              <Cpu size={14} className="text-[#444]" />
              <span className="text-[8px] font-mono text-[#444]">AI_CORE</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Database size={14} className="text-[#444]" />
              <span className="text-[8px] font-mono text-[#444]">REALTIME_DB</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <Lock size={14} className="text-[#444]" />
              <span className="text-[8px] font-mono text-[#444]">SECURE_AUTH</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E4E3E0] font-sans selection:bg-emerald-500/30">
      <Toaster position="bottom-right" theme="dark" />
      
      {/* Sidebar */}
      <nav className="fixed left-0 top-0 bottom-0 w-20 bg-[#111111] border-r border-[#222222] flex flex-col items-center py-8 z-50">
        <div className="mb-16 relative">
          <div className="absolute inset-0 bg-emerald-500/20 blur-lg rounded-full" />
          <Shield className="text-emerald-500 relative" size={28} />
        </div>
        <div className="flex flex-col gap-10 flex-1">
          {[
            { id: 'dashboard', icon: BarChart3 },
            { id: 'commits', icon: GitCommit },
            { id: 'files', icon: FileCode },
            { id: 'repos', icon: Database },
            { id: 'team', icon: Users },
            { id: 'chat', icon: MessageSquare },
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={cn(
                'p-3 rounded-xl transition-all relative group',
                activeTab === item.id ? 'text-emerald-500 bg-emerald-500/10' : 'text-[#444] hover:text-[#888]'
              )}
            >
              <item.icon size={22} />
              {activeTab === item.id && (
                <motion.div layoutId="nav-glow" className="absolute -left-1 w-1 h-6 bg-emerald-500 rounded-full" />
              )}
              <span className="absolute left-full ml-4 px-2 py-1 bg-[#222] text-[10px] font-mono text-white rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity uppercase tracking-widest whitespace-nowrap">
                {item.id}
              </span>
            </button>
          ))}
        </div>
        <button 
          onClick={logout}
          className="p-3 text-[#444] hover:text-rose-500 transition-colors"
        >
          <LogOut size={22} />
        </button>
      </nav>

      {/* Main Content */}
      <main className="pl-20 min-h-screen">
        {/* Header */}
        <header className="h-20 border-b border-[#222222] flex items-center justify-between px-10 bg-[#0A0A0A]/80 backdrop-blur-xl sticky top-0 z-40">
          <div className="flex items-center gap-6">
            <div className="flex flex-col">
              <h2 className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#666] mb-1">
                SYSTEM_PATH / <span className="text-emerald-500">{activeTab}</span>
              </h2>
              <div className="flex items-center gap-3">
                <h1 className="text-lg font-bold text-white tracking-tight">CodeSentinel Dashboard</h1>
                <div className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded text-[9px] font-mono text-emerald-500 uppercase">
                  v4.0.2_STABLE
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <button 
              onClick={handleAnalyzeSimulation}
              disabled={isAnalyzing}
              className="group relative bg-[#161616] border border-[#222222] px-6 py-2.5 rounded-lg text-[11px] font-mono uppercase tracking-widest text-emerald-500 hover:border-emerald-500/50 transition-all disabled:opacity-50 overflow-hidden"
            >
              <div className="absolute inset-0 bg-emerald-500/5 translate-y-full group-hover:translate-y-0 transition-transform" />
              <div className="relative flex items-center gap-2">
                <Zap size={14} className={cn(isAnalyzing && 'animate-bounce')} />
                {isAnalyzing ? 'ANALYZING...' : 'SIMULATE_ANALYSIS'}
              </div>
            </button>
            <div className="h-10 w-[1px] bg-[#222222]" />
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-white font-bold">{user.displayName}</p>
                <p className="text-[9px] text-[#666] font-mono uppercase tracking-widest">SENTINEL_OPERATOR</p>
              </div>
              <div className="relative">
                <div className="absolute inset-0 bg-emerald-500/20 blur-md rounded-full" />
                <img src={user.photoURL || ''} className="w-10 h-10 rounded-full border border-[#222222] relative" referrerPolicy="no-referrer" />
              </div>
            </div>
          </div>
        </header>

        <div className="p-10 max-w-7xl mx-auto">
          {activeTab === 'dashboard' && (
            <div className="grid grid-cols-12 gap-8">
              {/* Stats */}
              <div className="col-span-12 grid grid-cols-4 gap-8">
                {[
                  { label: 'Avg Risk Score', value: '24.5', trend: '-2.4%', icon: Activity, color: 'emerald' },
                  { label: 'Critical Commits', value: '02', trend: '+0', icon: AlertTriangle, color: 'rose' },
                  { label: 'Protected Repos', value: '14', trend: '+1', icon: Shield, color: 'emerald' },
                  { label: 'Analysis Speed', value: '1.2s', trend: '-0.1s', icon: Terminal, color: 'emerald' },
                ].map((stat, i) => (
                  <Card key={i} className="group hover:border-[#333] transition-colors">
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-[9px] font-mono text-[#666] uppercase tracking-widest">{stat.label}</span>
                      <div className={cn('p-2 rounded-lg bg-[#161616] border border-[#222222] text-[#444] group-hover:text-white transition-colors')}>
                        <stat.icon size={16} />
                      </div>
                    </div>
                    <div className="flex items-baseline gap-3">
                      <span className="text-4xl font-mono tracking-tighter text-white font-bold">{stat.value}</span>
                      <div className={cn('flex items-center text-[10px] font-mono px-1.5 py-0.5 rounded', stat.trend.startsWith('+') ? 'bg-rose-500/10 text-rose-500' : 'bg-emerald-500/10 text-emerald-500')}>
                        {stat.trend}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Chart */}
              <div className="col-span-8">
                <Card title="Risk Scoring Timeline" icon={Activity}>
                  <div className="h-[350px] w-full mt-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                        <XAxis 
                          dataKey="time" 
                          stroke="#444" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                          tick={{ fill: '#666', fontFamily: 'monospace' }}
                        />
                        <YAxis 
                          stroke="#444" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false}
                          tick={{ fill: '#666', fontFamily: 'monospace' }}
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#111', border: '1px solid #222', borderRadius: '8px', fontSize: '10px', fontFamily: 'monospace' }}
                          itemStyle={{ color: '#10b981' }}
                          cursor={{ stroke: '#10b981', strokeWidth: 1 }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="score" 
                          stroke="#10b981" 
                          fillOpacity={1} 
                          fill="url(#colorScore)" 
                          strokeWidth={2}
                          animationDuration={2000}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              {/* File Risks */}
              <div className="col-span-4">
                <Card title="High Risk Files" icon={FileCode}>
                  <div className="space-y-5 mt-4">
                    {fileRisks.length > 0 ? fileRisks.map((file, i) => (
                      <div key={i} className="flex items-center justify-between group cursor-pointer p-2 rounded-lg hover:bg-[#161616] transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-[#161616] border border-[#222] rounded-lg flex items-center justify-center text-[#444] group-hover:text-emerald-500 transition-colors">
                            <FileCode size={18} />
                          </div>
                          <div>
                            <p className="text-xs font-mono text-white truncate max-w-[120px]">{file.filePath}</p>
                            <p className="text-[9px] text-[#666] font-mono uppercase tracking-widest">{file.repository}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn('text-sm font-mono font-bold', file.riskScore > 70 ? 'text-rose-500' : 'text-emerald-500')}>
                            {file.riskScore}%
                          </p>
                          <div className="w-20 h-1 bg-[#222] rounded-full mt-1.5 overflow-hidden">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${file.riskScore}%` }}
                              className={cn('h-full', file.riskScore > 70 ? 'bg-rose-500' : 'bg-emerald-500')} 
                            />
                          </div>
                        </div>
                      </div>
                    )) : (
                      <div className="h-[300px] flex flex-col items-center justify-center text-[#444] gap-3">
                        <Search size={32} className="opacity-20" />
                        <p className="text-[10px] font-mono uppercase tracking-widest">No data available</p>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'commits' && (
            <div className="grid grid-cols-12 gap-10">
              <div className="col-span-4 space-y-6">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#666]">Commit Log</h3>
                  <Filter size={14} className="text-[#444]" />
                </div>
                <div className="space-y-4 max-h-[700px] overflow-y-auto pr-2 custom-scrollbar">
                  {commits.map((commit, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => setSelectedCommit(commit)}
                      className={cn(
                        'p-5 border rounded-xl cursor-pointer transition-all relative overflow-hidden group',
                        selectedCommit?.id === commit.id 
                          ? 'bg-emerald-500/5 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]' 
                          : 'bg-[#111] border-[#222] hover:border-[#444]'
                      )}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <Badge variant={commit.riskLevel}>{commit.riskLevel}</Badge>
                        <span className="text-[10px] font-mono text-[#666]">{format(new Date(commit.timestamp), 'MMM dd, HH:mm')}</span>
                      </div>
                      <p className="text-sm text-white font-bold mb-2 line-clamp-2 leading-snug group-hover:text-emerald-400 transition-colors">{commit.message}</p>
                      <div className="flex items-center gap-3 text-[10px] text-[#666] font-mono">
                        <div className="flex items-center gap-1"><Github size={12} /> {commit.author}</div>
                        <div className="flex items-center gap-1"><Terminal size={12} /> {commit.id.substring(0, 7)}</div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="col-span-8">
                <AnimatePresence mode="wait">
                  {selectedCommit ? (
                    <motion.div
                      key={selectedCommit.id}
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                    >
                      <Card className="min-h-[700px] relative">
                        {/* Block Merge Suggestion */}
                        {selectedCommit.riskScore > 70 && (
                          <div className="absolute top-0 right-0 p-4">
                            <div className="bg-rose-500/10 border border-rose-500/20 px-4 py-2 rounded-lg flex items-center gap-3 animate-pulse">
                              <AlertTriangle className="text-rose-500" size={18} />
                              <span className="text-[11px] font-mono text-rose-500 font-bold uppercase tracking-widest">BLOCK_MERGE_SUGGESTED</span>
                            </div>
                          </div>
                        )}

                        <div className="flex justify-between items-start mb-10">
                          <div>
                            <div className="flex items-center gap-4 mb-3">
                              <h2 className="text-2xl font-bold text-white tracking-tight">{selectedCommit.message}</h2>
                              <Badge variant={selectedCommit.riskLevel}>{selectedCommit.riskLevel}</Badge>
                            </div>
                            <div className="flex items-center gap-6 text-[11px] font-mono text-[#666]">
                              <span className="flex items-center gap-2"><Github size={14} className="text-emerald-500" /> {selectedCommit.author}</span>
                              <span className="flex items-center gap-2"><GitCommit size={14} className="text-emerald-500" /> {selectedCommit.id}</span>
                              <span className="flex items-center gap-2"><Database size={14} className="text-emerald-500" /> {selectedCommit.repository}</span>
                            </div>
                          </div>
                          <div className="bg-[#161616] border border-[#222] p-4 rounded-xl text-center min-w-[120px]">
                            <p className="text-[9px] font-mono text-[#666] uppercase mb-1 tracking-widest">RISK_SCORE</p>
                            <p className={cn('text-5xl font-mono font-bold tracking-tighter', 
                              selectedCommit.riskScore > 70 ? 'text-rose-500' : 
                              selectedCommit.riskScore > 40 ? 'text-orange-500' : 'text-emerald-500'
                            )}>
                              {selectedCommit.riskScore}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-10 mb-10">
                          <div className="space-y-8">
                            <div>
                              <div className="flex items-center gap-2 mb-4">
                                <Cpu size={14} className="text-emerald-500" />
                                <h4 className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#666]">AI_CORE_ANALYSIS</h4>
                              </div>
                              <div className="prose prose-invert prose-sm max-w-none text-[#AAA] leading-relaxed font-sans bg-[#161616] p-6 rounded-xl border border-[#222]">
                                <ReactMarkdown>{selectedCommit.analysis || 'No detailed analysis available.'}</ReactMarkdown>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-8">
                            <div>
                              <div className="flex items-center gap-2 mb-4">
                                <AlertCircle size={14} className="text-rose-500" />
                                <h4 className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#666]">PREDICTED_VULNERABILITIES</h4>
                              </div>
                              <div className="space-y-3">
                                {selectedCommit.predictedBugs?.map((bug, i) => (
                                  <motion.div 
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    key={i} 
                                    className="flex items-start gap-3 p-3 bg-rose-500/5 border border-rose-500/10 rounded-lg text-[12px] text-[#AAA] group hover:bg-rose-500/10 transition-colors"
                                  >
                                    <AlertTriangle size={16} className="text-rose-500 mt-0.5 shrink-0" />
                                    {bug}
                                  </motion.div>
                                ))}
                                {(!selectedCommit.predictedBugs || selectedCommit.predictedBugs.length === 0) && (
                                  <div className="flex items-center gap-3 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-lg text-[12px] text-[#AAA]">
                                    <CheckCircle size={18} className="text-emerald-500 shrink-0" />
                                    No immediate vulnerabilities detected by Sentinel AI.
                                  </div>
                                )}
                              </div>
                            </div>
                            <div>
                              <div className="flex items-center gap-2 mb-4">
                                <Zap size={14} className="text-emerald-500" />
                                <h4 className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#666]">REMEDIATION_STEPS</h4>
                              </div>
                              <div className="space-y-3">
                                {selectedCommit.recommendations?.map((rec, i) => (
                                  <motion.div 
                                    initial={{ opacity: 0, x: 10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    key={i} 
                                    className="flex items-start gap-3 p-3 bg-emerald-500/5 border border-emerald-500/10 rounded-lg text-[12px] text-[#AAA] group hover:bg-emerald-500/10 transition-colors"
                                  >
                                    <ChevronRight size={16} className="text-emerald-500 mt-0.5 shrink-0" />
                                    {rec}
                                  </motion.div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-[#222] pt-8">
                          <div className="flex items-center gap-2 mb-4">
                            <FileCode size={14} className="text-[#666]" />
                            <h4 className="text-[10px] font-mono uppercase tracking-[0.3em] text-[#666]">IMPACTED_MODULES</h4>
                          </div>
                          <div className="flex flex-wrap gap-3">
                            {selectedCommit.files?.map((file, i) => (
                              <div key={i} className="flex items-center gap-2 px-3 py-1.5 bg-[#161616] border border-[#222] rounded text-[11px] font-mono text-[#888] hover:text-white hover:border-emerald-500/30 transition-all cursor-pointer">
                                <Terminal size={12} />
                                {file}
                              </div>
                            ))}
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  ) : (
                    <div className="h-[700px] flex flex-col items-center justify-center text-[#444] border border-dashed border-[#222] rounded-2xl bg-[#0C0C0C]">
                      <div className="w-20 h-20 bg-[#111] border border-[#222] rounded-full flex items-center justify-center mb-6">
                        <GitCommit size={40} className="opacity-20" />
                      </div>
                      <p className="text-[11px] font-mono uppercase tracking-[0.4em]">Select_Commit_For_Deep_Analysis</p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {activeTab === 'files' && (
            <div className="space-y-10">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <h3 className="text-2xl font-bold text-white tracking-tight">Codebase Risk Heatmap</h3>
                  <p className="text-sm text-[#666] font-mono mt-1 uppercase tracking-widest">Visualizing_File_Volatility_Index</p>
                </div>
                <div className="flex gap-6 p-4 bg-[#111] border border-[#222] rounded-xl text-[10px] font-mono uppercase tracking-widest">
                  <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-emerald-500/40 rounded-sm" /> Stable</div>
                  <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-amber-500 rounded-sm" /> Warning</div>
                  <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 bg-rose-500 rounded-sm" /> Critical</div>
                </div>
              </div>
              <Card className="p-8">
                <div className="grid grid-cols-20 gap-2">
                  {Array.from({ length: 200 }).map((_, i) => {
                    const score = Math.floor(Math.random() * 100);
                    return (
                      <motion.div 
                        key={i} 
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.005 }}
                        className={cn(
                          'aspect-square rounded-sm transition-all hover:scale-150 hover:z-10 cursor-crosshair shadow-lg',
                          score > 85 ? 'bg-rose-500 shadow-rose-500/20' : 
                          score > 60 ? 'bg-orange-500 shadow-orange-500/20' : 
                          score > 35 ? 'bg-amber-500 shadow-amber-500/20' : 'bg-emerald-500/30'
                        )}
                        title={`File: src/core/module_${i}.ts\nRisk: ${score}%\nLast Modified: 2h ago`}
                      />
                    );
                  })}
                </div>
                <div className="mt-12 grid grid-cols-4 gap-4 text-[10px] font-mono text-[#444] uppercase tracking-[0.3em] text-center">
                  <div className="border-t border-[#222] pt-4">src/components</div>
                  <div className="border-t border-[#222] pt-4">src/lib/core</div>
                  <div className="border-t border-[#222] pt-4">src/services/ai</div>
                  <div className="border-t border-[#222] pt-4">src/hooks/auth</div>
                </div>
              </Card>

              <div className="grid grid-cols-3 gap-8">
                <Card title="Volatility Index" icon={Activity}>
                  <div className="flex flex-col items-center justify-center py-10">
                    <div className="text-5xl font-mono font-bold text-white mb-2 tracking-tighter">14.2</div>
                    <p className="text-[10px] font-mono text-emerald-500 uppercase tracking-widest">STABLE_TREND</p>
                  </div>
                </Card>
                <Card title="Code Coverage" icon={Cpu}>
                  <div className="flex flex-col items-center justify-center py-10">
                    <div className="text-5xl font-mono font-bold text-white mb-2 tracking-tighter">92%</div>
                    <p className="text-[10px] font-mono text-emerald-500 uppercase tracking-widest">OPTIMAL_HEALTH</p>
                  </div>
                </Card>
                <Card title="Open Vulnerabilities" icon={AlertCircle}>
                  <div className="flex flex-col items-center justify-center py-10">
                    <div className="text-5xl font-mono font-bold text-rose-500 mb-2 tracking-tighter">03</div>
                    <p className="text-[10px] font-mono text-rose-500 uppercase tracking-widest">ACTION_REQUIRED</p>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {activeTab === 'repos' && (
            <div className="space-y-8">
              <div className="flex flex-col">
                <h3 className="text-2xl font-bold text-white tracking-tight">Monitored Repositories</h3>
                <p className="text-sm text-[#666] font-mono mt-1 uppercase tracking-widest">ACTIVE_SENTINEL_WATCHLIST</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {repos.length > 0 ? repos.map((repo) => (
                  <Card key={repo.id} className="group hover:border-emerald-500/30 transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500">
                        <Database size={18} />
                      </div>
                      <Badge variant={repo.status === 'active' ? 'success' : 'warning'}>{repo.status}</Badge>
                    </div>
                    <h4 className="text-lg font-bold text-white mb-1">{repo.name}</h4>
                    <p className="text-xs text-[#666] font-mono mb-6 uppercase tracking-widest">{repo.owner}</p>
                    
                    <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#222]">
                      <div>
                        <p className="text-[9px] font-mono text-[#444] uppercase tracking-widest mb-1">Avg Risk</p>
                        <p className={cn("text-lg font-mono font-bold", repo.avgRisk > 50 ? "text-rose-500" : "text-emerald-500")}>
                          {repo.avgRisk}%
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] font-mono text-[#444] uppercase tracking-widest mb-1">Commits</p>
                        <p className="text-lg font-mono font-bold text-white">{repo.commitCount}</p>
                      </div>
                    </div>
                  </Card>
                )) : (
                  <div className="col-span-full py-20 text-center border border-dashed border-[#222] rounded-2xl text-[#444] font-mono text-xs uppercase tracking-widest">
                    NO_REPOSITORIES_CONFIGURED
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'team' && (
            <div className="space-y-8">
              <div className="flex flex-col">
                <h3 className="text-2xl font-bold text-white tracking-tight">Security Team</h3>
                <p className="text-sm text-[#666] font-mono mt-1 uppercase tracking-widest">AUTHORIZED_SENTINEL_OPERATORS</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {team.map((member) => (
                  <Card key={member.uid} className="flex flex-col items-center text-center p-8">
                    <div className="relative mb-4">
                      <div className="absolute inset-0 bg-emerald-500/20 blur-md rounded-full" />
                      <img src={member.photoURL} className="w-16 h-16 rounded-full border border-[#222] relative" referrerPolicy="no-referrer" />
                    </div>
                    <h4 className="text-white font-bold mb-1">{member.displayName}</h4>
                    <p className="text-[10px] font-mono text-[#666] uppercase tracking-widest mb-4">{member.email}</p>
                    <Badge variant={member.role === 'admin' ? 'danger' : 'success'}>{member.role}</Badge>
                    <div className="mt-6 pt-6 border-t border-[#222] w-full">
                      <p className="text-[9px] font-mono text-[#444] uppercase tracking-widest">Last Active</p>
                      <p className="text-[10px] font-mono text-white mt-1">{format(new Date(member.lastActive), 'MMM dd, HH:mm')}</p>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="h-[calc(100vh-180px)] flex flex-col">
              <div className="flex flex-col mb-6">
                <h3 className="text-2xl font-bold text-white tracking-tight">Sentinel AI Assistant</h3>
                <p className="text-sm text-[#666] font-mono mt-1 uppercase tracking-widest">DIRECT_NEURAL_INTERFACE_ACTIVE</p>
              </div>
              
              <Card className="flex-1 flex flex-col p-0 overflow-hidden border-[#222]">
                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
                  {chatMessages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-[#444] opacity-50">
                      <MessageSquare size={48} className="mb-4" />
                      <p className="text-[11px] font-mono uppercase tracking-[0.4em]">Initialize_Neural_Link_To_Begin</p>
                    </div>
                  )}
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className={cn("flex gap-4", msg.role === 'user' ? "flex-row-reverse" : "flex-row")}>
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border",
                        msg.role === 'user' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" : "bg-[#161616] border-[#222] text-white"
                      )}>
                        {msg.role === 'user' ? <User size={20} /> : <Bot size={20} />}
                      </div>
                      <div className={cn(
                        "max-w-[80%] p-4 rounded-2xl text-sm leading-relaxed",
                        msg.role === 'user' ? "bg-emerald-500 text-black font-medium" : "bg-[#161616] text-[#AAA] border border-[#222]"
                      )}>
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                        <p className={cn("text-[9px] mt-2 opacity-50 font-mono", msg.role === 'user' ? "text-black" : "text-[#666]")}>
                          {format(new Date(msg.timestamp), 'HH:mm:ss')}
                        </p>
                      </div>
                    </div>
                  ))}
                  {isSendingChat && (
                    <div className="flex gap-4">
                      <div className="w-10 h-10 rounded-lg bg-[#161616] border border-[#222] flex items-center justify-center text-white shrink-0">
                        <Bot size={20} className="animate-pulse" />
                      </div>
                      <div className="bg-[#161616] border border-[#222] p-4 rounded-2xl flex gap-1">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" />
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="p-6 bg-[#0C0C0C] border-t border-[#222]">
                  <div className="relative">
                    <input 
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="Ask Sentinel AI about code risks, vulnerabilities, or system status..."
                      className="w-full bg-[#111] border border-[#222] rounded-xl py-4 pl-6 pr-16 text-sm text-white placeholder-[#444] focus:outline-none focus:border-emerald-500/50 transition-all font-mono"
                    />
                    <button 
                      onClick={handleSendMessage}
                      disabled={!chatInput.trim() || isSendingChat}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-emerald-500 text-black rounded-lg hover:bg-emerald-400 transition-all disabled:opacity-50 disabled:hover:bg-emerald-500"
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #222;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #333;
        }
      `}</style>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <CodeSentinel />
    </ErrorBoundary>
  );
}
