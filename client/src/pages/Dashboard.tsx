import { Link } from "wouter";
import { Infinity as InfinityIcon, LogOut, Activity, BarChart3, Settings } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-mesh text-foreground p-6">
      <nav className="flex items-center justify-between max-w-7xl mx-auto bg-card/50 backdrop-blur-md border border-white/10 rounded-2xl px-6 py-4 shadow-xl">
        <div className="flex items-center gap-3">
          <InfinityIcon className="w-8 h-8 text-purple-500" strokeWidth={2.5} />
          <span className="text-xl font-display font-bold tracking-widest uppercase">RCiQ-AI</span>
        </div>
        
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-white/60">
          <span className="text-white cursor-pointer transition-colors">Overview</span>
          <span className="hover:text-white cursor-pointer transition-colors">Analytics</span>
          <span className="hover:text-white cursor-pointer transition-colors">Patterns</span>
        </div>

        <Link href="/" className="flex items-center gap-2 text-sm font-medium text-white/50 hover:text-white transition-colors bg-white/5 px-4 py-2 rounded-lg">
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Logout</span>
        </Link>
      </nav>

      <main className="max-w-7xl mx-auto mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <header className="mb-8">
            <h1 className="text-4xl font-display font-bold mb-2">Your property intelligence hub.</h1>
            <p className="text-white/50">Explore Hyderabad projects, areas and AI-backed insights.</p>
          </header>
          
          <div className="bg-card/50 backdrop-blur-md border border-white/10 rounded-3xl p-8 h-64 flex flex-col items-center justify-center text-white/30 border-dashed">
            <Activity className="w-12 h-12 mb-4 opacity-50" />
              <p>Your property watchlist is ready.</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-gradient-to-br from-purple-500/20 to-transparent border border-purple-500/30 rounded-3xl p-6">
            <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
              <BarChart3 className="text-purple-400 w-5 h-5" />
              Quick Stats
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <span className="text-white/50">Market Match</span>
                <span className="font-mono text-green-400 font-semibold">94%</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/5 pb-4">
                <span className="text-white/50">Saved Projects</span>
                <span className="font-mono font-semibold">0</span>
              </div>
            </div>
          </div>

          <div className="bg-card/40 backdrop-blur-md border border-white/10 rounded-3xl p-6 flex items-center gap-4 hover:bg-card/60 transition-colors cursor-pointer group">
            <div className="bg-white/5 p-3 rounded-xl group-hover:bg-white/10 transition-colors">
              <Settings className="w-6 h-6 text-white/70" />
            </div>
            <div>
                <h4 className="font-semibold text-sm">Configure your search</h4>
                <p className="text-xs text-white/40 mt-1">Set areas, budget and property preferences</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
