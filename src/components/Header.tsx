import { Moon, Sun } from 'lucide-react';

interface HeaderProps {
  isDark: boolean;
  onToggleTheme: () => void;
}

export function Header({ isDark, onToggleTheme }: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-ink/90 backdrop-blur border-b border-line">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-8">
        <div className="flex items-center gap-3 sm:gap-5 shrink-0">
          <a
            href="#"
            dir="ltr"
            className="inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-gold rounded"
            aria-label="Risk Up"
          >
            <span className="text-2xl font-black italic tracking-tight text-tx">RISK</span>
            <span className="bg-gold text-on font-black italic px-2 py-0.5 rounded -skew-x-12 text-lg leading-none">
              UP
            </span>
          </a>

          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex items-center gap-1.5 border border-line bg-surf text-tx font-bold rounded-xl px-3 py-1.5 text-xs whitespace-nowrap shrink-0 hover:border-gold transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-gold"
            aria-label={isDark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
          >
            {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            <span>{isDark ? 'الوضع الفاتح' : 'الوضع الداكن'}</span>
          </button>
        </div>

        <nav className="hidden md:flex items-center gap-7 text-sm font-bold text-mu">
          <a
            href="#center"
            className="hover:text-tx transition-colors whitespace-nowrap shrink-0"
          >
            المجموعات والماتشات
          </a>
          <a
            href="#knockout"
            className="hover:text-tx transition-colors whitespace-nowrap shrink-0"
          >
            المتأهلون
          </a>
          <a
            href="#scorers"
            className="hover:text-tx transition-colors whitespace-nowrap shrink-0"
          >
            الهدافين
          </a>
          <a
            href="#teams"
            className="hover:text-tx transition-colors whitespace-nowrap shrink-0"
          >
            الفرق
          </a>
        </nav>

        <a
          href="#register"
          className="bg-gold text-on font-black rounded-xl px-4 py-2 text-sm whitespace-nowrap shrink-0 transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold"
        >
          احجز لفرقتك
        </a>
      </div>
    </header>
  );
}
