import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User, Auth } from 'firebase/auth';
import { auth } from '../lib/firebase';

const FirebaseContext = createContext<{ user: User | null; loading: boolean; auth: Auth }>({ user: null, loading: true, auth: auth });

export const FirebaseProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });
  }, []);

  return (
    <FirebaseContext.Provider value={{ user, loading, auth }}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = () => useContext(FirebaseContext);
