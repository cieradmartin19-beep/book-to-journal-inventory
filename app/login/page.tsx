"use client";

import Link from "next/link";
import { ArrowLeft, BookOpen, Chrome, Loader2, Mail } from "lucide-react";
import { useEffect, useState } from "react";
import { ensureProfile, getCurrentUser, userDisplayName } from "@/lib/auth";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
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

  async function sendMagicLink() {
    const cleanEmail = email.trim();
    setError("");
    setMessage("");

    if (!cleanEmail) {
      setError("Enter your email address.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setError("Supabase is not configured.");
      return;
    }

    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: {
          emailRedirectTo: window.location.origin
        }
      });
      if (signInError) throw signInError;
      setMessage("Check your email for a magic sign-in link.");
    } catch (signInError) {
      setError(signInError instanceof Error ? signInError.message : "Magic link could not be sent.");
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
            <h1 className="mt-1 font-serif text-3xl font-black">Sign in to manage your inventory.</h1>
            <p className="mx-auto mt-2 max-w-sm font-semibold text-ink/65">
              Use your email to keep Jess&apos;s saved books, photos, categories, and statuses under her own account.
            </p>
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

          <button className="btn-primary w-full" disabled={loading} onClick={sendMagicLink}>
            {loading ? <Loader2 className="animate-spin" size={20} aria-hidden /> : <Mail size={20} aria-hidden />}
            {loading ? "Sending..." : "Send magic link"}
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
