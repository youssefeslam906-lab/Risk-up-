import { Shuffle, Save } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  GROUPS,
  GroupId,
  MATCH_DATE_MAX_LENGTH,
  MATCH_TIME_MAX_LENGTH,
  MAX_TEAMS_PER_GROUP,
  MatchDoc,
  TeamDoc,
} from '../types/tournament';
import {
  buildGroupPairs,
  computeStandings,
  getTeamsInGroup,
} from '../utils/tournament';

interface GroupsAndMatchesProps {
  teams: TeamDoc[];
  matches: Record<string, MatchDoc>;
  activeGroup: GroupId;
  onSelectGroup: (group: GroupId) => void;
  isAdmin: boolean;
  onSaveMatch: (params: {
    id: string;
    group: GroupId;
    homeTeamId: string;
    awayTeamId: string;
    hs: number | null;
    aw: number | null;
    date: string;
    time: string;
  }) => Promise<void>;
  onRunDraw: () => Promise<void>;
}

interface DraftMatchInput {
  hs: string;
  aw: string;
  date: string;
  time: string;
}

export function GroupsAndMatches({
  teams,
  matches,
  activeGroup,
  onSelectGroup,
  isAdmin,
  onSaveMatch,
  onRunDraw,
}: GroupsAndMatchesProps) {
  const [drafts, setDrafts] = useState<Record<string, DraftMatchInput>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drawArmed, setDrawArmed] = useState(false);
  const [drawing, setDrawing] = useState(false);

  const pairs = buildGroupPairs(teams, activeGroup);
  const standings = computeStandings(teams, matches, activeGroup);
  const pairsSignature = pairs.map((p) => p.id).join('|');

  useEffect(() => {
    const next: Record<string, DraftMatchInput> = {};
    for (const p of pairs) {
      const existing = matches[p.id];
      next[p.id] = {
        hs: existing?.hs !== null && existing?.hs !== undefined ? String(existing.hs) : '',
        aw: existing?.aw !== null && existing?.aw !== undefined ? String(existing.aw) : '',
        date: existing?.date ?? '',
        time: existing?.time ?? '',
      };
    }
    setDrafts(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroup, matches, pairsSignature]);

  useEffect(() => {
    if (!drawArmed) return;
    const timer = window.setTimeout(() => setDrawArmed(false), 4000);
    return () => window.clearTimeout(timer);
  }, [drawArmed]);

  const updateDraft = (matchId: string, field: keyof DraftMatchInput, value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [matchId]: {
        ...(prev[matchId] ?? { hs: '', aw: '', date: '', time: '' }),
        [field]: value,
      },
    }));
  };

  const parseScore = (raw: string): number | null => {
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    const parsed = Number.parseInt(trimmed, 10);
    if (Number.isNaN(parsed)) return null;
    return Math.max(0, Math.min(99, parsed));
  };

  const handleSave = async (pairId: string, homeTeamId: string, awayTeamId: string) => {
    const draft = drafts[pairId] ?? { hs: '', aw: '', date: '', time: '' };
    setSavingId(pairId);
    try {
      await onSaveMatch({
        id: pairId,
        group: activeGroup,
        homeTeamId,
        awayTeamId,
        hs: parseScore(draft.hs),
        aw: parseScore(draft.aw),
        date: draft.date.trim().slice(0, MATCH_DATE_MAX_LENGTH),
        time: draft.time.trim().slice(0, MATCH_TIME_MAX_LENGTH),
      });
    } finally {
      setSavingId(null);
    }
  };

  const handleDrawClick = async () => {
    if (!drawArmed) {
      setDrawArmed(true);
      return;
    }
    setDrawArmed(false);
    setDrawing(true);
    try {
      await onRunDraw();
    } finally {
      setDrawing(false);
    }
  };

  return (
    <section id="center" className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-3xl font-black text-tx">المجموعات والماتشات والنقاط</h2>
        {isAdmin && (
          <button
            type="button"
            disabled={drawing || teams.length === 0}
            onClick={handleDrawClick}
            className={`inline-flex items-center gap-2 border font-bold rounded-xl px-4 py-2 text-xs whitespace-nowrap transition-colors cursor-pointer disabled:opacity-50 ${
              drawArmed
                ? 'border-bad bg-bad/15 text-bad'
                : 'border-line bg-surf text-tx hover:border-gold'
            }`}
          >
            <Shuffle className="w-4 h-4" />
            <span>
              {drawing
                ? 'جارٍ تنفيذ القرعة...'
                : drawArmed
                ? 'سيتم مسح كل النتائج الحالية — اضغط للتأكيد'
                : 'إجراء قرعة وتوزيع تلقائي (للأدمن)'}
            </span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" role="tablist" aria-label="المجموعات">
        {GROUPS.map((g) => {
          const count = getTeamsInGroup(teams, g).length;
          const isActive = g === activeGroup;
          return (
            <button
              key={g}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelectGroup(g)}
              className={`border rounded-2xl px-4 py-3 flex items-center justify-between font-black text-sm transition-colors cursor-pointer ${
                isActive
                  ? 'bg-gold text-on border-gold'
                  : 'bg-card text-tx border-line hover:border-gold'
              }`}
            >
              <span className="whitespace-nowrap">المجموعة {g}</span>
              <span
                className={`text-xs font-bold tabular-nums ${
                  isActive ? 'text-on/80' : 'text-mu'
                }`}
              >
                {count}/{MAX_TEAMS_PER_GROUP}
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 bg-card border border-line rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-line flex flex-wrap justify-between items-center gap-2">
            <h3 className="font-black text-lg text-tx">ترتيب المجموعة {activeGroup}</h3>
            <span className="text-xs text-gold font-bold">
              فوز 3 · تعادل 1 · يتأهل أول وثاني
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm min-w-[500px]">
              <thead className="text-mu text-xs border-b border-line">
                <tr>
                  <th className="p-3 font-bold">#</th>
                  <th className="p-3 font-bold">الفرقة</th>
                  <th className="p-2 font-bold text-center">لعب</th>
                  <th className="p-2 font-bold text-center">فاز</th>
                  <th className="p-2 font-bold text-center">تعادل</th>
                  <th className="p-2 font-bold text-center">خسر</th>
                  <th className="p-2 font-bold text-center">أهداف</th>
                  <th className="p-2 font-bold text-center">فارق</th>
                  <th className="p-3 font-black text-center text-gold">نقاط</th>
                </tr>
              </thead>
              <tbody className="font-bold tabular-nums">
                {standings.length > 0 ? (
                  standings.map((row, idx) => (
                    <tr
                      key={row.team.id}
                      className={`border-t border-line/70 ${
                        idx < 2 ? 'bg-surf/75' : ''
                      }`}
                    >
                      <td className="p-3 text-mu">{idx + 1}</td>
                      <td className="p-3 text-tx max-w-[180px]">
                        <div className="flex items-center gap-2">
                          <span className="truncate">{row.team.name}</span>
                          {row.team.qualified && (
                            <span className="text-[11px] font-black text-gold shrink-0">
                              · متأهل
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-2 text-center">{row.played}</td>
                      <td className="p-2 text-center">{row.won}</td>
                      <td className="p-2 text-center">{row.drawn}</td>
                      <td className="p-2 text-center">{row.lost}</td>
                      <td className="p-2 text-center" dir="ltr">
                        {row.gf}:{row.ga}
                      </td>
                      <td className="p-2 text-center" dir="ltr">
                        {row.gd > 0 ? `+${row.gd}` : row.gd}
                      </td>
                      <td className="p-3 text-center text-gold font-black">{row.pts}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-mu font-bold">
                      لا توجد فرق في هذه المجموعة بعد.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <p className="p-3 text-xs text-mu border-t border-line">
            الترتيب: النقاط ثم فارق الأهداف ثم الأهداف المسجلة.
          </p>
        </div>

        <div className="lg:col-span-5 bg-card border border-line rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-line space-y-0.5">
            <h3 className="font-black text-lg text-tx">ماتشات المجموعة {activeGroup}</h3>
            <p className="text-xs text-mu font-bold">
              {isAdmin
                ? 'وضع الأدمن: عدّل الموعد والنتيجة واضغط حفظ'
                : 'النتائج والمواعيد يحدّثها المنظم مباشرة'}
            </p>
          </div>

          <div className="p-4 space-y-3 max-h-[540px] overflow-y-auto">
            {pairs.length > 0 ? (
              pairs.map((pair) => {
                const saved = matches[pair.id];
                const draft = drafts[pair.id] ?? { hs: '', aw: '', date: '', time: '' };
                const hasScore =
                  saved?.hs !== null &&
                  saved?.hs !== undefined &&
                  saved?.aw !== null &&
                  saved?.aw !== undefined;

                return (
                  <div
                    key={pair.id}
                    className="bg-surf border border-line/60 rounded-xl p-3.5 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-mu font-bold">
                      {isAdmin ? (
                        <div className="grid grid-cols-2 gap-2 w-full">
                          <input
                            value={draft.date}
                            maxLength={MATCH_DATE_MAX_LENGTH}
                            onChange={(e) => updateDraft(pair.id, 'date', e.target.value)}
                            placeholder="التاريخ (مثال: الجمعة 12/5)"
                            className="bg-card border border-line text-tx rounded-lg px-2.5 py-1.5 text-xs focus:outline-2 focus:outline-gold"
                          />
                          <input
                            value={draft.time}
                            maxLength={MATCH_TIME_MAX_LENGTH}
                            onChange={(e) => updateDraft(pair.id, 'time', e.target.value)}
                            placeholder="الوقت (مثال: 9:00 م)"
                            className="bg-card border border-line text-tx rounded-lg px-2.5 py-1.5 text-xs focus:outline-2 focus:outline-gold"
                          />
                        </div>
                      ) : (
                        <>
                          <span>{saved?.date || 'موعد يحدد قريباً'}</span>
                          <span className="text-gold">{saved?.time || ''}</span>
                        </>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 text-sm font-bold">
                      <span className="flex-1 truncate text-tx">{pair.home.name}</span>
                      <div className="flex items-center gap-1.5 shrink-0 tabular-nums" dir="ltr">
                        {isAdmin ? (
                          <>
                            <input
                              type="number"
                              min={0}
                              max={99}
                              value={draft.hs}
                              onChange={(e) => updateDraft(pair.id, 'hs', e.target.value)}
                              aria-label={`أهداف ${pair.home.name}`}
                              className="w-12 bg-card border border-line text-tx text-center rounded-lg py-1 px-1 text-sm font-bold focus:outline-2 focus:outline-gold"
                            />
                            <span className="font-black text-mu">:</span>
                            <input
                              type="number"
                              min={0}
                              max={99}
                              value={draft.aw}
                              onChange={(e) => updateDraft(pair.id, 'aw', e.target.value)}
                              aria-label={`أهداف ${pair.away.name}`}
                              className="w-12 bg-card border border-line text-tx text-center rounded-lg py-1 px-1 text-sm font-bold focus:outline-2 focus:outline-gold"
                            />
                          </>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg bg-card border border-line/60 font-black text-tx">
                            {hasScore ? `${saved.hs} : ${saved.aw}` : '- : -'}
                          </span>
                        )}
                      </div>
                      <span className="flex-1 truncate text-left text-tx">{pair.away.name}</span>
                    </div>

                    {isAdmin && (
                      <button
                        type="button"
                        disabled={savingId === pair.id}
                        onClick={() => handleSave(pair.id, pair.home.id, pair.away.id)}
                        className="w-full inline-flex items-center justify-center gap-1.5 border border-line bg-card text-tx font-bold rounded-lg py-1.5 text-xs hover:border-gold transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>{savingId === pair.id ? 'جارٍ الحفظ...' : 'حفظ النتيجة والموعد'}</span>
                      </button>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="text-center text-mu text-sm py-8 font-bold">
                أضف فريقين على الأقل في المجموعة لعرض الماتشات.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
