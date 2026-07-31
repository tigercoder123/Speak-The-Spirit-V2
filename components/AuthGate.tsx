'use client';

import React, { useState } from 'react';
import { useGame } from '../context/GameContext';
import { supabase } from '../services/supabaseService';

export default function AuthGate() {
  const { shakeTrigger, triggerShake, startDemo } = useGame();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [feedback, setFeedback] = useState('');

  const processAuthError = (error: unknown) => {
    console.info("Auth info:", error);
    const errorMessage = error instanceof Error ? error.message : "Oops! Something went wrong. Try again!";
    setIsError(true);
    setFeedback(errorMessage);
    triggerShake();
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setFeedback('');
    setIsError(false);
    
    if (password.length < 6) {
      setIsError(true);
      setFeedback("Secret passwords must be at least 6 characters long! 🛡️");
      triggerShake();
      return;
    }

    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) {
          processAuthError(error);
        } else {
          setIsError(false);
          setFeedback("Account created! Please check your email to confirm. ✨");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          processAuthError(error);
        } else {
          setIsError(false);
          setFeedback("Welcome back to the Valley! 🚀");
        }
      }
    } catch (error: unknown) {
      processAuthError(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`w-full max-w-md mx-auto my-12 p-8 bg-slate-800 border-4 border-black rounded-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] ${shakeTrigger ? 'animate-shake-box' : ''}`}>
      <div className="text-center mb-8">
        <span className="text-6xl animate-bounce inline-block mb-3">🛡️</span>
        <h2 className="text-3xl font-black text-yellow-400 tracking-wider uppercase">Speak The Spirit</h2>
        <p className="text-xs text-slate-400 font-semibold uppercase mt-2">Valley Gate Authorization</p>
      </div>

      <form onSubmit={handleAuth} className="space-y-6">
        <div className="bg-slate-900/80 p-6 border-3 border-black rounded-xl shadow-[3px_3px_0px_#000]">
          <div className="flex items-center justify-center gap-2 mb-4">
            <span className="text-2xl">✨</span>
            <h3 className="font-extrabold text-sm text-cyan-400 uppercase tracking-wide">
              {isSignUp ? 'Create Your Hero Account' : 'Return to the Valley'}
            </h3>
          </div>
          
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Spirit Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="hero@example.com"
                className="w-full bg-slate-800 border-2 border-black p-3 rounded-lg text-white placeholder-slate-600 focus:ring-2 focus:ring-yellow-400 outline-none transition-all font-medium"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1 ml-1">Secret Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-800 border-2 border-black p-3 rounded-lg text-white placeholder-slate-600 focus:ring-2 focus:ring-yellow-400 outline-none transition-all font-medium"
                required
              />
            </div>
          </div>

          {feedback && (
            <div className={`mb-6 p-3 border-2 text-xs font-bold rounded-lg text-center animate-bounce ${
              isError 
                ? 'bg-red-500/20 border-red-500 text-red-200' 
                : 'bg-green-500/20 border-green-500 text-green-200'
            }`}>
              {feedback}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-indigo-600 via-pink-500 to-yellow-500 hover:brightness-110 disabled:grayscale text-white font-black text-sm uppercase py-4 rounded-lg border-2 border-black neo-btn transition-all"
          >
            {loading ? 'Connecting...' : isSignUp ? '🚀 Create Account' : '🚀 Enter Valley'}
          </button>
        </div>
      </form>

      <div className="mt-6 flex items-center gap-3">
        <span className="h-[2px] flex-1 bg-slate-700"></span>
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Or</span>
        <span className="h-[2px] flex-1 bg-slate-700"></span>
      </div>

      <button
        type="button"
        onClick={startDemo}
        className="w-full mt-6 bg-yellow-400 hover:brightness-110 text-black font-black text-sm uppercase py-4 rounded-lg border-2 border-black neo-btn transition-all"
      >
        🎬 Watch the Demo
      </button>

      <div className="mt-6 text-center">
        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="text-xs font-bold text-cyan-400 hover:text-cyan-300 underline underline-offset-4 transition-colors"
        >
          {isSignUp ? "Already a hero? Sign In" : "New to the Valley? Create Account"}
        </button>
      </div>

      <div className="mt-8 text-[10px] text-center text-slate-500 font-bold leading-normal">
        🔐 Secure Gateway enabled. Your treasures are safe with Supabase.
      </div>
    </div>
  );
}
