import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { AdminBar } from './components/AdminBar';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GroupsAndMatches } from './components/GroupsAndMatches';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { RegistrationForm } from './components/RegistrationForm';
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
  ID_PATTERN,
  MatchDoc,
  TeamContactDoc,
  TeamDoc,
} from './types/tournament';
import { extractTimestampMs } from './utils/tournament';

function TournamentApp() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdminDoc, setIsAdminDoc] = useState(false);

  const [teams, setTeams] = useState<TeamDoc[]>([]);
  const [matches, setMatches] = useState<Record<string, MatchDoc>>({});
  const [contacts, setContacts] = useState<Record<string, TeamContactDoc>>({});
  const [activeGroup, setActiveGroup] = useState<GroupId>('A');
  const [toastMsg, setToastMsg] = useState('');
  const [isDark, setIsDark] = useState(true);

  const isBootstrappedAdmin =
    Boolean(user?.emailVerified) && user?.email === BOOTSTRAPPED_ADMIN_EMAIL;
  const isAdmin = isBootstrappedAdmin || isAdminDoc;

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

  // Listen to Firebase Auth state and resolve Admin role
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (nextUser && nextUser.emailVerified) {
        if (nextUser.email === BOOTSTRAPPED_ADMIN_EMAIL) {
          setIsAdminDoc(true);
        } else {
          try {
            const adminSnap = await getDoc(doc(db, 'admins', nextUser.uid));
            setIsAdminDoc(adminSnap.exists());
          } catch {
            setIsAdminDoc(false);
          }
        }
      } else {
        setIsAdminDoc(false);
      }
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Public real-time listeners for teams & matches
  useEffect(() => {
    const teamsPath = 'teams';
    const unsubTeams = onSnapshot(
      collection(db, teamsPath),
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
      (error) => handleFirestoreError(error, OperationType.LIST, teamsPath)
    );

    const matchesPath = 'matches';
    const unsubMatches = onSnapshot(
      collection(db, matchesPath),
      (snap) => {
        const map: Record<string, MatchDoc> = {};
        for (const d of snap.docs) {
          map[d.id] = { ...(d.data() as Omit<MatchDoc, 'id'>), id: d.id };
        }
        setMatches(map);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, matchesPath)
    );

    return () => {
      unsubTeams();
      unsubMatches();
    };
  }, []);

  // Isolated PII listener for team_contacts (scoped by ownerUid or bootstrapped admin)
  useEffect(() => {
    if (!authReady || !user || !user.emailVerified) {
      setContacts({});
      return;
    }

    const contactsPath = 'team_contacts';
    const contactsQuery = isBootstrappedAdmin
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
  }, [authReady, user, isBootstrappedAdmin]);

  const handleSignIn = async (): Promise<User | null> => {
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      showToast('تم تسجيل الدخول بحساب جوجل');
      return cred.user;
    } catch {
      showToast('تعذر إتمام تسجيل الدخول بحساب جوجل');
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
  }) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      throw new Error('AUTH_REQUIRED');
    }

    const teamId = `t_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const batch = writeBatch(db);
    const now = serverTimestamp();

    batch.set(doc(db, 'teams', teamId), {
      id: teamId,
      name: payload.name,
      group: payload.group,
      players: payload.players,
      paid: false,
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
      showToast(`تم تسجيل «${payload.name}» في المجموعة ${payload.group}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `teams/${teamId}`);
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

  const handleRunDraw = async () => {
    if (teams.length === 0) return;
    const shuffled = teams.slice();
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

  const handleAddCoAdmin = async (uid: string, email: string) => {
    if (!ID_PATTERN.test(uid)) {
      showToast('معرّف المستخدم غير صالح');
      return;
    }
    try {
      await setDoc(doc(db, 'admins', uid), {
        uid,
        email,
        createdAt: serverTimestamp(),
      });
      showToast('تمت إضافة المنظم المساعد بنجاح');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `admins/${uid}`);
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

      <Header />

      <main className="flex-1">
        <HeroSection teamCount={teams.length} />

        <AdminBar
          user={user}
          authReady={authReady}
          isAdmin={isAdmin}
          isBootstrappedAdmin={isBootstrappedAdmin}
          isDark={isDark}
          onToggleTheme={() => setIsDark((prev) => !prev)}
          onSignIn={async () => {
            await handleSignIn();
          }}
          onSignOut={handleSignOut}
          onAddCoAdmin={handleAddCoAdmin}
        />

        <GroupsAndMatches
          teams={teams}
          matches={matches}
          activeGroup={activeGroup}
          onSelectGroup={setActiveGroup}
          isAdmin={isAdmin}
          onSaveMatch={handleSaveMatch}
          onRunDraw={handleRunDraw}
        />

        <RegistrationForm
          teams={teams}
          user={user}
          onSignIn={handleSignIn}
          onRegisterTeam={handleRegisterTeam}
          onToast={showToast}
          onGroupRegistered={setActiveGroup}
        />

        <TeamsDirectory
          teams={teams}
          contacts={contacts}
          isAdmin={isAdmin}
          currentUid={user?.uid ?? null}
          onTogglePaid={handleTogglePaid}
          onDeleteTeam={handleDeleteTeam}
          onJumpToGroup={setActiveGroup}
        />
      </main>

      <footer className="border-t border-line py-8 px-4 text-center text-sm text-mu font-bold">
        Risk Up · منصة بطولات كرة القدم · موسم 2026
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
