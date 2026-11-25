import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { AdminDashboard } from './components/AdminDashboard';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GroupsAndMatches } from './components/GroupsAndMatches';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { KnockoutSection } from './components/KnockoutSection';
import { RegistrationForm } from './components/RegistrationForm';
import { ScorersSection } from './components/ScorersSection';
import { TeamsDirectory } from './components/TeamsDirectory';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  GROUPS,
  GroupId,
  KnockoutMatchDoc,
  KnockoutSlotId,
  MatchDoc,
  ScorerDoc,
  TeamContactDoc,
  TeamDoc,
} from './types/tournament';
import { extractTimestampMs } from './utils/tournament';

function TournamentApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [teams, setTeams] = useState<TeamDoc[]>([]);
  const [matches, setMatches] = useState<Record<string, MatchDoc>>({});
  const [knockoutMatches, setKnockoutMatches] = useState<Record<string, KnockoutMatchDoc>>({});
  const [scorers, setScorers] = useState<ScorerDoc[]>([]);
  const [contacts, setContacts] = useState<Record<string, TeamContactDoc>>({});
  const [activeGroup, setActiveGroup] = useState<GroupId>('A');
  const [toastMsg, setToastMsg] = useState('');
  const [authError, setAuthError] = useState<{ code: string; message: string; inIframe: boolean } | null>(null);
  const [isDark, setIsDark] = useState(true);

  const isAdmin =
    Boolean(user?.emailVerified) && user?.email === BOOTSTRAPPED_ADMIN_EMAIL;
  const approvedTeams = teams.filter((team) => team.status !== 'pending');
  const pendingTeams = teams.filter((team) => team.status === 'pending');

  const showToast = (msg: string) => {
    setToastMsg(msg);
  };

  useEffect(() => {
    if (!toastMsg) return;
    const timer = window.setTimeout(() => setToastMsg(''), 3500);
    return () => window.clearTimeout(timer);
  }, [toastMsg]);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  // Listen to Firebase Auth state and handle redirect results
  useEffect(() => {
    getRedirectResult(auth)
      .then((cred) => {
        if (cred?.user) {
          setAuthError(null);
          if (cred.user.email === BOOTSTRAPPED_ADMIN_EMAIL && cred.user.emailVerified) {
            showToast('تم فتح لوحة تحكم المدير');
          } else {
            showToast('تم تسجيل الدخول بنجاح');
          }
        }
      })
      .catch((error: unknown) => {
        const err = error as { code?: string; message?: string };
        console.error('Auth redirect error:', err);
      });

    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Public real-time listeners for teams, group matches, knockout matches, and scorers
  useEffect(() => {
    const unsubTeams = onSnapshot(
      collection(db, 'teams'),
      (snap) => {
        const list = snap.docs
          .map((d) => {
            const data = d.data() as Omit<TeamDoc, 'id'>;
            return {
              ...data,
              id: d.id,
              createdAtMs: extractTimestampMs(data.createdAt),
            };
          })
          .sort((a, b) => (a.createdAtMs || 0) - (b.createdAtMs || 0));
        setTeams(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'teams')
    );

    const unsubMatches = onSnapshot(
      collection(db, 'matches'),
      (snap) => {
        const map: Record<string, MatchDoc> = {};
        for (const d of snap.docs) {
          map[d.id] = { ...(d.data() as Omit<MatchDoc, 'id'>), id: d.id };
        }
        setMatches(map);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'matches')
    );

    const unsubKnockout = onSnapshot(
      collection(db, 'knockout_matches'),
      (snap) => {
        const map: Record<string, KnockoutMatchDoc> = {};
        for (const d of snap.docs) {
          map[d.id] = { ...(d.data() as Omit<KnockoutMatchDoc, 'id'>), id: d.id as KnockoutSlotId };
        }
        setKnockoutMatches(map);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'knockout_matches')
    );

    const unsubScorers = onSnapshot(
      collection(db, 'scorers'),
      (snap) => {
        const list = snap.docs.map((d) => ({
          ...(d.data() as Omit<ScorerDoc, 'id'>),
          id: d.id,
        }));
        setScorers(list);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'scorers')
    );

    return () => {
      unsubTeams();
      unsubMatches();
      unsubKnockout();
      unsubScorers();
    };
  }, []);

  // Isolated PII listener for team_contacts (scoped by ownerUid or sole admin)
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) {
      setContacts({});
      return;
    }

    const contactsPath = 'team_contacts';
    const contactsQuery = isAdmin
      ? collection(db, contactsPath)
      : query(collection(db, contactsPath), where('ownerUid', '==', user.uid));

    const unsubContacts = onSnapshot(
      contactsQuery,
      (snap) => {
        const map: Record<string, TeamContactDoc> = {};
        for (const d of snap.docs) {
          map[d.id] = d.data() as TeamContactDoc;
        }
        setContacts(map);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, contactsPath)
    );

    return () => unsubContacts();
  }, [authReady, user, isAdmin]);

  const handleSignIn = async (): Promise<User | null> => {
    setAuthError(null);
    const inIframe = (() => {
      try {
        return window.self !== window.top;
      } catch {
        return true;
      }
    })();

    try {
      const cred = await signInWithPopup(auth, googleProvider);
      if (cred.user.email === BOOTSTRAPPED_ADMIN_EMAIL && cred.user.emailVerified) {
        showToast('تم فتح لوحة تحكم المدير');
      } else {
        showToast('تم تسجيل الدخول بنجاح');
      }
      return cred.user;
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      const code = err?.code ?? 'unknown';
      console.error('Google sign-in error:', code, err?.message);

      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        showToast('تم إغلاق نافذة تسجيل الدخول قبل الإتمام');
        return null;
      }

      if (
        !inIframe &&
        (code === 'auth/popup-blocked' ||
          code === 'auth/operation-not-supported-in-this-environment')
      ) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return null;
        } catch (redirectErr: unknown) {
          const rErr = redirectErr as { code?: string; message?: string };
          setAuthError({
            code: rErr?.code ?? code,
            message: 'تعذر فتح نافذة تسجيل دخول جوجل تلقائياً.',
            inIframe,
          });
          return null;
        }
      }

      const readableMessage =
        code === 'auth/popup-blocked'
          ? 'المتصفح منع فتح نافذة تسجيل الدخول المنبثقة (Pop-up).'
          : code === 'auth/unauthorized-domain'
          ? `هذا الرابط (${window.location.hostname}) غير مضاف في النطاقات المصرح بها في Firebase Auth.`
          : 'تعذر إتمام تسجيل الدخول بحساب جوجل داخل هذه النافذة.';

      setAuthError({
        code,
        message: readableMessage,
        inIframe,
      });
      showToast(readableMessage);
      return null;
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    showToast('تم تسجيل الخروج');
  };

  const handleRegisterTeam = async (payload: {
    name: string;
    phone: string;
    group: GroupId;
    players: string[];
    ref: string;
    paid?: boolean;
    isAdminDirect?: boolean;
  }) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('AUTH_REQUIRED');
    }

    const isDirectApproval = Boolean(isAdmin && payload.isAdminDirect);
    const teamId = `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const batch = writeBatch(db);
    const now = serverTimestamp();

    batch.set(doc(db, 'teams', teamId), {
      id: teamId,
      name: payload.name,
      group: payload.group,
      players: payload.players,
      paid: Boolean(isAdmin && payload.paid),
      qualified: false,
      status: isDirectApproval ? 'approved' : 'pending',
      ownerUid: currentUser.uid,
      createdAt: now,
    });

    batch.set(doc(db, 'team_contacts', teamId), {
      teamId,
      ownerUid: currentUser.uid,
      phone: payload.phone,
      ref: payload.ref,
      createdAt: now,
    });

    try {
      await batch.commit();
      showToast(
        isDirectApproval
          ? `تم تسجيل «${payload.name}» في المجموعة ${payload.group}`
          : `تم إرسال طلب تسجيل «${payload.name}» وهو في انتظار موافقة المدير`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `teams/${teamId}`);
    }
  };

  const handleApproveTeam = async (
    team: TeamDoc,
    options?: { group?: GroupId; paid?: boolean }
  ) => {
    const path = `teams/${team.id}`;
    const updates: Partial<Pick<TeamDoc, 'status' | 'group' | 'paid'>> = {
      status: 'approved',
    };
    if (options?.group) {
      updates.group = options.group;
    }
    if (options?.paid !== undefined) {
      updates.paid = options.paid;
    }
    try {
      await updateDoc(doc(db, 'teams', team.id), updates);
      showToast(`تم قبول «${team.name}» وإضافته إلى البطولة`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleSaveMatch = async (params: {
    id: string;
    group: GroupId;
    homeTeamId: string;
    awayTeamId: string;
    hs: number | null;
    aw: number | null;
    date: string;
    time: string;
  }) => {
    const path = `matches/${params.id}`;
    try {
      await setDoc(doc(db, 'matches', params.id), {
        id: params.id,
        group: params.group,
        homeTeamId: params.homeTeamId,
        awayTeamId: params.awayTeamId,
        hs: params.hs,
        aw: params.aw,
        date: params.date,
        time: params.time,
        updatedAt: serverTimestamp(),
      });
      showToast('تم حفظ النتيجة وتحديث الجدول');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const handleSaveKnockoutMatch = async (payload: {
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
  }) => {
    const path = `knockout_matches/${payload.id}`;
    try {
      await setDoc(doc(db, 'knockout_matches', payload.id), {
        id: payload.id,
        round: payload.round,
        label: payload.label,
        homeName: payload.homeName,
        awayName: payload.awayName,
        hs: payload.hs,
        aw: payload.aw,
        date: payload.date,
        time: payload.time,
        winnerName: payload.winnerName,
        updatedAt: serverTimestamp(),
      });
      showToast(`تم حفظ ${payload.label}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const handleSaveScorer = async (payload: {
    id?: string;
    playerName: string;
    teamName: string;
    goals: number;
  }) => {
    const scorerId =
      payload.id ?? `sc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const path = `scorers/${scorerId}`;
    try {
      await setDoc(doc(db, 'scorers', scorerId), {
        id: scorerId,
        playerName: payload.playerName,
        teamName: payload.teamName,
        goals: payload.goals,
        updatedAt: serverTimestamp(),
      });
      showToast('تم تحديث جدول الهدافين');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  };

  const handleDeleteScorer = async (scorerId: string) => {
    const path = `scorers/${scorerId}`;
    try {
      await deleteDoc(doc(db, 'scorers', scorerId));
      showToast('تم حذف اللاعب من جدول الهدافين');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const handleRunDraw = async () => {
    if (approvedTeams.length === 0) return;
    const shuffled = approvedTeams.slice();
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const batch = writeBatch(db);
    shuffled.forEach((team, idx) => {
      batch.update(doc(db, 'teams', team.id), {
        group: GROUPS[idx % GROUPS.length],
      });
    });

    Object.keys(matches).forEach((matchId) => {
      batch.delete(doc(db, 'matches', matchId));
    });

    try {
      await batch.commit();
      showToast('تمت القرعة وتوزيع المجموعات بنجاح');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'teams/draw');
    }
  };

  const handleTogglePaid = async (team: TeamDoc) => {
    const path = `teams/${team.id}`;
    try {
      await updateDoc(doc(db, 'teams', team.id), {
        paid: !team.paid,
      });
      showToast(!team.paid ? 'تم تأكيد دفع الفريق' : 'تم إلغاء تأكيد الدفع');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleToggleQualified = async (team: TeamDoc) => {
    const path = `teams/${team.id}`;
    const nextVal = !Boolean(team.qualified);
    try {
      await updateDoc(doc(db, 'teams', team.id), {
        qualified: nextVal,
      });
      showToast(nextVal ? `تم تأهيل «${team.name}»` : `تم إلغاء تأهيل «${team.name}»`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleChangeTeamGroup = async (team: TeamDoc, group: GroupId) => {
    const path = `teams/${team.id}`;
    try {
      await updateDoc(doc(db, 'teams', team.id), {
        group,
      });
      showToast(`تم نقل «${team.name}» إلى المجموعة ${group}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'teams', teamId));
    batch.delete(doc(db, 'team_contacts', teamId));

    Object.values(matches).forEach((m) => {
      if (m.homeTeamId === teamId || m.awayTeamId === teamId) {
        batch.delete(doc(db, 'matches', m.id));
      }
    });

    try {
      await batch.commit();
      showToast('تم حذف الفريق');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `teams/${teamId}`);
    }
  };

  return (
    <div className="min-h-screen bg-ink text-tx flex flex-col">
      {toastMsg && (
        <div
          role="status"
          className="fixed bottom-4 left-4 right-4 sm:right-auto z-50 bg-card border border-gold rounded-xl px-4 py-3 text-sm font-bold text-tx shadow-lg"
        >
          {toastMsg}
        </div>
      )}

      <Header isDark={isDark} onToggleTheme={() => setIsDark((prev) => !prev)} />

      {authError && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/65 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="max-w-md w-full bg-card border border-bad rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-base font-black text-bad">{authError.message}</h3>
                <p className="text-xs text-mu font-bold" dir="ltr">
                  Error: {authError.code}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAuthError(null)}
                className="text-xs text-mu hover:text-tx font-bold cursor-pointer"
              >
                إغلاق
              </button>
            </div>
            <p className="text-xs text-mu leading-relaxed">
              إذا كانت نافذة تسجيل الدخول محظورة داخل نافذة المعاينة أو المتصفح، افتح الموقع في تبويب مستقل ثم اضغط «دخول المدير» في أسفل الصفحة.
            </p>
            <div className="flex flex-wrap items-center gap-2.5">
              {authError.inIframe && (
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-gold text-on font-black rounded-xl px-4 py-2 text-xs hover:opacity-90 transition-opacity"
                >
                  فتح الموقع في تبويب مستقل
                </a>
              )}
              <button
                type="button"
                onClick={() => void handleSignIn()}
                className="border border-line bg-surf text-tx font-bold rounded-xl px-4 py-2 text-xs hover:border-gold transition-colors cursor-pointer"
              >
                إعادة المحاولة
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1">
        <HeroSection teamCount={approvedTeams.length} />

        {isAdmin && (
          <AdminDashboard
            teams={approvedTeams}
            pendingTeams={pendingTeams}
            contacts={contacts}
            onAdminRegisterTeam={handleRegisterTeam}
            onApproveTeam={handleApproveTeam}
            onTogglePaid={handleTogglePaid}
            onToggleQualified={handleToggleQualified}
            onChangeTeamGroup={handleChangeTeamGroup}
            onDeleteTeam={handleDeleteTeam}
            onRunDraw={handleRunDraw}
            onSignOut={handleSignOut}
            onToast={showToast}
          />
        )}

        <GroupsAndMatches
          teams={approvedTeams}
          matches={matches}
          activeGroup={activeGroup}
          onSelectGroup={setActiveGroup}
          isAdmin={isAdmin}
          onSaveMatch={handleSaveMatch}
          onRunDraw={handleRunDraw}
        />

        <KnockoutSection
          teams={approvedTeams}
          knockoutMatches={knockoutMatches}
          isAdmin={isAdmin}
          onSaveKnockoutMatch={handleSaveKnockoutMatch}
        />

        <ScorersSection
          scorers={scorers}
          teams={approvedTeams}
          isAdmin={isAdmin}
          onSaveScorer={handleSaveScorer}
          onDeleteScorer={handleDeleteScorer}
        />

        <RegistrationForm
          teams={approvedTeams}
          user={user}
          onSignIn={handleSignIn}
          onRegisterTeam={handleRegisterTeam}
          onToast={showToast}
          onGroupRegistered={setActiveGroup}
        />

        <TeamsDirectory
          teams={approvedTeams}
          contacts={contacts}
          isAdmin={isAdmin}
          currentUid={user?.uid ?? null}
          onTogglePaid={handleTogglePaid}
          onDeleteTeam={handleDeleteTeam}
          onJumpToGroup={setActiveGroup}
        />
      </main>

      <footer className="border-t border-line py-8 px-4 text-center text-sm text-mu font-bold">
        <div className="flex flex-wrap items-center justify-center gap-3">
          <span>Risk Up · منصة بطولات كرة القدم · موسم 2026</span>
          {authReady && (
            <>
              <span aria-hidden="true">·</span>
              {user ? (
                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="underline hover:text-bad cursor-pointer"
                >
                  {isAdmin ? 'خروج المدير' : 'تسجيل خروج'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleSignIn()}
                  className="underline hover:text-tx cursor-pointer"
                >
                  دخول المدير
                </button>
              )}
            </>
          )}
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <TournamentApp />
    </ErrorBoundary>
  );
}
