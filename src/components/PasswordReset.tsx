import React, { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebaseConfig';

export const PasswordReset: React.FC = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setMessage(null);

    try {
      await sendPasswordResetEmail(auth, email);
      setMessage('Password reset email sent. Please check your inbox.');
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-6 bg-slate-800 rounded-xl shadow-lg border border-slate-700 max-w-md mx-auto mt-10">
      <h2 className="text-xl text-white font-bold mb-4">Reset Password</h2>
      {error && <p className="text-red-400 mb-4">{error}</p>}
      {message && <p className="text-green-400 mb-4">{message}</p>}
      <form onSubmit={handleReset} className="flex flex-col gap-4">
        <label className="text-slate-300">Email Address</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="border border-slate-600 bg-slate-900 text-white p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Sending...' : 'Send Reset Email'}
        </button>
      </form>
    </div>
  );
};
