import { useEffect, useState, type FormEvent } from 'react';
import { AuthError } from '@supabase/supabase-js';
import { Code2, AlertCircle, ArrowLeft } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

const EMAIL_DOMAIN = '@nottingham.edu.my';
// Must match Supabase → Authentication → Email → "Email OTP Length".
const CODE_LENGTH = 8;
const RESEND_COOLDOWN_S = 60;

type Step = 'email' | 'code';

function isRateLimited(err: AuthError) {
  return err.status === 429 || (err.code?.startsWith('over_') ?? false);
}

/** Friendly message for errors from signInWithOtp. */
function sendErrorMessage(err: AuthError) {
  if (isRateLimited(err)) {
    return 'Too many attempts. Please wait a minute and try again.';
  }
  // The before-user-created hook rejects emails not in committee_members.
  if (err.status === 403 || err.code === 'hook_payload_invalid' || /hook/i.test(err.message)) {
    return "This email isn't on the committee list. Contact the Head of Tech if you think this is a mistake.";
  }
  return err.message || 'Could not send a code. Please try again.';
}

/** Friendly message for errors from verifyOtp. */
function verifyErrorMessage(err: AuthError) {
  if (isRateLimited(err)) {
    return 'Too many attempts. Please wait a minute and try again.';
  }
  if (err.code === 'otp_expired' || err.status === 403 || err.status === 400) {
    return 'That code is invalid or has expired. Check it, or request a new one.';
  }
  return err.message || 'Could not verify the code. Please try again.';
}

export function LoginView() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const sendCode = async (address: string) => {
    const { error: err } = await supabase.auth.signInWithOtp({ email: address });
    if (err) {
      setError(sendErrorMessage(err));
      return false;
    }
    setCooldown(RESEND_COOLDOWN_S);
    return true;
  };

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const normalised = email.trim().toLowerCase();
    setEmail(normalised);
    setError(null);

    if (normalised.length <= EMAIL_DOMAIN.length || !normalised.endsWith(EMAIL_DOMAIN)) {
      setError(`Please use your university email ending in ${EMAIL_DOMAIN}.`);
      return;
    }

    setSubmitting(true);
    const ok = await sendCode(normalised);
    setSubmitting(false);
    if (ok) {
      setCode('');
      setStep('code');
    }
  };

  const verify = async (token: string) => {
    if (token.length !== CODE_LENGTH || submitting) return;
    setError(null);
    setSubmitting(true);
    const { error: err } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    setSubmitting(false);
    if (err) {
      setError(verifyErrorMessage(err));
      setCode('');
    }
    // On success, AuthProvider picks up the new session and the app swaps views.
  };

  const handleResend = async () => {
    if (cooldown > 0 || submitting) return;
    setError(null);
    setSubmitting(true);
    await sendCode(email);
    setSubmitting(false);
  };

  const handleUseDifferentEmail = () => {
    setStep('email');
    setCode('');
    setError(null);
    setCooldown(0);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Masthead */}
        <div className="mb-8 flex items-center gap-2">
          <Code2 className="h-4 w-4 shrink-0 text-primary" />
          <span className="font-serif text-base font-semibold tracking-tight">CS Society</span>
          <span className="text-xs text-muted-foreground">Workspace</span>
        </div>

        <div className="border border-border p-6 sm:p-8">
          <header className="mb-6 border-b border-border pb-4">
            <h1 className="font-serif text-2xl font-semibold leading-tight">
              {step === 'email' ? 'Sign in' : 'Check your email'}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {step === 'email' ? (
                `Committee members only. We’ll email you a ${CODE_LENGTH}-digit code.`
              ) : (
                <>
                  We sent a {CODE_LENGTH}-digit code to{' '}
                  <span className="font-medium text-foreground break-all">{email}</span>.
                </>
              )}
            </p>
          </header>

          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-2 border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive"
            >
              <AlertCircle className="mt-px h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {step === 'email' ? (
            <form onSubmit={handleEmailSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="login-email" className="text-xs">
                  University email
                </Label>
                <Input
                  id="login-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  placeholder={`username${EMAIL_DOMAIN}`}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={submitting}
                  style={{ borderRadius: 0 }}
                  className="h-9 border-border bg-background text-sm"
                />
              </div>
              <button
                type="submit"
                disabled={submitting || !email.trim()}
                className="w-full border border-primary bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? 'Sending…' : 'Send code'}
              </button>
            </form>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                verify(code);
              }}
              className="space-y-4"
            >
              <div className="space-y-1.5">
                <Label htmlFor="login-code" className="text-xs">
                  {CODE_LENGTH}-digit code
                </Label>
                <InputOTP
                  id="login-code"
                  maxLength={CODE_LENGTH}
                  value={code}
                  onChange={setCode}
                  onComplete={verify}
                  inputMode="numeric"
                  pattern="^[0-9]*$"
                  autoComplete="one-time-code"
                  autoFocus
                  disabled={submitting}
                >
                  <InputOTPGroup>
                    {Array.from({ length: CODE_LENGTH }, (_, i) => (
                      <InputOTPSlot
                        key={i}
                        index={i}
                        className="h-11 w-9 border-border text-base first:rounded-none last:rounded-none"
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              <button
                type="submit"
                disabled={submitting || code.length !== CODE_LENGTH}
                className="w-full border border-primary bg-primary px-3 py-2 text-xs font-semibold uppercase tracking-wider text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? 'Verifying…' : 'Verify & sign in'}
              </button>

              <div className="flex items-center justify-between pt-1 text-xs">
                <button
                  type="button"
                  onClick={handleUseDifferentEmail}
                  disabled={submitting}
                  className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Use a different email
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || submitting}
                  className="text-primary transition-colors hover:underline disabled:text-muted-foreground disabled:no-underline"
                >
                  {cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
