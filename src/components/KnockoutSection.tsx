import { Award, Save, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  KNOCKOUT_SLOTS,
  KnockoutMatchDoc,
  KnockoutSlotId,
  MATCH_DATE_MAX_LENGTH,
  MATCH_TIME_MAX_LENGTH,
  TEAM_NAME_MAX_LENGTH,
  TeamDoc,
} from '../types/tournament';

interface KnockoutSectionProps {
  teams: TeamDoc[];
  knockoutMatches: Record<string, KnockoutMatchDoc>;
  isAdmin: boolean;
  onSaveKnockoutMatch: (payload: {
    id: KnockoutSlotId;
    round: 'QF' | 'SF' | 'FINAL';
    label: string;
    homeName: string;
    awayName: string;
    hs: number | null;
    aw: number | null;
    date: string;
    time: string;
    winnerName: string;
  }) => Promise<void>;
}

interface DraftSlot {
  homeName: string;
  awayName: string;
  hs: string;
  aw: string;
  date: string;
  time: string;
  winnerName: string;
}

export function KnockoutSection({
  teams,
  knockoutMatches,
  isAdmin,
  onSaveKnockoutMatch,
}: KnockoutSectionProps) {
  const [drafts, setDrafts] = useState<Record<string, DraftSlot>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const qualifiedTeams = teams.filter((t) => t.qualified);

  useEffect(() => {
    const next: Record<string, DraftSlot> = {};
    for (const slot of KNOCKOUT_SLOTS) {
      const saved = knockoutMatches[slot.id];
      next[slot.id] = {
        homeName: saved?.homeName ?? '',
        awayName: saved?.awayName ?? '',
        hs: saved?.hs !== null && saved?.hs !== undefined ? String(saved.hs) : '',
        aw: saved?.aw !== null && saved?.aw !== undefined ? String(saved.aw) : '',
        date: saved?.date ?? '',
        time: saved?.time ?? '',
        winnerName: saved?.winnerName ?? '',
      };
    }
    setDrafts(next);
  }, [knockoutMatches]);

  const updateDraft = (id: string, field: keyof DraftSlot, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? {
          homeName: '',
          awayName: '',
          hs: '',
          aw: '',
          date: '',
          time: '',
          winnerName: '',
        }),
        [field]: value,
      },
    }));
  };

  const parseScore = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const val = Number.parseInt(trimmed, 10);
    if (Number.isNaN(val)) return null;
    return Math.max(0, Math.min(99, val));
  };

  const handleSave = async (slot: (typeof KNOCKOUT_SLOTS)[number]) => {
    const d = drafts[slot.id] ?? {
      homeName: '',
      awayName: '',
      hs: '',
      aw: '',
      date: '',
      time: '',
      winnerName: '',
    };
    setSavingId(slot.id);
    try {
      await onSaveKnockoutMatch({
        id: slot.id,
        round: slot.round,
        label: slot.label,
        homeName: d.homeName.trim().slice(0, TEAM_NAME_MAX_LENGTH),
        awayName: d.awayName.trim().slice(0, TEAM_NAME_MAX_LENGTH),
        hs: parseScore(d.hs),
        aw: parseScore(d.aw),
        date: d.date.trim().slice(0, MATCH_DATE_MAX_LENGTH),
        time: d.time.trim().slice(0, MATCH_TIME_MAX_LENGTH),
        winnerName: d.winnerName.trim().slice(0, TEAM_NAME_MAX_LENGTH),
      });
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section id="knockout" className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Award className="w-7 h-7 text-gold shrink-0" />
            <h2 className="text-3xl font-black text-tx">المتأهلون والأدوار الإقصائية</h2>
          </div>
          <span className="text-xs font-bold text-mu">
            {isAdmin
              ? 'يمكنك تحديد المتأهلين وإدارة مواجهات ربع ونصف النهائي والنهائي'
              : 'متابعة الفرق المتأهلة ومواعيد ونتائج الأدوار الإقصائية'}
          </span>
        </div>

        <div className="bg-card border border-line rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between text-sm font-black">
            <span className="text-tx">الفرق المتأهلة رسمياً</span>
            <span className="text-gold tabular-nums">{qualifiedTeams.length} من 8</span>
          </div>
          {qualifiedTeams.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {qualifiedTeams.map((t) => (
                <div
                  key={t.id}
                  className="bg-surf border border-line/70 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2 text-sm font-bold"
                >
                  <span className="truncate text-tx">{t.name}</span>
                  <span className="text-xs text-gold shrink-0">مجموعة {t.group}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-mu font-bold">
              سيتم عرض الفرق المتأهلة هنا فور اعتمادها من منظم البطولة.
            </p>
          )}
        </div>
      </div>

      <datalist id="qualified-teams-list">
        {teams.map((t) => (
          <option key={t.id} value={t.name} />
        ))}
      </datalist>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {KNOCKOUT_SLOTS.map((slot) => {
          const saved = knockoutMatches[slot.id];
          const draft = drafts[slot.id] ?? {
            homeName: '',
            awayName: '',
            hs: '',
            aw: '',
            date: '',
            time: '',
            winnerName: '',
          };
          const hasScore =
            saved?.hs !== null &&
            saved?.hs !== undefined &&
            saved?.aw !== null &&
            saved?.aw !== undefined;
          const isFinal = slot.round === 'FINAL';

          return (
            <div
              key={slot.id}
              className={`bg-card border rounded-2xl p-4 space-y-3 ${
                isFinal ? 'border-gold md:col-span-2 lg:col-span-3' : 'border-line'
              }`}
            >
              <div className="flex items-center justify-between gap-2 border-b border-line/70 pb-2.5">
                <div className="flex items-center gap-2">
                  {isFinal && <Trophy className="w-4 h-4 text-gold" />}
                  <h3 className="font-black text-sm text-gold">{slot.label}</h3>
                </div>
                {!isAdmin && (
                  <span className="text-xs text-mu font-bold">
                    {saved?.date || 'موعد يحدد قريباً'} {saved?.time ? `· ${saved.time}` : ''}
                  </span>
                )}
              </div>

              {isAdmin ? (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={draft.date}
                      maxLength={MATCH_DATE_MAX_LENGTH}
                      onChange={(e) => updateDraft(slot.id, 'date', e.target.value)}
                      placeholder="التاريخ"
                      className="bg-surf border border-line text-tx rounded-lg px-2.5 py-1.5 text-xs focus:outline-2 focus:outline-gold"
                    />
                    <input
                      value={draft.time}
                      maxLength={MATCH_TIME_MAX_LENGTH}
                      onChange={(e) => updateDraft(slot.id, 'time', e.target.value)}
                      placeholder="الوقت"
                      className="bg-surf border border-line text-tx rounded-lg px-2.5 py-1.5 text-xs focus:outline-2 focus:outline-gold"
                    />
                  </div>

                  <div className="grid grid-cols-11 gap-1.5 items-center">
                    <input
                      value={draft.homeName}
                      list="qualified-teams-list"
                      maxLength={TEAM_NAME_MAX_LENGTH}
                      onChange={(e) => updateDraft(slot.id, 'homeName', e.target.value)}
                      placeholder="الفريق 1"
                      className="col-span-4 bg-surf border border-line text-tx rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-2 focus:outline-gold"
                    />
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={draft.hs}
                      onChange={(e) => updateDraft(slot.id, 'hs', e.target.value)}
                      dir="ltr"
                      className="col-span-1 bg-surf border border-line text-tx rounded-lg py-1.5 text-xs text-center font-bold tabular-nums focus:outline-2 focus:outline-gold"
                    />
                    <span className="col-span-1 text-center font-black text-mu">:</span>
                    <input
                      type="number"
                      min={0}
                      max={99}
                      value={draft.aw}
                      onChange={(e) => updateDraft(slot.id, 'aw', e.target.value)}
                      dir="ltr"
                      className="col-span-1 bg-surf border border-line text-tx rounded-lg py-1.5 text-xs text-center font-bold tabular-nums focus:outline-2 focus:outline-gold"
                    />
                    <input
                      value={draft.awayName}
                      list="qualified-teams-list"
                      maxLength={TEAM_NAME_MAX_LENGTH}
                      onChange={(e) => updateDraft(slot.id, 'awayName', e.target.value)}
                      placeholder="الفريق 2"
                      className="col-span-4 bg-surf border border-line text-tx rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-2 focus:outline-gold"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      value={draft.winnerName}
                      list="qualified-teams-list"
                      maxLength={TEAM_NAME_MAX_LENGTH}
                      onChange={(e) => updateDraft(slot.id, 'winnerName', e.target.value)}
                      placeholder={isFinal ? 'بطل البطولة' : 'الفريق المتأهل للدور التالي'}
                      className="flex-1 bg-surf border border-line text-tx rounded-lg px-2.5 py-1.5 text-xs font-bold focus:outline-2 focus:outline-gold"
                    />
                    <button
                      type="button"
                      disabled={savingId === slot.id}
                      onClick={() => void handleSave(slot)}
                      className="inline-flex items-center gap-1 bg-gold text-on font-black rounded-lg px-3 py-1.5 text-xs cursor-pointer disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{savingId === slot.id ? 'حفظ...' : 'حفظ'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 text-sm font-bold">
                    <span className="flex-1 truncate text-tx">
                      {saved?.homeName || 'يحدد لاحقاً'}
                    </span>
                    <span
                      dir="ltr"
                      className="px-2.5 py-1 rounded-lg bg-surf border border-line/60 font-black tabular-nums text-tx"
                    >
                      {hasScore ? `${saved.hs} : ${saved.aw}` : '- : -'}
                    </span>
                    <span className="flex-1 truncate text-left text-tx">
                      {saved?.awayName || 'يحدد لاحقاً'}
                    </span>
                  </div>
                  {saved?.winnerName && (
                    <div className="text-xs font-bold text-gold">
                      {isFinal ? `البطل: ${saved.winnerName}` : `المتأهل: ${saved.winnerName}`}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
