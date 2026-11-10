'use client';

import Link from 'next/link';
import { type FormEvent, type KeyboardEvent, type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react';
import { SITE } from '@/data/site';
import { type Inline, parseChat } from '@/lib/chat/markup';
import { CHAT_LIMITS, type ChatEvent, firstName, TRANSCRIPT_LIMITS } from '@/lib/chat/shared';
import { trackMeta } from '@/lib/meta-pixel';
import { type Guest, LeadForm } from './LeadForm';

/**
 * Floating "Chat" button and panel. The guest leaves their name, email and
 * phone first (emailed to the host by /api/chat/lead); replies then stream
 * from /api/chat, which calls Claude on the server, so this file never sees
 * an API key. When the guest closes the chat or leaves the page, the
 * conversation so far is emailed to the host (/api/chat/transcript).
 *
 * The conversation is kept in sessionStorage (it survives a reload), the
 * guest's details in localStorage (they aren't asked again next visit).
 */

type Msg = { role: 'user' | 'assistant'; text: string; failed?: boolean };

const STORAGE_KEY = 'wk-chat-v1';
const GUEST_KEY = 'wk-chat-guest-v1';
/** How many messages have already been emailed, so leaving twice doesn't resend. */
const SENT_KEY = 'wk-chat-sent-v1';
const GREETING_ASK =
  'Hi! I can help you choose a home, answer questions and check live prices for your dates. First, how can we reach you? Our team can follow up if you need more help.';
const greeting = (name: string) =>
  `Hi ${firstName(name)}! I can help you choose a home, answer questions and check live prices for your dates. When are you thinking of coming, and how many guests?`;
const SUGGESTIONS = ['Which home fits 16 guests?', 'Check prices for my dates', 'Which homes take dogs?', 'What’s near Camelback?'];

const tel = SITE.contactPhone.replace(/[^\d+]/g, '');

/** What the API gets: completed exchanges only, trimmed from the start to fit the limits. */
function historyFor(messages: Msg[], next: string): { role: Msg['role']; content: string }[] {
  const turns = messages.filter((m) => !m.failed && m.text.trim()).map((m) => ({ role: m.role, content: m.text }));
  turns.push({ role: 'user', content: next });
  const size = () => turns.reduce((n, t) => n + t.content.length, 0);
  while (turns.length > 1 && (turns.length > CHAT_LIMITS.messages || size() > CHAT_LIMITS.totalChars)) turns.splice(0, 2);
  return turns;
}

const store = {
  get<T>(storage: () => Storage, key: string): T | null {
    try {
      return JSON.parse(storage().getItem(key) ?? 'null') as T | null;
    } catch {
      return null;
    }
  },
  set(storage: () => Storage, key: string, value: unknown) {
    try {
      storage().setItem(key, JSON.stringify(value));
    } catch {
      // Storage blocked: the chat still works, it just isn't remembered.
    }
  },
};
const session = () => sessionStorage;
const local = () => localStorage;

/** The conversation for the host's email: finished messages, the oldest dropped to fit. */
function transcriptOf(messages: Msg[], busy: boolean) {
  const turns = messages.filter((m) => !m.failed && m.text.trim()).map((m) => ({ role: m.role, content: m.text }));
  // A reply still being written is left for the next email.
  if (busy && turns.at(-1)?.role === 'assistant') turns.pop();
  const size = () => turns.reduce((n, t) => n + t.content.length, 0);
  while (turns.length > 2 && (turns.length > TRANSCRIPT_LIMITS.messages || size() > TRANSCRIPT_LIMITS.totalChars)) turns.splice(0, 2);
  return turns;
}

function renderInline(parts: Inline[], onInternal: () => void): ReactNode[] {
  return parts.map((part, i) => {
    if (part.type === 'strong') return <strong key={i}>{part.text}</strong>;
    if (part.type === 'link') {
      return part.internal ? (
        <Link key={i} href={part.href} onClick={onInternal}>
          {part.text}
        </Link>
      ) : (
        <a key={i} href={part.href}>
          {part.text}
        </a>
      );
    }
    return part.text;
  });
}

function MessageBody({ text, onInternal }: { text: string; onInternal: () => void }) {
  return parseChat(text).map((block, i) =>
    block.type === 'ul' ? (
      <ul key={i}>
        {block.items.map((item, j) => (
          <li key={j}>{renderInline(item, onInternal)}</li>
        ))}
      </ul>
    ) : (
      <p key={i}>
        {block.lines.map((line, j) => (
          <span key={j}>
            {j > 0 ? <br /> : null}
            {renderInline(line, onInternal)}
          </span>
        ))}
      </p>
    ),
  );
}

function ChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.6A8 8 0 1 1 21 12Z" />
    </svg>
  );
}

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [guest, setGuest] = useState<Guest | null>(null);
  const hasToken = Boolean(guest?.token);
  const titleId = useId();
  const panelId = useId();
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Set once the saved conversation has been read, so saving can't overwrite it first.
  const restoredRef = useRef(false);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (busy || !restoredRef.current) return;
    store.set(session, STORAGE_KEY, messages);
  }, [messages, busy]);

  // Latest state for the page-leave handlers below.
  const latest = useRef({ messages, busy, guest, sent: 0 });
  useEffect(() => {
    latest.current = { ...latest.current, messages, busy, guest };
  }, [messages, busy, guest]);

  /** Emails the host the conversation so far, if there's anything new since the last time. */
  const sendTranscript = useCallback(() => {
    const { messages, busy, guest, sent } = latest.current;
    if (!guest?.token) return;
    const turns = transcriptOf(messages, busy);
    const count = messages.filter((m) => !m.failed && m.text.trim()).length;
    if (!turns.some((t) => t.role === 'user') || count <= sent) return;
    const body = JSON.stringify({ lead: guest.token, page: window.location.pathname + window.location.search, messages: turns });
    // sendBeacon survives the page closing; fall back to a keepalive fetch.
    const queued = navigator.sendBeacon?.('/api/chat/transcript', new Blob([body], { type: 'application/json' }));
    if (!queued) {
      void fetch('/api/chat/transcript', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
    }
    latest.current.sent = count;
    store.set(session, SENT_KEY, count);
  }, []);

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden') sendTranscript();
    };
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', sendTranscript);
    return () => {
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', sendTranscript);
    };
  }, [sendTranscript]);

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [messages, status, open]);

  useEffect(() => {
    if (open) (hasToken ? inputRef : nameRef).current?.focus();
  }, [open, hasToken]);

  function openChat() {
    if (!restoredRef.current) {
      restoredRef.current = true;
      const saved = store.get<Msg[]>(session, STORAGE_KEY);
      if (Array.isArray(saved)) setMessages(saved.filter((m) => m && typeof m.text === 'string' && (m.role === 'user' || m.role === 'assistant')));
      const savedGuest = store.get<Guest>(local, GUEST_KEY);
      if (savedGuest && typeof savedGuest.name === 'string') setGuest(savedGuest);
      latest.current.sent = Number(store.get<number>(session, SENT_KEY)) || 0;
    }
    setOpen(true);
  }

  function onLead(next: Guest) {
    setGuest(next);
    store.set(local, GUEST_KEY, next);
    trackMeta('Lead');
  }

  // Closing with the X or Escape puts focus back on the button (once it's shown again).
  const returnFocusRef = useRef(false);
  useEffect(() => {
    if (open || !returnFocusRef.current) return;
    returnFocusRef.current = false;
    launcherRef.current?.focus();
  }, [open]);

  const close = useCallback(() => {
    returnFocusRef.current = true;
    setOpen(false);
    sendTranscript();
  }, [sendTranscript]);

  // On a phone the panel covers the page, so following a link closes it.
  const onInternalLink = useCallback(() => {
    if (window.matchMedia('(max-width: 600px)').matches) setOpen(false);
  }, []);

  const updateLast = (fn: (m: Msg) => Msg) => setMessages((ms) => (ms.length ? [...ms.slice(0, -1), fn(ms[ms.length - 1]!)] : ms));

  async function send(raw: string) {
    const text = raw.trim().slice(0, CHAT_LIMITS.messageChars);
    const token = guest?.token;
    if (!text || busy || !token) return;
    const history = historyFor(messages, text);
    setInput('');
    setBusy(true);
    setStatus(null);
    setMessages((ms) => [...ms, { role: 'user', text }, { role: 'assistant', text: '' }]);

    const fail = (message: string) => {
      setMessages((ms) =>
        ms.length >= 2 ? [...ms.slice(0, -2), { ...ms[ms.length - 2]!, failed: true }, { role: 'assistant', text: message, failed: true }] : ms,
      );
    };

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead: token, messages: history }),
        signal: controller.signal,
      });
      if (res.status === 401) {
        // The saved details are no longer accepted (e.g. expired): ask again, pre-filled.
        const again = { ...guest, token: null };
        setGuest(again);
        store.set(local, GUEST_KEY, again);
        fail('Please confirm your details to keep chatting.');
        return;
      }
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        fail(body.error || 'The assistant couldn’t answer just now. Please try again, or contact us directly.');
        return;
      }

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buffer = '';
      let reply = '';
      let mark = 0;
      let finished = false;
      while (!finished) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += value;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as ChatEvent;
          if (event.type === 'turn') mark = reply.length;
          else if (event.type === 'text') {
            reply += event.text;
            setStatus(null);
          } else if (event.type === 'reset') reply = reply.slice(0, mark);
          else if (event.type === 'status') setStatus(event.text);
          else if (event.type === 'error') {
            fail(event.message);
            return;
          } else if (event.type === 'done') finished = true;
          if (event.type === 'text' || event.type === 'reset') updateLast((m) => ({ ...m, text: reply }));
        }
      }
      if (!finished || !reply.trim()) fail('The connection dropped before the answer finished. Please try again.');
    } catch (err) {
      if (!controller.signal.aborted) fail('Couldn’t reach the assistant. Check your connection and try again.');
      else if (err instanceof Error && err.name !== 'AbortError') console.error(err);
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setBusy(false);
      setStatus(null);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(input);
    }
  }

  function restart() {
    abortRef.current?.abort();
    sendTranscript();
    latest.current.sent = 0;
    store.set(session, SENT_KEY, 0);
    setMessages([]);
    setInput('');
    inputRef.current?.focus();
  }

  const last = messages[messages.length - 1];
  // Typing dots until the first words arrive; the tool status whenever one is running.
  const waiting = busy && last?.role === 'assistant' && (!last.text || Boolean(status));

  return (
    <>
      <button
        ref={launcherRef}
        type="button"
        className="chat-launcher"
        aria-expanded={open}
        aria-controls={panelId}
        hidden={open}
        onClick={openChat}
      >
        <ChatIcon />
        <span className="chat-launcher-label">Questions? Chat</span>
      </button>

      <section
        id={panelId}
        className="chat-panel"
        role="dialog"
        aria-labelledby={titleId}
        hidden={!open}
        onKeyDown={(e) => {
          if (e.key === 'Escape') close();
        }}
      >
        <header className="chat-head">
          <div>
            <div id={titleId} className="chat-title">
              {SITE.brand} concierge
            </div>
            <div className="chat-sub">AI assistant · usually answers in seconds</div>
          </div>
          <div className="chat-head-actions">
            {messages.length ? (
              <button type="button" className="chat-text-btn" onClick={restart}>
                New chat
              </button>
            ) : null}
            <button type="button" className="chat-icon-btn" aria-label="Close chat" onClick={close}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
          </div>
        </header>

        <div ref={logRef} className="chat-log" aria-live="polite" aria-busy={busy}>
          <div className="chat-msg assistant">
            <p>{guest && hasToken ? greeting(guest.name) : GREETING_ASK}</p>
          </div>
          {!hasToken ? <LeadForm key={guest?.email ?? 'new'} initial={guest} nameRef={nameRef} onDone={onLead} /> : null}
          {hasToken && messages.length === 0 ? (
            <div className="chat-suggest">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="chat-chip" onClick={() => void send(s)}>
                  {s}
                </button>
              ))}
            </div>
          ) : null}
          {messages.map((m, i) =>
            m.text ? (
              <div key={i} className={`chat-msg ${m.role}${m.failed && m.role === 'assistant' ? ' failed' : ''}`}>
                {m.role === 'assistant' ? <MessageBody text={m.text} onInternal={onInternalLink} /> : <p>{m.text}</p>}
              </div>
            ) : null,
          )}
          {waiting ? (
            <div className="chat-status" role="status">
              {status ?? (
                <span className="chat-typing" aria-label="Typing">
                  <i />
                  <i />
                  <i />
                </span>
              )}
            </div>
          ) : null}
        </div>

        <form className="chat-form" onSubmit={onSubmit} hidden={!hasToken}>
          <textarea
            ref={inputRef}
            className="chat-input"
            rows={1}
            value={input}
            maxLength={CHAT_LIMITS.messageChars}
            placeholder="Ask about homes, dates or prices"
            aria-label="Your message"
            enterKeyHint="send"
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <button type="submit" className="chat-send" aria-label="Send" disabled={busy || !input.trim()}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M13 6l6 6-6 6" />
            </svg>
          </button>
        </form>
        <p className="chat-foot">
          AI answers can be wrong; the booking page shows the final price. Prefer a person? <a href={`sms:${tel}`}>Text</a> ·{' '}
          <a href={`tel:${tel}`}>Call</a> · <a href={`mailto:${SITE.contactEmail}`}>Email</a>
        </p>
      </section>
    </>
  );
}
