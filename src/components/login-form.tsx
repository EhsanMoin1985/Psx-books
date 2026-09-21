'use client';

import { useState } from 'react';
import { btnPrimary, btnPrimaryStyle, Note } from './ui';
import { supabaseBrowser } from '@/lib/supabase/browser';

export function LoginForm({ next = '/' }: { next?: string }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState('');

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        const db = supabaseBrowser();
        if (!db) return;
        setState('sending');
        const { error } = await db.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          },
        });
        if (error) {
          setState('error');
          setMessage(error.message);
        } else {
          setState('sent');
        }
      }}
    >
      <label className="block text-[11px] uppercase tracking-wider" style={{ color: 'var(--ink-3)' }}>
        Email address
        <input
          type="email"
          required
          autoComplete="email"
          className="mt-1 text-[13px] normal-case"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      <button type="submit" className={btnPrimary} style={btnPrimaryStyle} disabled={state === 'sending' || state === 'sent'}>
        {state === 'sending' ? 'Sending…' : state === 'sent' ? 'Link sent' : 'Email me a sign-in link'}
      </button>
      {state === 'sent' && (
        <Note>
          Check your inbox. Open the link in this browser, on this device: the sign-in flow cannot carry across to
          another one.
        </Note>
      )}
      {state === 'error' && <Note tone="warn">{message}</Note>}
    </form>
  );
}
