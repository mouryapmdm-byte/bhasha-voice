import React from 'react';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { useFirebase } from './FirebaseProvider';
import { LogIn, LogOut, User as UserIcon } from 'lucide-react';

export const AuthComponent = ({ variant = 'default' }: { variant?: 'default' | 'compact' | 'header' }) => {
    const { user, loading } = useFirebase();

    const signIn = async () => {
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
        } catch (error) {
            console.error("Auth error:", error);
            alert("Sign in failed. Please check your connection and try again.");
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Sign out error:", error);
        }
    };

    if (loading) {
        return (
            <div className="animate-pulse flex items-center justify-center p-2">
                <div className="w-8 h-8 bg-white/10 rounded-full" />
            </div>
        );
    }

    if (variant === 'header') {
        return user ? null : (
            <button 
                onClick={signIn} 
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-500 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg active:scale-95"
            >
                <LogIn size={16} /> <span className="hidden sm:inline">Sign In</span>
            </button>
        );
    }

    return (
        <div className={variant === 'compact' ? "" : "p-6 bg-slate-900 border border-white/10 rounded-3xl shadow-2xl"}>
            {user ? (
                <div className="flex items-center gap-4">
                    <img referrerPolicy="no-referrer" src={user.photoURL || ''} alt="User" className="w-12 h-12 rounded-2xl ring-2 ring-indigo-500/20" />
                    <div className="flex-1">
                        <span className="block text-sm font-bold text-white tracking-tight leading-tight">{user.displayName}</span>
                        <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5 truncate max-w-[120px]">{user.email}</span>
                    </div>
                    <button 
                        onClick={handleSignOut} 
                        className="p-2.5 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white rounded-xl transition-all"
                        title="Sign Out"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            ) : (
                <button 
                    onClick={signIn} 
                    className="w-full px-8 py-4 bg-indigo-600 text-white hover:bg-indigo-500 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-600/20 active:scale-95 border-b-4 border-indigo-800 flex items-center justify-center gap-3"
                >
                    <LogIn size={20} />
                    Login with Google
                </button>
            )}
        </div>
    );
};
