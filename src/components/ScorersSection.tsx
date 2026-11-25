import { Goal, Minus, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import {
  PLAYER_NAME_MAX_LENGTH,
  ScorerDoc,
  TEAM_NAME_MAX_LENGTH,
  TeamDoc,
} from '../types/tournament';

interface ScorersSectionProps {
  scorers: ScorerDoc[];
  teams: TeamDoc[];
  isAdmin: boolean;
  onSaveScorer: (payload: {
    id?: string;
    playerName: string;
    teamName: string;
    goals: number;
  }) => Promise<void>;
  onDeleteScorer: (scorerId: string) => Promise<void>;
}

export function ScorersSection({
  scorers,
  teams,
  isAdmin,
  onSaveScorer,
  onDeleteScorer,
}: ScorersSectionProps) {
  const [playerName, setPlayerName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [goals, setGoals] = useState('1');
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const sortedScorers = scorers
    .slice()
    .sort((a, b) => b.goals - a.goals || a.playerName.localeCompare(b.playerName, 'ar'));

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const cleanPlayer = playerName.trim().slice(0, PLAYER_NAME_MAX_LENGTH);
    const cleanTeam = teamName.trim().slice(0, TEAM_NAME_MAX_LENGTH);
    const parsedGoals = Math.max(0, Math.min(999, Number.parseInt(goals, 10) || 0));

    if (!cleanPlayer) {
      setErrorMsg('اكتب اسم اللاعب.');
      return;
    }
    if (!cleanTeam) {
      setErrorMsg('اكتب اسم الفرقة.');
      return;
    }

    setSubmitting(true);
    try {
      await onSaveScorer({
        playerName: cleanPlayer,
        teamName: cleanTeam,
        goals: parsedGoals,
      });
      setPlayerName('');
      setTeamName('');
      setGoals('1');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStepGoals = async (scorer: ScorerDoc, delta: number) => {
    const nextGoals = Math.max(0, Math.min(999, scorer.goals + delta));
    setBusyId(scorer.id);
    try {
      await onSaveScorer({
        id: scorer.id,
        playerName: scorer.playerName,
        teamName: scorer.teamName,
        goals: nextGoals,
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section id="scorers" className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Goal className="w-7 h-7 text-gold shrink-0" />
          <h2 className="text-3xl font-black text-tx">جدول الهدافين</h2>
        </div>
        <span className="text-xs font-bold text-mu">
          {isAdmin ? 'يمكنك إضافة وتعديل أهداف اللاعبين مباشرة' : 'الترتيب الرسمي لهدافي البطولة'}
        </span>
      </div>

      {isAdmin && (
        <form
          onSubmit={handleAdd}
          noValidate
          className="bg-card border border-line rounded-2xl p-4 sm:p-5 space-y-3"
        >
          {errorMsg && (
            <div className="border border-bad bg-bad/10 rounded-xl p-2.5 text-xs font-bold text-bad">
              {errorMsg}
            </div>
          )}
          <div className="grid sm:grid-cols-4 gap-3 items-end">
            <label className="text-xs font-bold text-tx block">
              اسم اللاعب *
              <input
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={PLAYER_NAME_MAX_LENGTH}
                placeholder="مثال: كريم عادل"
                className="mt-1 w-full bg-surf border border-line text-tx rounded-xl px-3 py-2 text-sm focus:outline-2 focus:outline-gold"
              />
            </label>

            <label className="text-xs font-bold text-tx block">
              الفرقة *
              <input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                list="registered-teams-list"
                maxLength={TEAM_NAME_MAX_LENGTH}
                placeholder="اختر أو اكتب الفرقة"
                className="mt-1 w-full bg-surf border border-line text-tx rounded-xl px-3 py-2 text-sm focus:outline-2 focus:outline-gold"
              />
              <datalist id="registered-teams-list">
                {teams.map((t) => (
                  <option key={t.id} value={t.name} />
                ))}
              </datalist>
            </label>

            <label className="text-xs font-bold text-tx block">
              عدد الأهداف
              <input
                type="number"
                min={0}
                max={999}
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                dir="ltr"
                className="mt-1 w-full bg-surf border border-line text-tx rounded-xl px-3 py-2 text-sm text-center tabular-nums focus:outline-2 focus:outline-gold"
              />
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="bg-gold text-on font-black rounded-xl px-4 py-2.5 text-sm hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'جارٍ الإضافة...' : '+ إضافة هداف'}
            </button>
          </div>
        </form>
      )}

      <div className="bg-card border border-line rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm min-w-[460px]">
            <thead className="text-xs text-mu border-b border-line">
              <tr>
                <th className="p-3.5 font-bold w-14">#</th>
                <th className="p-3.5 font-bold">اللاعب</th>
                <th className="p-3.5 font-bold">الفرقة</th>
                <th className="p-3.5 font-black text-center text-gold">الأهداف</th>
                {isAdmin && <th className="p-3.5 font-bold text-center">تحكم المدير</th>}
              </tr>
            </thead>
            <tbody className="font-bold tabular-nums">
              {sortedScorers.length > 0 ? (
                sortedScorers.map((scorer, idx) => (
                  <tr
                    key={scorer.id}
                    className={`border-t border-line/70 ${idx === 0 ? 'bg-surf/75' : ''}`}
                  >
                    <td className="p-3.5 text-mu">{idx + 1}</td>
                    <td className="p-3.5 text-tx">{scorer.playerName}</td>
                    <td className="p-3.5 text-mu">{scorer.teamName}</td>
                    <td className="p-3.5 text-center text-gold font-black text-base">
                      {scorer.goals}
                    </td>
                    {isAdmin && (
                      <td className="p-3.5">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            disabled={busyId === scorer.id}
                            onClick={() => void handleStepGoals(scorer, 1)}
                            aria-label="زيادة هدف"
                            className="border border-line bg-surf text-gold rounded-lg p-1.5 hover:border-gold cursor-pointer disabled:opacity-50"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={busyId === scorer.id || scorer.goals <= 0}
                            onClick={() => void handleStepGoals(scorer, -1)}
                            aria-label="إنقاص هدف"
                            className="border border-line bg-surf text-tx rounded-lg p-1.5 hover:border-gold cursor-pointer disabled:opacity-50"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={busyId === scorer.id}
                            onClick={async () => {
                              setBusyId(scorer.id);
                              try {
                                await onDeleteScorer(scorer.id);
                              } finally {
                                setBusyId(null);
                              }
                            }}
                            aria-label="حذف الهداف"
                            className="border border-line bg-surf text-bad rounded-lg p-1.5 hover:border-bad cursor-pointer disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isAdmin ? 5 : 4} className="p-8 text-center text-mu font-bold">
                    لم يتم تسجيل أهداف بعد.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
