import React, { useState } from 'react';
import { Landmark, Lock, User as UserIcon, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';
import { api } from '../utils/api';
import { User } from '../types/caisse';

interface LoginScreenProps {
  onLoginSuccess: (user: User) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const user = await api.login(username, password);
      onLoginSuccess(user);
    } catch (err: any) {
      setError(err.message || 'Identifiant ou mot de passe incorrect.');
      setIsLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-[#063339] via-[#084b54] to-[#0c616d] flex items-center justify-center p-4 selection:bg-teal-300 selection:text-teal-900">
      <div className="w-full max-w-md">
        {/* App Logo & Title */}
        <div className="text-center mb-6">
          <div className="inline-flex p-3 bg-white/10 rounded-2xl border border-teal-300/30 backdrop-blur-md shadow-lg mb-3">
            <Landmark className="w-10 h-10 text-teal-200" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Gestion de Caisse & AFB160
          </h1>
          <p className="text-xs text-teal-200/90 mt-1">
            Espace sécurisé multi-utilisateurs et multi-appareils
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/10 backdrop-blur-md border border-teal-400/30 rounded-2xl shadow-2xl p-6 sm:p-8 text-white">
          <div className="flex items-center gap-2 mb-5 pb-3 border-b border-teal-500/30">
            <ShieldCheck className="w-5 h-5 text-teal-300" />
            <h2 className="text-base font-semibold text-white">
              Connexion requise
            </h2>
          </div>

          {error && (
            <div className="mb-4 bg-red-500/20 border border-red-400/50 text-red-100 text-xs px-3 py-2.5 rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-300 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username Input */}
            <div>
              <label className="block text-xs font-semibold text-teal-100 mb-1.5">
                Identifiant utilisateur :
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-teal-600">
                  <UserIcon className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Votre identifiant"
                  className="w-full bg-white text-gray-900 pl-9 pr-3 py-2 text-sm rounded-lg border border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-400 font-medium placeholder-gray-400 shadow-inner"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label className="block text-xs font-semibold text-teal-100 mb-1.5">
                Mot de passe :
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-teal-600">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="••••••••"
                  className="w-full bg-white text-gray-900 pl-9 pr-10 py-2 text-sm rounded-lg border border-teal-300 focus:outline-none focus:ring-2 focus:ring-teal-400 font-medium placeholder-gray-400 shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700 cursor-pointer"
                  title={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#2e9e44] hover:bg-[#258237] active:bg-[#1c642a] text-white font-semibold py-2.5 px-4 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
              >
                {isLoading ? (
                  <span>Vérification...</span>
                ) : (
                  <span>Se connecter</span>
                )}
              </button>
            </div>
          </form>

          {/* Security footnote */}
          <div className="mt-5 pt-3 border-t border-teal-500/20 text-center text-[11px] text-teal-200/80">
            Accès sécurisé multi-caisses • Gestion des droits par utilisateur
          </div>
        </div>
      </div>
    </div>
  );
};
