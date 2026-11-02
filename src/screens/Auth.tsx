import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useApp } from '../store';
import { BrandMark, Button, Field, Icon } from '../ui';

const SCHOOLS = [
  'Lincoln High',
  'Northside High',
  'Roosevelt High',
  'City College — Culinary',
  'State Polytechnic',
  'State University',
];

export default function Auth() {
  const { login, signup } = useApp();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [form, setForm] = useState({
    name: '',
    handle: '',
    pin: '',
    highSchool: '',
    college: '',
    gradYear: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demo, setDemo] = useState(false);

  const set = (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'in') {
        await login(form.handle.trim().replace(/^@/, '').toLowerCase(), form.pin);
      } else {
        await signup({
          name: form.name,
          handle: form.handle,
          pin: form.pin,
          highSchool: form.highSchool,
          college: form.college,
          gradYear: form.gradYear,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function tryDemo() {
    setDemo(true);
    setError(null);
    try {
      await login('maya', '1111');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The demo circle is not available right now.');
    } finally {
      setDemo(false);
    }
  }

  return (
    <div className="auth">
      <section className="auth-hero">
        <div>
          <div className="brand">
            <BrandMark size={40} />
            <div>
              <div className="brand-name" style={{ fontSize: '1.5rem' }}>
                Northlight
              </div>
              <div className="brand-sub">a place to be known, not tracked</div>
            </div>
          </div>
          <h1 className="auth-tagline" style={{ marginTop: 26 }}>
            Your spot, your people, your next step.
          </h1>
          <p className="auth-lede">
            Northlight is built with people who have slept outside. Share only what you choose. Find hot
            food, water and a bed. Add family and the friends you lost touch with. Keep a list of what you
            need — and what you want.
          </p>
        </div>

        <div className="auth-points">
          <div className="auth-point">
            <span className="auth-point-icon">
              <Icon name="pin" size={18} />
            </span>
            <span>
              <b>Your location has an off switch.</b> When sharing is off, nobody sees where you are — and
              your last known spot is kept just for you.
            </span>
          </div>
          <div className="auth-point">
            <span className="auth-point-icon">
              <Icon name="users" size={18} />
            </span>
            <span>
              <b>Only your circle sees your spot.</b> Not the public, not an algorithm. You accept every
              person yourself.
            </span>
          </div>
          <div className="auth-point">
            <span className="auth-point-icon">
              <Icon name="lock" size={18} />
            </span>
            <span>
              <b>No email, no phone, no ID.</b> A handle and a 4-digit PIN. Nothing here can be used to find
              you unless you share it.
            </span>
          </div>
        </div>

        <blockquote className="auth-quote">
          “I lost my apartment in March. What I have learned is that the people who help you fastest are the
          ones who have been there.”
          <span>Maya O. — line cook, Northlight member</span>
        </blockquote>
      </section>

      <section className="auth-card-wrap">
        <div className="auth-card">
          <div className="auth-switch" role="tablist" aria-label="Sign in or create an account">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'in'}
              className={mode === 'in' ? 'is-active' : ''}
              onClick={() => {
                setMode('in');
                setError(null);
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'up'}
              className={mode === 'up' ? 'is-active' : ''}
              onClick={() => {
                setMode('up');
                setError(null);
              }}
            >
              Create account
            </button>
          </div>

          <form className="stack" onSubmit={submit}>
            {mode === 'up' ? (
              <Field label="What should we call you?" htmlFor="name">
                <input
                  id="name"
                  className="input"
                  value={form.name}
                  onChange={set('name')}
                  placeholder="Maya Ortiz"
                  autoComplete="given-name"
                  required
                />
              </Field>
            ) : null}

            <Field label="Handle" htmlFor="handle" hint="Letters and numbers. No real name needed.">
              <input
                id="handle"
                className="input"
                value={form.handle}
                onChange={set('handle')}
                placeholder="maya"
                autoCapitalize="none"
                autoComplete="username"
                required
              />
            </Field>

            <Field
              label={mode === 'in' ? 'PIN' : 'Choose a 4–8 digit PIN'}
              htmlFor="pin"
              hint={mode === 'in' ? undefined : 'You will need this to sign in. Nobody can reset it for you — pick something you will remember.'}
            >
              <input
                id="pin"
                className="input"
                value={form.pin}
                onChange={set('pin')}
                placeholder="••••"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={8}
                type="password"
                autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                required
              />
            </Field>

            {mode === 'up' ? (
              <>
                <Field label="High school (optional)" htmlFor="hs" hint="This is how classmates find you.">
                  <input
                    id="hs"
                    className="input"
                    value={form.highSchool}
                    onChange={set('highSchool')}
                    placeholder="Lincoln High"
                    list="schools"
                  />
                </Field>
                <Field label="College or program (optional)" htmlFor="college">
                  <input
                    id="college"
                    className="input"
                    value={form.college}
                    onChange={set('college')}
                    placeholder="City College — Culinary"
                    list="schools"
                  />
                </Field>
                <Field label="Graduation year (optional)" htmlFor="year">
                  <input
                    id="year"
                    className="input"
                    value={form.gradYear}
                    onChange={set('gradYear')}
                    placeholder="2009"
                    inputMode="numeric"
                    maxLength={4}
                  />
                </Field>
                <datalist id="schools">
                  {SCHOOLS.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </>
            ) : null}

            {error ? <div className="auth-error">{error}</div> : null}

            <Button type="submit" size="lg" full disabled={busy}>
              {busy ? 'One moment…' : mode === 'in' ? 'Sign in' : 'Create my account'}
            </Button>
          </form>

          <div className="demo-card">
            <h3>Look around the demo circle</h3>
            <p>
              Sign in as Maya — a cook living outside who is applying for housing. You will land in a real
              account with family messages, a delivery on the way, and a housing application in review.
            </p>
            <Button variant="ghost" size="sm" onClick={() => void tryDemo()} disabled={demo} icon="arrow">
              {demo ? 'Opening…' : 'Enter as Maya'}
            </Button>
          </div>

          <p className="tiny muted" style={{ lineHeight: 1.5 }}>
            If you are in immediate danger, call 911. For the 988 crisis line, call or text 988. Northlight
            never contacts anyone on your behalf without asking you first.
          </p>
        </div>
      </section>
    </div>
  );
}
