import { Award, CheckCircle2, LogOut, MessageSquareText, Plus, ShieldCheck, Shuffle, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  EGYPT_PHONE_PATTERN,
  GROUPS,
  GroupId,
  INSTAPAY_REF_MAX_LENGTH,
  MAX_PLAYERS,
  MAX_TEAMS,
  MIN_PLAYERS,
  PLAYER_NAME_MAX_LENGTH,
  TEAM_NAME_MAX_LENGTH,
  TeamContactDoc,
  TeamDoc,
} from '../types/tournament';
import { pickAvailableGroup } from '../utils/tournament';

interface AdminDashboardProps {
  teams: TeamDoc[];
  contacts: Record<string, TeamContactDoc>;
  onAdminRegisterTeam: (payload: {
    name: string;
    phone: string;
    group: GroupId;
    players: string[];
    ref: string;
    paid: boolean;
  }) => Promise<void>;
  onTogglePaid: (team: TeamDoc) => Promise<void>;
  onToggleQualified: (team: TeamDoc) => Promise<void>;
  onChangeTeamGroup: (team: TeamDoc, group: GroupId) => Promise<void>;
  onDeleteTeam: (teamId: string) => Promise<void>;
  onRunDraw: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onToast: (msg: string) => void;
  smsEnabled: boolean;
  onToggleSms: (next: boolean) => Promise<void>;
  onCheckSmsStatus: () => Promise<{
    configured: boolean;
    provider: string;
    senderId: string;
    targetMasked: string;
  } | null>;
  onSendTestSms: () => Promise<void>;
}

export function AdminDashboard({
  teams,
  contacts,
  onAdminRegisterTeam,
  onTogglePaid,
  onToggleQualified,
  onChangeTeamGroup,
  onDeleteTeam,
  onRunDraw,
  onSignOut,
  onToast,
  smsEnabled,
  onToggleSms,
  onCheckSmsStatus,
  onSendTestSms,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<'register' | 'teams'>('teams');
  const [teamName, setTeamName] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredGroup, setPreferredGroup] = useState<'AUTO' | GroupId>('AUTO');
  const [players, setPlayers] = useState<string[]>(Array(MIN_PLAYERS).fill(''));
  const [instaPayRef, setInstaPayRef] = useState('');
  const [paidOnCreate, setPaidOnCreate] = useState(true);
  const [formErr, setFormErr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [armedDeleteId, setArmedDeleteId] = useState<string | null>(null);
  const [drawArmed, setDrawArmed] = useState(false);
  const [smsStatus, setSmsStatus] = useState<{
    configured: boolean;
    provider: string;
    senderId: string;
    targetMasked: string;
  } | null>(null);
  const [smsBusy, setSmsBusy] = useState(false);

  useEffect(() => {
    let active = true;
    void onCheckSmsStatus().then((status) => {
      if (active && status) setSmsStatus(status);
    });
    return () => {
      active = false;
    };
  }, [onCheckSmsStatus]);

  const handleAddPlayer = () => {
    if (players.length >= MAX_PLAYERS) {
      onToast(`الحد الأقصى ${MAX_PLAYERS} لاعبين`);
      return;
    }
    setPlayers((prev) => [...prev, '']);
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErr('');

    const cleanName = teamName.trim().replace(/\s+/g, ' ');
    const cleanPhone = phone.replace(/\s/g, '');
    const cleanRef = instaPayRef.trim().slice(0, INSTAPAY_REF_MAX_LENGTH);
    const cleanPlayers = players
      .map((p) => p.trim().slice(0, PLAYER_NAME_MAX_LENGTH))
      .filter(Boolean);

    if (!cleanName || cleanName.length > TEAM_NAME_MAX_LENGTH) {
      setFormErr(`اكتب اسم الفرقة (بحد أقصى ${TEAM_NAME_MAX_LENGTH} حرف).`);
      return;
    }
    if (!EGYPT_PHONE_PATTERN.test(cleanPhone)) {
      setFormErr('رقم التليفون لازم يكون رقم مصري صحيح من 11 رقم (مثال: 01012345678).');
      return;
    }
    if (cleanPlayers.length < MIN_PLAYERS) {
      setFormErr(`لازم تكتب ${MIN_PLAYERS} لاعبين على الأقل.`);
      return;
    }
    if (new Set(cleanPlayers.map((p) => p.toLowerCase())).size !== cleanPlayers.length) {
      setFormErr('في اسم لاعب مكرر.');
      return;
    }
    if (teams.length >= MAX_TEAMS) {
      setFormErr(`اكتمل عدد الفرق (${MAX_TEAMS} فريق).`);
      return;
    }
    if (teams.some((t) => t.name.toLowerCase() === cleanName.toLowerCase())) {
      setFormErr('اسم الفرقة ده مسجل بالفعل.');
      return;
    }

    const assignedGroup = pickAvailableGroup(teams, preferredGroup);
    if (!assignedGroup) {
      setFormErr('كل المجموعات مكتملة حالياً.');
      return;
    }

    setSubmitting(true);
    try {
      await onAdminRegisterTeam({
        name: cleanName,
        phone: cleanPhone,
        group: assignedGroup,
        players: cleanPlayers,
        ref: cleanRef,
        paid: paidOnCreate,
      });
      setTeamName('');
      setPhone('');
      setPreferredGroup('AUTO');
      setPlayers(Array(MIN_PLAYERS).fill(''));
      setInstaPayRef('');
      setPaidOnCreate(true);
      setActiveTab('teams');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDraw = async () => {
    if (!drawArmed) {
      setDrawArmed(true);
      window.setTimeout(() => setDrawArmed(false), 4000);
      return;
    }
    setDrawArmed(false);
    await onRunDraw();
  };

  const qualifiedCount = teams.filter((t) => t.qualified).length;

  return (
    <section aria-label="لوحة تحكم المدير" className="max-w-6xl mx-auto px-4 sm:px-6 pb-4">
      <div className="bg-card border border-gold rounded-2xl p-5 sm:p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-gold font-black text-base">
              <ShieldCheck className="w-5 h-5" />
              <h2>لوحة تحكم المدير (سرية للمنظم فقط)</h2>
            </div>
            <p className="text-xs text-mu font-bold">
              تحكم كامل في تسجيل الفرق، النتائج، المواعيد، المتأهلين ({qualifiedCount} متأهل)، وجدول الهدافين.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleDraw}
              disabled={teams.length === 0}
              className={`inline-flex items-center gap-1.5 border font-bold rounded-xl px-3.5 py-2 text-xs whitespace-nowrap transition-colors cursor-pointer disabled:opacity-50 ${
                drawArmed
                  ? 'border-bad bg-bad/15 text-bad'
                  : 'border-line bg-surf text-tx hover:border-gold'
              }`}
            >
              <Shuffle className="w-3.5 h-3.5" />
              <span>{drawArmed ? 'تأكيد مسح النتائج وإجراء القرعة؟' : 'قرعة وتوزيع تلقائي'}</span>
            </button>

            <button
              type="button"
              onClick={() => void onSignOut()}
              className="inline-flex items-center gap-1.5 border border-line bg-surf text-tx font-bold rounded-xl px-3.5 py-2 text-xs whitespace-nowrap hover:border-bad hover:text-bad transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>خروج المدير</span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('teams')}
            className={`px-4 py-2 rounded-xl text-xs font-black border transition-colors cursor-pointer ${
              activeTab === 'teams'
                ? 'bg-gold text-on border-gold'
                : 'bg-surf text-tx border-line hover:border-gold'
            }`}
          >
            إدارة الفرق والمتأهلين ({teams.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('register')}
            className={`px-4 py-2 rounded-xl text-xs font-black border transition-colors cursor-pointer ${
              activeTab === 'register'
                ? 'bg-gold text-on border-gold'
                : 'bg-surf text-tx border-line hover:border-gold'
            }`}
          >
            + تسجيل فرقة جديدة مباشرة
          </button>
        </div>

        <div className="bg-surf border border-line rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-black text-tx">
              <MessageSquareText className="w-4 h-4 text-gold shrink-0" />
              <span>إشعارات SMS عند تسجيل أي فرقة جديدة</span>
            </div>
            <p className="text-xs text-mu font-bold">
              المرسل: <span dir="ltr" className="text-tx">RiskUp</span> · الرقم المستلم:{' '}
              <span dir="ltr" className="text-tx tabular-nums">01224656839</span>
              {smsStatus && (
                <>
                  {' '}·{' '}
                  {smsStatus.configured ? (
                    <span className="text-gold">بوابة الإرسال متصلة ({smsStatus.provider})</span>
                  ) : (
                    <span>في انتظار إضافة بيانات بوابة SMS في إعدادات الأسرار (Secrets)</span>
                  )}
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {smsStatus?.configured && (
              <button
                type="button"
                disabled={smsBusy}
                onClick={async () => {
                  setSmsBusy(true);
                  try {
                    await onSendTestSms();
                  } finally {
                    setSmsBusy(false);
                  }
                }}
                className="border border-line bg-card text-tx font-bold rounded-xl px-3 py-1.5 text-xs hover:border-gold transition-colors cursor-pointer disabled:opacity-50"
              >
                {smsBusy ? 'جارٍ الإرسال...' : 'إرسال SMS تجريبية'}
              </button>
            )}
            <button
              type="button"
              disabled={smsBusy}
              onClick={async () => {
                setSmsBusy(true);
                try {
                  await onToggleSms(!smsEnabled);
                } finally {
                  setSmsBusy(false);
                }
              }}
              className={`border font-black rounded-xl px-3.5 py-1.5 text-xs transition-colors cursor-pointer disabled:opacity-50 ${
                smsEnabled
                  ? 'border-gold bg-gold text-on'
                  : 'border-line bg-card text-mu hover:border-gold'
              }`}
            >
              {smsEnabled ? 'مفعّل' : 'متوقف — اضغط للتفعيل'}
            </button>
          </div>
        </div>

        {activeTab === 'teams' ? (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm min-w-[680px]">
              <thead className="text-xs text-mu border-b border-line">
                <tr>
                  <th className="p-2.5 font-bold">الفرقة</th>
                  <th className="p-2.5 font-bold">تليفون الكابتن</th>
                  <th className="p-2.5 font-bold">المجموعة</th>
                  <th className="p-2.5 font-bold">حالة الدفع</th>
                  <th className="p-2.5 font-bold">التأهل</th>
                  <th className="p-2.5 font-bold">حذف</th>
                </tr>
              </thead>
              <tbody className="font-bold">
                {teams.length > 0 ? (
                  teams.map((team) => {
                    const contact = contacts[team.id];
                    const isBusy = busyId === team.id;
                    return (
                      <tr key={team.id} className="border-t border-line/60">
                        <td className="p-2.5 text-tx">{team.name}</td>
                        <td className="p-2.5 text-mu tabular-nums" dir="ltr">
                          {contact?.phone || '—'}
                        </td>
                        <td className="p-2.5">
                          <select
                            aria-label={`مجموعة ${team.name}`}
                            value={team.group}
                            disabled={isBusy}
                            onChange={async (e) => {
                              setBusyId(team.id);
                              try {
                                await onChangeTeamGroup(team, e.target.value as GroupId);
                              } finally {
                                setBusyId(null);
                              }
                            }}
                            className="bg-surf border border-line text-tx rounded-lg px-2 py-1 text-xs font-bold focus:outline-2 focus:outline-gold"
                          >
                            {GROUPS.map((g) => (
                              <option key={g} value={g}>
                                المجموعة {g}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={async () => {
                              setBusyId(team.id);
                              try {
                                await onTogglePaid(team);
                              } finally {
                                setBusyId(null);
                              }
                            }}
                            className={`inline-flex items-center gap-1 border rounded-lg px-2.5 py-1 text-xs font-bold cursor-pointer ${
                              team.paid
                                ? 'border-gold bg-gold/15 text-gold'
                                : 'border-line bg-surf text-mu'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>{team.paid ? 'مدفوع' : 'غير مدفوع'}</span>
                          </button>
                        </td>
                        <td className="p-2.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={async () => {
                              setBusyId(team.id);
                              try {
                                await onToggleQualified(team);
                              } finally {
                                setBusyId(null);
                              }
                            }}
                            className={`inline-flex items-center gap-1 border rounded-lg px-2.5 py-1 text-xs font-bold cursor-pointer ${
                              team.qualified
                                ? 'border-gold bg-gold text-on'
                                : 'border-line bg-surf text-mu hover:border-gold'
                            }`}
                          >
                            <Award className="w-3.5 h-3.5" />
                            <span>{team.qualified ? 'متأهل' : 'تأهيل'}</span>
                          </button>
                        </td>
                        <td className="p-2.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={async () => {
                              if (armedDeleteId !== team.id) {
                                setArmedDeleteId(team.id);
                                window.setTimeout(() => setArmedDeleteId(null), 4000);
                                return;
                              }
                              setArmedDeleteId(null);
                              setBusyId(team.id);
                              try {
                                await onDeleteTeam(team.id);
                              } finally {
                                setBusyId(null);
                              }
                            }}
                            className={`inline-flex items-center gap-1 border rounded-lg px-2.5 py-1 text-xs font-bold cursor-pointer ${
                              armedDeleteId === team.id
                                ? 'border-bad bg-bad/15 text-bad'
                                : 'border-line bg-surf text-bad'
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>{armedDeleteId === team.id ? 'تأكيد؟' : 'حذف'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-mu">
                      لا توجد فرق مسجلة بعد.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <form onSubmit={handleAdminSubmit} noValidate className="space-y-4">
            {formErr && (
              <div className="border border-bad bg-bad/10 rounded-xl p-3 text-xs font-bold text-bad">
                {formErr}
              </div>
            )}
            <div className="grid sm:grid-cols-4 gap-3">
              <label className="text-xs font-bold text-tx block">
                اسم الفرقة *
                <input
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  maxLength={TEAM_NAME_MAX_LENGTH}
                  placeholder="مثال: نسور التجمع"
                  className="mt-1 w-full bg-surf border border-line text-tx rounded-xl px-3 py-2 text-sm focus:outline-2 focus:outline-gold"
                />
              </label>
              <label className="text-xs font-bold text-tx block">
                تليفون الكابتن *
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  type="tel"
                  dir="ltr"
                  maxLength={11}
                  placeholder="01012345678"
                  className="mt-1 w-full bg-surf border border-line text-tx rounded-xl px-3 py-2 text-sm text-right tabular-nums focus:outline-2 focus:outline-gold"
                />
              </label>
              <label className="text-xs font-bold text-tx block">
                المجموعة
                <select
                  value={preferredGroup}
                  onChange={(e) => setPreferredGroup(e.target.value as 'AUTO' | GroupId)}
                  className="mt-1 w-full bg-surf border border-line text-tx rounded-xl px-3 py-2 text-sm focus:outline-2 focus:outline-gold"
                >
                  <option value="AUTO">توزيع تلقائي</option>
                  {GROUPS.map((g) => (
                    <option key={g} value={g}>
                      المجموعة {g}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-bold text-tx block">
                الدفع
                <select
                  value={paidOnCreate ? 'paid' : 'unpaid'}
                  onChange={(e) => setPaidOnCreate(e.target.value === 'paid')}
                  className="mt-1 w-full bg-surf border border-line text-tx rounded-xl px-3 py-2 text-sm focus:outline-2 focus:outline-gold"
                >
                  <option value="paid">مدفوع</option>
                  <option value="unpaid">غير مدفوع</option>
                </select>
              </label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-tx">اللاعبون (5–8 لاعبين) *</span>
                <button
                  type="button"
                  onClick={handleAddPlayer}
                  className="inline-flex items-center gap-1 border border-line bg-surf text-tx font-bold rounded-lg px-2.5 py-1 text-xs cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>احتياطي</span>
                </button>
              </div>
              <div className="grid sm:grid-cols-4 gap-2">
                {players.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                    <input
                      value={p}
                      onChange={(e) =>
                        setPlayers((prev) =>
                          prev.map((item, i) => (i === idx ? e.target.value : item))
                        )
                      }
                      maxLength={PLAYER_NAME_MAX_LENGTH}
                      placeholder={idx < MIN_PLAYERS ? `لاعب ${idx + 1}` : `احتياطي ${idx - MIN_PLAYERS + 1}`}
                      className="w-full bg-surf border border-line text-tx rounded-xl px-3 py-2 text-xs focus:outline-2 focus:outline-gold"
                    />
                    {idx >= MIN_PLAYERS && (
                      <button
                        type="button"
                        onClick={() =>
                          setPlayers((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="border border-line bg-surf text-mu hover:text-bad rounded-lg p-1.5 cursor-pointer"
                        aria-label="حذف"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-3 items-end">
              <label className="text-xs font-bold text-tx block sm:col-span-2">
                رقم مرجع الدفع / ملاحظة (اختياري)
                <input
                  value={instaPayRef}
                  onChange={(e) => setInstaPayRef(e.target.value)}
                  maxLength={INSTAPAY_REF_MAX_LENGTH}
                  placeholder="رقم عملية InstaPay أو كاش"
                  className="mt-1 w-full bg-surf border border-line text-tx rounded-xl px-3 py-2 text-sm focus:outline-2 focus:outline-gold"
                />
              </label>
              <button
                type="submit"
                disabled={submitting}
                className="bg-gold text-on font-black rounded-xl px-4 py-2.5 text-sm hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'جارٍ التسجيل...' : 'حفظ وتسجيل الفرقة'}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
