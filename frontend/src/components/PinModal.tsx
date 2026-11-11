import React, { useState, useEffect } from 'react';
import { Lock, Delete, ShieldCheck, X } from 'lucide-react';

interface PinModalProps {
  isOpen: boolean;
  title?: string;
  subtitle?: string;
  onClose: () => void;
  onSuccess: (pin: string) => void;
  verifyPinApi: (pin: string) => Promise<boolean>;
}

export const PinModal: React.FC<PinModalProps> = ({
  isOpen,
  title = 'Sécurité Parent',
  subtitle = 'Entrez le code PIN à 4 chiffres (défaut : 1234)',
  onClose,
  onSuccess,
  verifyPinApi,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setError(false);
      setChecking(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (pin.length === 4 && !checking) {
      setChecking(true);
      verifyPinApi(pin)
        .then((valid) => {
          if (valid) {
            onSuccess(pin);
          } else {
            setError(true);
            setTimeout(() => {
              setPin('');
              setChecking(false);
            }, 450);
          }
        })
        .catch(() => {
          setError(true);
          setTimeout(() => {
            setPin('');
            setChecking(false);
          }, 450);
        });
    }
  }, [pin, checking, verifyPinApi, onSuccess]);

  if (!isOpen) return null;

  const handleDigit = (d: string) => {
    if (pin.length < 4 && !checking) {
      setError(false);
      setPin((prev) => prev + d);
    }
  };

  const handleBackspace = () => {
    if (!checking) {
      setError(false);
      setPin((prev) => prev.slice(0, -1));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="relative w-full max-w-sm rounded-3xl bg-white dark:bg-[#1E1E1E] border border-black/10 dark:border-white/10 shadow-2xl p-6 text-gray-900 dark:text-white">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2.5 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition"
          aria-label="Fermer"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex flex-col items-center text-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500 mb-3">
            <Lock className="w-7 h-7" />
          </div>
          <h3 className="text-xl font-bold tracking-tight">{title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
        </div>

        {/* 4 Dots indicator */}
        <div className="flex justify-center gap-4 my-5">
          {[0, 1, 2, 3].map((idx) => {
            const filled = pin.length > idx;
            return (
              <div
                key={idx}
                className={`w-5 h-5 rounded-full transition-all duration-200 ${
                  error
                    ? 'bg-red-500 scale-110'
                    : filled
                    ? 'bg-amber-500 scale-110 shadow-lg shadow-amber-500/40'
                    : 'bg-gray-200 dark:bg-white/15'
                }`}
              />
            );
          })}
        </div>

        {error && (
          <p className="text-center text-sm font-medium text-red-500 mb-3">
            Code PIN incorrect. Réessayez.
          </p>
        )}

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-3 mt-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => handleDigit(digit)}
              className="h-16 rounded-2xl text-2xl font-bold bg-gray-100 hover:bg-gray-200 active:scale-95 dark:bg-white/5 dark:hover:bg-white/15 border border-black/5 dark:border-white/5 transition flex items-center justify-center"
            >
              {digit}
            </button>
          ))}
          <div className="flex items-center justify-center text-emerald-500">
            <ShieldCheck className="w-6 h-6 opacity-60" />
          </div>
          <button
            type="button"
            onClick={() => handleDigit('0')}
            className="h-16 rounded-2xl text-2xl font-bold bg-gray-100 hover:bg-gray-200 active:scale-95 dark:bg-white/5 dark:hover:bg-white/15 border border-black/5 dark:border-white/5 transition flex items-center justify-center"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="h-16 rounded-2xl bg-gray-100 hover:bg-gray-200 active:scale-95 dark:bg-white/5 dark:hover:bg-white/15 border border-black/5 dark:border-white/5 transition flex items-center justify-center text-gray-600 dark:text-gray-300"
            aria-label="Effacer"
          >
            <Delete className="w-6 h-6" />
          </button>
        </div>
      </div>
    </div>
  );
};

