import { LogIn, LogOut, Moon, ShieldCheck, Sun, UserPlus } from 'lucide-react';
import { User } from 'firebase/auth';
import { useState } from 'react';

interface AdminBarProps {
  user: User | null;
  authReady: boolean;
  isAdmin: boolean;
  isBootstrappedAdmin: boolean;
  isDark: boolean;
  onToggleTheme: () => void;
  onSignIn: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onAddCoAdmin: (uid: string, email: string) => Promise<void>;
}

export function AdminBar({
  user,
  authReady,
  isAdmin,
  isBootstrappedAdmin,
  isDark,
  onToggleTheme,
  onSignIn,
  onSignOut,
  onAddCoAdmin,
}: AdminBarProps) {
  const [showCoAdminForm, setShowCoAdminForm] = useState(false);
  const [coUid, setCoUid] = useState('');
  const [coEmail, setCoEmail] = useState('');
  const [busy, setBusy] = useState(false);

  const handleGrantAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coUid.trim() || !coEmail.trim()) return;
    setBusy(true);
    try {
      await onAddCoAdmin(coUid.trim(), coEmail.trim());
      setCoUid('');
      setCoEmail('');
      setShowCoAdminForm(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-4">
      <div className="bg-card border border-line rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {!authReady ? (
            <span className="text-mu font-bold">جارٍ التحقق من الحساب...</span>
          ) : user ? (
            <>
              <span className="font-bold text-tx">
                مرحباً، {user.displayName || user.email}
              </span>
              <span aria-hidden="true" className="text-mu">
                ·
              </span>
              {isAdmin ? (
                <span className="inline-flex items-center gap-1.5 text-gold font-black">
                  <ShieldCheck className="w-4 h-4" />
                  <span>وضع المنظم (أدمن)</span>
                </span>
              ) : (
                <span className="text-mu font-bold">
                  حساب كابتن · <span dir="ltr" className="text-xs select-all">{user.uid}</span>
                </span>
              )}
            </>
          ) : (
            <span className="text-mu font-bold">
              سجّل بحساب جوجل لحجز فرقتك مباشرة على السحابة أو لإدارة البطولة للأدمن.
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isBootstrappedAdmin && (
            <button
              type="button"
              onClick={() => setShowCoAdminForm((v) => !v)}
              className="inline-flex items-center gap-1.5 border border-line bg-surf text-tx font-bold rounded-xl px-3.5 py-2 text-xs whitespace-nowrap shrink-0 hover:border-gold transition-colors cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>إضافة منظم مساعد</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex items-center gap-1.5 border border-line bg-surf text-tx font-bold rounded-xl px-3.5 py-2 text-xs whitespace-nowrap shrink-0 hover:border-gold transition-colors cursor-pointer"
            aria-label={isDark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{isDark ? 'الوضع الفاتح' : 'الوضع الداكن'}</span>
          </button>

          {authReady &&
            (user ? (
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center gap-1.5 border border-line bg-surf text-tx font-bold rounded-xl px-3.5 py-2 text-xs whitespace-nowrap shrink-0 hover:border-bad hover:text-bad transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>تسجيل خروج</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onSignIn}
                className="inline-flex items-center gap-1.5 bg-gold text-on font-black rounded-xl px-4 py-2 text-xs whitespace-nowrap shrink-0 hover:opacity-90 transition-opacity cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>دخول بحساب جوجل</span>
              </button>
            ))}
        </div>
      </div>

      {isBootstrappedAdmin && showCoAdminForm && (
        <form
          onSubmit={handleGrantAdmin}
          className="mt-3 bg-card border border-line rounded-2xl p-4 grid sm:grid-cols-3 gap-3 items-end"
        >
          <label className="text-xs font-bold text-tx block">
            معرّف المستخدم (UID)
            <input
              value={coUid}
              onChange={(e) => setCoUid(e.target.value)}
              placeholder="انسخ UID من شريط حساب الكابتن"
              dir="ltr"
              className="mt-1 w-full bg-surf border border-line text-tx rounded-xl px-3 py-2 text-sm text-right focus:outline-2 focus:outline-gold"
              required
            />
          </label>
          <label className="text-xs font-bold text-tx block">
            البريد الإلكتروني للمنظم المساعد
            <input
              type="email"
              value={coEmail}
              onChange={(e) => setCoEmail(e.target.value)}
              placeholder="organizer@gmail.com"
              dir="ltr"
              className="mt-1 w-full bg-surf border border-line text-tx rounded-xl px-3 py-2 text-sm text-right focus:outline-2 focus:outline-gold"
              required
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="bg-gold text-on font-black rounded-xl px-4 py-2.5 text-sm whitespace-nowrap hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            {busy ? 'جارٍ الإضافة...' : 'منح صلاحية المنظم'}
          </button>
        </form>
      )}
    </section>
  );
}
