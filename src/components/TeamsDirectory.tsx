import { CheckCircle2, Clock, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  GROUPS,
  GroupId,
  TeamContactDoc,
  TeamDoc,
} from '../types/tournament';
import { getTeamsInGroup } from '../utils/tournament';

interface TeamsDirectoryProps {
  teams: TeamDoc[];
  contacts: Record<string, TeamContactDoc>;
  isAdmin: boolean;
  currentUid: string | null;
  onTogglePaid: (team: TeamDoc) => Promise<void>;
  onDeleteTeam: (teamId: string) => Promise<void>;
  onJumpToGroup: (group: GroupId) => void;
}

export function TeamsDirectory({
  teams,
  contacts,
  isAdmin,
  currentUid,
  onTogglePaid,
  onDeleteTeam,
  onJumpToGroup,
}: TeamsDirectoryProps) {
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!armedDeleteId) return;
    const timer = window.setTimeout(() => setArmedDeleteId(null), 4000);
    return () => window.clearTimeout(timer);
  }, [armedDeleteId]);

  const handleTogglePaid = async (team: TeamDoc) => {
    setBusyId(team.id);
    try {
      await onTogglePaid(team);
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (teamId: string) => {
    if (armedDeleteId !== teamId) {
      setArmedDeleteId(teamId);
      return;
    }
    setArmedDeleteId(null);
    setBusyId(teamId);
    try {
      await onDeleteTeam(teamId);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section id="teams" className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-10">
      <div className="space-y-5">
        <div className="flex flex-wrap justify-between items-end gap-3">
          <h2 className="text-3xl font-black text-tx">الفرق المسجلة</h2>
          <span className="text-sm font-bold text-gold tabular-nums">
            {teams.length} فريق مسجل
          </span>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {teams.length > 0 ? (
            teams.map((team) => {
              const contact = contacts[team.id];
              const canSeeContact = isAdmin || (currentUid !== null && team.ownerUid === currentUid);

              return (
                <article
                  key={team.id}
                  className="bg-card border border-line rounded-2xl p-4 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 text-xs font-bold text-mu">
                      <span className="text-gold">مجموعة {team.group}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{team.players.length} لاعبين</span>
                      <span className="mr-auto inline-flex items-center gap-1 text-[11px] font-bold">
                        {team.paid ? (
                          <span className="inline-flex items-center gap-1 text-gold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>مدفوع</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-mu">
                            <Clock className="w-3.5 h-3.5" />
                            <span>قيد التأكيد</span>
                          </span>
                        )}
                      </span>
                    </div>

                    <h3 className="font-black text-lg text-tx truncate">{team.name}</h3>

                    <div className="flex flex-wrap gap-1.5">
                      {team.players.map((player, idx) => (
                        <span
                          key={`${player}-${idx}`}
                          className="text-xs bg-surf border border-line/60 rounded-lg px-2 py-0.5 text-tx"
                        >
                          {player}
                        </span>
                      ))}
                    </div>
                  </div>

                  {canSeeContact && (
                    <div className="pt-3 border-t border-line/70 space-y-2.5">
                      {contact ? (
                        <p className="text-xs text-mu font-bold tabular-nums" dir="ltr">
                          {contact.phone}
                          {contact.ref ? ` · ${contact.ref}` : ''}
                        </p>
                      ) : (
                        <p className="text-xs text-mu">لا توجد بيانات تواصل مسجلة</p>
                      )}

                      {isAdmin && (
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={busyId === team.id}
                            onClick={() => handleTogglePaid(team)}
                            className="flex-1 border border-line bg-surf text-tx font-bold rounded-xl px-2.5 py-1.5 text-xs hover:border-gold transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {team.paid ? 'إلغاء تأكيد الدفع' : 'تأكيد الدفع'}
                          </button>
                          <button
                            type="button"
                            disabled={busyId === team.id}
                            onClick={() => handleDelete(team.id)}
                            className={`inline-flex items-center gap-1 border rounded-xl px-2.5 py-1.5 text-xs font-bold transition-colors cursor-pointer disabled:opacity-50 ${
                              armedDeleteId === team.id
                                ? 'border-bad bg-bad/15 text-bad'
                                : 'border-line bg-surf text-bad hover:border-bad'
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{armedDeleteId === team.id ? 'تأكيد؟' : 'حذف'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </article>
              );
            })
          ) : (
            <div className="col-span-full bg-card border border-line rounded-2xl p-8 text-center text-mu font-bold">
              لم يتم تسجيل فرق بعد. كن أول فريق يحجز مكانه في البطولة!
            </div>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-xl font-black text-tx">ملخص المجموعات</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {GROUPS.map((g) => {
            const groupTeams = getTeamsInGroup(teams, g);
            return (
              <button
                key={g}
                type="button"
                onClick={() => {
                  onJumpToGroup(g);
                  document.getElementById('center')?.scrollIntoView({ behavior: 'smooth' });
                }}
                className="bg-card border border-line rounded-2xl p-4 text-right hover:border-gold transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between font-black">
                  <span className="text-gold">المجموعة {g}</span>
                  <span className="text-xs text-mu tabular-nums">{groupTeams.length}/4</span>
                </div>
                <ul className="text-sm mt-3 space-y-1.5 text-tx font-semibold">
                  {groupTeams.length > 0 ? (
                    groupTeams.map((t) => (
                      <li key={t.id} className="truncate">
                        {t.name}
                      </li>
                    ))
                  ) : (
                    <li className="text-mu text-xs">لا توجد فرق</li>
                  )}
                </ul>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
