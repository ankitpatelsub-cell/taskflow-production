import { useState, useEffect } from 'react';
import { Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/Button';

export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('cookie_consent')) setVisible(true);
  }, []);

  function accept() {
    localStorage.setItem('cookie_consent', 'accepted');
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50">
      <div className="bg-slate-900 text-white rounded-2xl shadow-2xl p-5 flex flex-col gap-3">
        <p className="text-sm text-slate-200 leading-relaxed">
          We use one essential session cookie to keep you logged in. No advertising or tracking cookies.{' '}
          <Link to="/privacy" className="underline text-indigo-300 hover:text-white">Privacy Policy</Link>
        </p>
        <div className="flex gap-2">
          <Button size="sm" onClick={accept} className="flex-1">Got it</Button>
          <Button size="sm" variant="outline" onClick={accept} className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800">
            Decline non-essential
          </Button>
        </div>
      </div>
    </div>
  );
}
