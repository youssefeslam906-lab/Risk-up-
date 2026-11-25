import { Trophy } from 'lucide-react';
import { MAX_TEAMS } from '../types/tournament';

interface HeroSectionProps {
  teamCount: number;
}

export function HeroSection({ teamCount }: HeroSectionProps) {
  const progressPct = Math.min(100, Math.round((teamCount / MAX_TEAMS) * 100));

  return (
    <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-10 space-y-6">
      <div className="grid lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-between gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-mu">
              <span className="text-gold">الموسم الجديد 2026</span>
              <span aria-hidden="true">·</span>
              <span>بطولة كرة القدم الخماسية</span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-black leading-[1.15] text-balance text-tx">
              انزل الملعب وسيطر على بطولة{' '}
              <span className="text-gold" dir="ltr">
                RISK UP
              </span>
            </h1>
            <p className="text-mu text-base leading-relaxed max-w-xl">
              سجّل فرقتك الآن، وتابع توزيع المجموعات ومواعيد الماتشات وترتيب النقاط لحظة بلحظة.
            </p>
          </div>

          <div className="bg-card border border-line rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-2.5">
              <Trophy className="w-5 h-5 text-gold shrink-0" />
              <h2 className="font-black text-base text-tx">جوائز البطولة</h2>
            </div>
            <ul className="grid sm:grid-cols-2 gap-2.5 text-sm font-bold">
              <li className="bg-surf rounded-xl px-4 py-2.5 flex items-center justify-between">
                <span>المركز الأول</span>
                <span className="text-gold tabular-nums">5000 ج</span>
              </li>
              <li className="bg-surf rounded-xl px-4 py-2.5 flex items-center justify-between">
                <span>المركز الثاني</span>
                <span className="text-gold tabular-nums">2500 ج</span>
              </li>
              <li className="bg-surf rounded-xl px-4 py-2.5 text-tx">هداف البطولة</li>
              <li className="bg-surf rounded-xl px-4 py-2.5 text-tx">أفضل لاعب</li>
              <li className="bg-surf rounded-xl px-4 py-2.5 text-tx sm:col-span-2">أفضل حارس</li>
            </ul>
          </div>
        </div>

        <div className="lg:col-span-5 bg-card border border-line rounded-2xl p-5 flex flex-col justify-between gap-5">
          <div className="rounded-xl overflow-hidden bg-[#0B0E0A] border border-line/40 flex-1 flex items-center justify-center p-4">
            <svg
              viewBox="0 0 400 300"
              className="w-full max-h-64"
              role="img"
              aria-label="شعار بطولة Risk Up"
            >
              <rect width="400" height="300" rx="18" fill="#0B0E0A" />
              <polygon points="200,25 264,59 256,74 200,44 144,74 136,59" fill="#CCFF00" />
              <polygon
                points="200,53 264,87 256,102 200,72 144,102 136,87"
                fill="#92BD0B"
                opacity=".88"
              />
              <polygon
                points="200,81 264,115 256,130 200,100 144,130 136,115"
                fill="#5D7912"
                opacity=".78"
              />
              <text
                x="200"
                y="185"
                textAnchor="middle"
                fill="#fff"
                fontFamily="Cairo, sans-serif"
                fontWeight="900"
                fontStyle="italic"
                fontSize="72"
              >
                RISK
              </text>
              <polygon points="132,198 280,198 268,255 120,255" fill="#CCFF00" />
              <text
                x="200"
                y="244"
                textAnchor="middle"
                fill="#090C08"
                fontFamily="Cairo, sans-serif"
                fontWeight="900"
                fontStyle="italic"
                fontSize="50"
              >
                UP
              </text>
              <text
                x="200"
                y="284"
                textAnchor="middle"
                fill="#9CA8B0"
                fontFamily="Cairo, sans-serif"
                fontWeight="700"
                fontSize="13"
                letterSpacing="4"
              >
                FOOTBALL TOURNAMENT
              </text>
            </svg>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm font-bold">
              <span className="text-tx">اكتمال التسجيل</span>
              <span className="text-gold tabular-nums">
                {teamCount} من {MAX_TEAMS}
              </span>
            </div>
            <div
              className="h-3 bg-surf rounded-full overflow-hidden border border-line/40"
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full bg-gold transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-card border border-line rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-gold tabular-nums">4</div>
          <div className="text-xs text-mu font-bold mt-1">مجموعات · دوري ثم خروج مغلوب</div>
        </div>
        <div className="bg-card border border-line rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-tx tabular-nums">{MAX_TEAMS}</div>
          <div className="text-xs text-mu font-bold mt-1">فريق حد أقصى للبطولة</div>
        </div>
        <div className="bg-card border border-line rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-gold tabular-nums">5</div>
          <div className="text-xs text-mu font-bold mt-1">جوائز مالية وفردية</div>
        </div>
        <div className="bg-card border border-line rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-tx tabular-nums">8</div>
          <div className="text-xs text-mu font-bold mt-1">فرق تتأهل لربع النهائي</div>
        </div>
        <div className="col-span-2 sm:col-span-1 bg-card border border-line rounded-2xl p-4 text-center">
          <div className="text-2xl font-black text-gold tabular-nums">1500 ج</div>
          <div className="text-xs text-mu font-bold mt-1">رسوم تسجيل الفرقة</div>
        </div>
      </div>
    </section>
  );
}
