"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, Chrome, Loader2, LogIn, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { ensureProfile, getCurrentUser, userDisplayName } from "@/lib/auth";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

export default function LoginPage() {
  const [mode, setMode] = useState<"sign-in" | "create">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const user = await getCurrentUser();
      if (!mounted) return;
      if (user) {
        await ensureProfile(user.id);
        setDisplayName(userDisplayName(user));
      }
    }

    if (isSupabaseConfigured) void loadUser();
    return () => {
      mounted = false;
    };
  }, []);

  function friendlyAuthError(message: string) {
    if (/invalid login credentials|invalid credentials/i.test(message)) {
      return "That email or password does not match. Check the password and try again.";
    }
    if (/already registered|already exists|user already/i.test(message)) {
      return "An account already exists for this email. Switch to Sign in.";
    }
    if (/email not confirmed|not confirmed/i.test(message)) {
      return "That email is not confirmed yet. Check your inbox for the confirmation email, or turn off email confirmation in Supabase.";
    }
    if (/password/i.test(message) && /six|6|weak|short/i.test(message)) {
      return "Use a password with at least 6 characters.";
    }
    return message || "Login failed. Please try again.";
  }

  async function handleEmailPasswordAuth() {
    const cleanEmail = email.trim();
    setError("");
    setMessage("");

    if (!cleanEmail) {
      setError("Enter your email address.");
      return;
    }

    if (password.length < 6) {
      setError("Use a password with at least 6 characters.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "create") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: window.location.origin
          }
        });
        if (signUpError) throw signUpError;
        if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
          setError("An account already exists for this email. Switch to Sign in.");
          return;
        }
        if (data.session?.user) {
          await ensureProfile(data.session.user.id);
          window.location.href = "/";
          return;
        }
        setMessage("Account created. Check your email to confirm it, then sign in.");
        return;
      }

      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password
      });
      if (signInError) throw signInError;
      if (data.user) await ensureProfile(data.user.id);
      window.location.href = "/";
    } catch (authError) {
      setError(friendlyAuthError(authError instanceof Error ? authError.message : "Login failed. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  async function signInWithGoogle() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }

    setError("");
    setMessage("");
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin
      }
    });
    if (signInError) setError(signInError.message);
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="mx-auto grid min-h-screen max-w-xl place-items-center px-4 py-8">
        <div className="panel p-6 text-center">
          <BookOpen className="mx-auto mb-4 text-marigold" size={48} aria-hidden />
          <h1 className="font-serif text-3xl font-black">Supabase is not configured</h1>
          <p className="mt-2 font-semibold text-ink/65">Add Supabase environment variables before using real login.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto grid min-h-screen max-w-xl place-items-center px-4 py-8">
      <div className="w-full">
        <Link href="/" className="btn-secondary mb-4 w-fit">
          <ArrowLeft size={20} aria-hidden />
          Back
        </Link>

        <section className="panel grid gap-5 p-5 sm:p-6">
          <div className="text-center">
            <BookOpen className="mx-auto mb-4 text-marigold" size={50} aria-hidden />
            <p className="text-sm font-black uppercase tracking-wide text-marigold">Account Login</p>
            <h1 className="mt-1 font-serif text-3xl font-black">
              {mode === "create" ? "Create Jess\u0027s inventory account." : "Sign in to manage your inventory."}
            </h1>
            <p className="mx-auto mt-2 max-w-sm font-semibold text-ink/65">
              Use your email to keep Jess&apos;s saved books, photos, categories, and statuses under her own account.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-lg bg-honey/20 p-1">
            <button
              className={`rounded-md px-3 py-2 text-sm font-black ${mode === "sign-in" ? "bg-white shadow-sm" : "text-ink/65"}`}
              onClick={() => {
                setMode("sign-in");
                setError("");
                setMessage("");
              }}
              type="button"
            >
              Sign in
            </button>
            <button
              className={`rounded-md px-3 py-2 text-sm font-black ${mode === "create" ? "bg-white shadow-sm" : "text-ink/65"}`}
              onClick={() => {
                setMode("create");
                setError("");
                setMessage("");
              }}
              type="button"
            >
              Create account
            </button>
          </div>

          {displayName ? (
            <div className="rounded-lg bg-mint/25 p-3 text-center font-black text-ink">
              Signed in as {displayName || "Jess"}
            </div>
          ) : null}

          <label className="grid gap-2">
            <span className="label">Email address</span>
            <input
              className="field"
              inputMode="email"
              placeholder="jess@example.com"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </label>

          <label className="grid gap-2">
            <span className="label">Password</span>
            <input
              className="field"
              placeholder="At least 6 characters"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleEmailPasswordAuth();
              }}
            />
          </label>

          <button className="btn-primary w-full" disabled={loading} onClick={handleEmailPasswordAuth}>
            {loading ? (
              <Loader2 className="animate-spin" size={20} aria-hidden />
            ) : mode === "create" ? (
              <UserPlus size={20} aria-hidden />
            ) : (
              <LogIn size={20} aria-hidden />
            )}
            {loading ? "Working..." : mode === "create" ? "Create account" : "Sign in"}
          </button>

          <button className="btn-secondary w-full" onClick={signInWithGoogle}>
            <Chrome size={20} aria-hidden />
            Continue with Google
          </button>

          {message ? <p className="rounded-lg bg-mint/25 p-3 text-sm font-bold text-ink">{message}</p> : null}
          {error ? <p className="rounded-lg bg-red-50 p-3 text-sm font-bold text-red-800">{error}</p> : null}
        </section>
      </div>
    </main>
  );
}
