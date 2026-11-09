import { useState } from "react";
import { supabase } from "./services/supabaseClient";

export default function AccountPanel({ user }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const registering = mode === "register";

  async function handleSubmit(event) {
    event.preventDefault();
    if (!supabase || busy) return;

    setBusy(true);
    setMessage("");

    try {
      const credentials = { email: email.trim(), password };

      if (registering) {
        const { data, error } = await supabase.auth.signUp(credentials);
        if (error) {
          setMessage("Registration could not be completed. Check your details and try again.");
          return;
        }

        setPassword("");
        if (!data.session) {
          setMode("login");
          setMessage("Check your email for a confirmation link before logging in.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword(credentials);
        if (error) {
          setMessage("Login failed. Check your email and password and try again.");
          return;
        }
        setPassword("");
      }
    } catch {
      setMessage("We couldn’t reach the account service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    if (!supabase || busy) return;
    setBusy(true);
    setMessage("");

    try {
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) setMessage("Logout failed. Please try again.");
    } catch {
      setMessage("We couldn’t reach the account service. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="traveler-account" className="account-panel" aria-labelledby="account-heading">
      <h2 id="account-heading">Traveler Account</h2>

      {!supabase ? (
        <p>Account access isn’t set up yet. You can still analyze a trip as a guest.</p>
      ) : user ? (
        <div className="account-signed-in">
          <p>Signed in as {user.email}</p>
          <button type="button" disabled={busy} onClick={handleLogout}>
            Log Out
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit}>
          <p>You can analyze trips as a guest. Log in to access saved trips.</p>

          <div className="form-group">
            <label htmlFor="account-email">Email</label>
            <input
              id="account-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="account-password">Password</label>
            <input
              id="account-password"
              type="password"
              autoComplete={registering ? "new-password" : "current-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          <div className="actions">
          <button className="primary" type="submit" disabled={busy}>
            {busy ? "Please wait…" : registering ? "Create Account" : "Log In"}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setMode(registering ? "login" : "register");
              setPassword("");
              setMessage("");
            }}
          >
            {registering ? "Already registered? Log in" : "New traveler? Create an account"}
          </button>
          </div>
        </form>
      )}

      {message && <p role="status">{message}</p>}
    </section>
  );
}