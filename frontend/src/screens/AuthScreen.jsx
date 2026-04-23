import React from 'react';

export default function AuthScreen({
  isSignup, setIsSignup,
  formUsername, setFormUsername,
  formPassword, setFormPassword,
  formConfirm,  setFormConfirm,
  authError, authLoading, onSubmit,
}) {
  return (
    <section className="screen-card glass-card center-screen login-stack">
      <h2>{isSignup ? 'Create Account' : 'Sign In'}</h2>
      <p className="muted">{isSignup ? 'Choose a username and password' : 'Welcome back'}</p>

      {authError && <p className="auth-error">{authError}</p>}

      <input
        className="text-input"
        value={formUsername}
        onChange={e => setFormUsername(e.target.value)}
        placeholder="Username"
        autoComplete="username"
      />
      <input
        className="text-input"
        type="password"
        value={formPassword}
        onChange={e => setFormPassword(e.target.value)}
        placeholder="Password (min 6 chars)"
        autoComplete={isSignup ? 'new-password' : 'current-password'}
        onKeyDown={e => e.key === 'Enter' && !isSignup && onSubmit()}
      />
      {isSignup && (
        <input
          className="text-input"
          type="password"
          value={formConfirm}
          onChange={e => setFormConfirm(e.target.value)}
          placeholder="Confirm password"
          autoComplete="new-password"
          onKeyDown={e => e.key === 'Enter' && onSubmit()}
        />
      )}

      <button className="primary-btn" onClick={onSubmit} disabled={authLoading}>
        {authLoading
          ? <><span className="btn-spinner" /> Please wait…</>
          : isSignup ? 'Create Account' : 'Sign In'}
      </button>
      <button className="link-btn" onClick={() => { setIsSignup(!isSignup); }}>
        {isSignup ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
      </button>
    </section>
  );
}
