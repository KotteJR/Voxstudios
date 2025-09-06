'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';
import logo from '@/../public/images/logo.png';
import { EnvelopeIcon, LockClosedIcon } from '@heroicons/react/24/outline';

export default function LoginPage() {
  const router = useRouter();
  const { login, isAuthenticated, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.push('/projects');
    }
  }, [isAuthenticated, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
      router.push('/projects');
    } catch (err) {
      setError('Invalid credentials. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen grid grid-cols-1 md:grid-cols-2 overflow-hidden">
      {/* Left: Dark form panel */}
      <div className="relative bg-black text-white flex items-center justify-center px-6 md:px-10">
        <div className="w-full max-w-sm">
          <h1 className="text-4xl font-semibold">Sign in to continue.</h1>
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-xs tracking-wide text-gray-400 uppercase">User Name</label>
              <div className="relative mt-2">
                <EnvelopeIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="email"
                  name="email"
                  type="text"
                  placeholder="Enter User Name"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-md border border-gray-700 bg-transparent px-10 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-xs tracking-wide text-gray-400 uppercase">Password</label>
              <div className="relative mt-2">
                <LockClosedIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Enter Password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-md border border-gray-700 bg-transparent px-10 py-3 text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {error && (
              <div className="rounded-md bg-red-50/10 border border-red-500/30 p-3">
                <p className="text-sm text-red-200">{error}</p>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full rounded-md bg-blue-600 py-3 text-sm font-semibold tracking-wide hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isSubmitting ? 'Signing in...' : 'SIGN IN'}
              </button>
            </div>

          </form>
        </div>
      </div>

      {/* Right: Plain white background with centered logo */}
      <div className="relative hidden md:block">
        <div className="absolute inset-0 bg-white" />
        <div className="relative z-10 flex h-full items-center justify-center">
          <Image src={logo} alt="Vox Studios" width={340} height={106} priority className="invert" />
        </div>
      </div>
    </div>
  );
} 