import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';

export const UserProfile: React.FC = () => {
  const [profile, setProfile] = useState<any>(null);
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setProfile(data);
            setDisplayName(data.displayName || '');
          }
        } catch (err) {
          setError('Failed to load profile');
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleUpdate = async () => {
    if (!auth.currentUser) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'users', auth.currentUser.uid), {
        displayName: displayName,
      });
      setProfile({ ...profile, displayName });
      setError(null);
    } catch (err) {
      setError('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="p-4 text-slate-400">Loading profile...</div>;
  if (!auth.currentUser) return <div className="p-4 text-red-400">Please sign in to view your profile.</div>;

  return (
    <div className="p-6 bg-slate-800 rounded-xl shadow-lg border border-slate-700 max-w-md mx-auto mt-10">
      <h2 className="text-xl text-white font-bold mb-4">User Profile</h2>
      {error && <p className="text-red-400 mb-4">{error}</p>}
      <div className="flex flex-col gap-4">
        <label className="text-slate-300">Display Name</label>
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="border border-slate-600 bg-slate-900 text-white p-3 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
        />
        <button
          onClick={handleUpdate}
          disabled={isSaving}
          className="bg-indigo-600 hover:bg-indigo-500 text-white p-3 rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {isSaving ? 'Updating...' : 'Update Name'}
        </button>
      </div>
    </div>
  );
};
