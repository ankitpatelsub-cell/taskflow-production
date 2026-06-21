import { useState } from 'react';
import { Mail, Phone, Clock, Send } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { useUiStore } from '@/stores/uiStore';
import { CONTACT_CONFIG } from '@/config/contact';

function ContactDetail({ icon: Icon, label, href }) {
  const inner = (
    <div className="flex items-start gap-2 text-sm text-indigo-900 dark:text-indigo-200">
      <Icon size={14} className="text-indigo-500 shrink-0 mt-0.5" />
      <span>{label}</span>
    </div>
  );
  return href ? (
    <a href={href} className="hover:underline">
      {inner}
    </a>
  ) : (
    inner
  );
}

export function ContactModal() {
  const { contactOpen, closeContact } = useUiStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    const subject = encodeURIComponent(CONTACT_CONFIG.mailtoSubject);
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`);
    window.location.href = `mailto:${CONTACT_CONFIG.email}?subject=${subject}&body=${body}`;
    setSubmitted(true);
  }

  function handleClose() {
    closeContact();
    setTimeout(() => {
      setName('');
      setEmail('');
      setMessage('');
      setSubmitted(false);
    }, 200);
  }

  return (
    <Modal open={contactOpen} onClose={handleClose} title="Contact Us">
      {submitted ? (
        <div className="text-center py-6 space-y-3">
          <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-900/40 rounded-full flex items-center justify-center mx-auto">
            <Send size={20} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <p className="font-semibold text-gray-900 dark:text-white">Email client opened!</p>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Your default email client should have opened with a pre-filled message.
            If not, email us directly at{' '}
            <a
              href={`mailto:${CONTACT_CONFIG.email}`}
              className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
            >
              {CONTACT_CONFIG.email}
            </a>
          </p>
          <Button variant="secondary" size="sm" onClick={handleClose} className="mt-2">
            Close
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/50 rounded-xl p-4 space-y-2">
            <ContactDetail
              icon={Mail}
              label={CONTACT_CONFIG.email}
              href={`mailto:${CONTACT_CONFIG.email}`}
            />
            <ContactDetail
              icon={Phone}
              label={CONTACT_CONFIG.phone}
              href={`tel:${CONTACT_CONFIG.phone.replace(/\D/g, '')}`}
            />
            <ContactDetail
              icon={Clock}
              label={`${CONTACT_CONFIG.hours} — ${CONTACT_CONFIG.responseTime}`}
            />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Your name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Your email
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">
                Message
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                required
                placeholder="Describe your question or issue…"
                className="w-full rounded-xl border border-gray-200 dark:border-slate-600 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-slate-700 dark:text-white resize-none"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button type="button" variant="secondary" className="flex-1" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={!name.trim() || !email.trim() || !message.trim()}>
                Open email client
              </Button>
            </div>
          </form>
        </div>
      )}
    </Modal>
  );
}
