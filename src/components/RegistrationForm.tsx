import { Check, Copy, MessageCircle, Plus, X } from 'lucide-react';
import { User } from 'firebase/auth';
import { useState } from 'react';
import {
  EGYPT_PHONE_PATTERN,
  GROUPS,
  GroupId,
  INSTAPAY_NUMBER,
  INSTAPAY_REF_MAX_LENGTH,
  MAX_PLAYERS,
  MAX_TEAMS,
  MIN_PLAYERS,
  ORGANIZER_WHATSAPP,
  PLAYER_NAME_MAX_LENGTH,
  TEAM_NAME_MAX_LENGTH,
  TeamDoc,
} from '../types/tournament';
import {
  buildWhatsAppRegistrationUrl,
  pickAvailableGroup,
} from '../utils/tournament';

interface RegistrationFormProps {
  teams: TeamDoc[];
  user: User | null;
  onSignIn: () => Promise<User | null>;
  onRegisterTeam: (payload: {
    name: string;
    phone: string;
    group: GroupId;
    players: string[];
    ref: string;
  }) => Promise<void>;
  onToast: (message: string) => void;
  onGroupRegistered: (group: GroupId) => void;
}

export function RegistrationForm({
  teams,
  user,
  onSignIn,
  onRegisterTeam,
  onToast,
  onGroupRegistered,
}: RegistrationFormProps) {
  const [teamName, setTeamName] = useState('');
  const [phone, setPhone] = useState('');
  const [preferredGroup, setPreferredGroup] = useState<'AUTO' | GroupId>('AUTO');
  const [players, setPlayers] = useState<string[]>(Array(MIN_PLAYERS).fill(''));
  const [instaPayRef, setInstaPayRef] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [whatsappSuccessUrl, setWhatsappSuccessUrl] = useState('');
  const [whatsappFallbackUrl, setWhatsappFallbackUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  const handlePlayerChange = (index: number, value: string) => {
    setPlayers((prev) => prev.map((p, idx) => (idx === index ? value : p)));
  };

  const handleAddPlayer = () => {
    if (players.length >= MAX_PLAYERS) {
      onToast(`الحد الأقصى ${MAX_PLAYERS} لاعبين`);
      return;
    }
    setPlayers((prev) => [...prev, '']);
  };

  const handleRemovePlayer = (index: number) => {
    if (players.length <= MIN_PLAYERS) return;
    setPlayers((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleCopyInstaPay = async () => {
    try {
      await navigator.clipboard.writeText(INSTAPAY_NUMBER);
      setCopied(true);
      onToast('تم نسخ رقم InstaPay');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      onToast('اضغط مطولاً على الرقم لنسخه');
    }
  };

  const validatePayload = () => {
    const cleanName = teamName.trim().replace(/\s+/g, ' ');
    const cleanPhone = phone.replace(/\s/g, '');
    const cleanRef = instaPayRef.trim().slice(0, INSTAPAY_REF_MAX_LENGTH);
    const cleanPlayers = players
      .map((p) => p.trim().slice(0, PLAYER_NAME_MAX_LENGTH))
      .filter(Boolean);

    if (!cleanName || cleanName.length > TEAM_NAME_MAX_LENGTH) {
      return { error: `اكتب اسم الفرقة (بحد أقصى ${TEAM_NAME_MAX_LENGTH} حرف).` };
    }
    if (!EGYPT_PHONE_PATTERN.test(cleanPhone)) {
      return {
        error: 'رقم التليفون لازم يكون رقم مصري صحيح من 11 رقم (مثال: 01012345678).',
      };
    }
    if (cleanPlayers.length < MIN_PLAYERS) {
      return { error: `لازم تكتب ${MIN_PLAYERS} لاعبين أساسيين على الأقل.` };
    }
    if (new Set(cleanPlayers.map((p) => p.toLowerCase())).size !== cleanPlayers.length) {
      return { error: 'في اسم لاعب مكرر، تأكد من أسماء اللاعبين.' };
    }
    if (teams.length >= MAX_TEAMS) {
      return { error: `اكتمل عدد الفرق (${MAX_TEAMS} فريق).` };
    }
    if (teams.some((t) => t.name.toLowerCase() === cleanName.toLowerCase())) {
      return { error: 'اسم الفرقة ده مسجل بالفعل.' };
    }

    const assignedGroup = pickAvailableGroup(teams, preferredGroup);
    if (!assignedGroup) {
      return { error: 'كل المجموعات مكتملة حالياً.' };
    }

    return {
      data: {
        name: cleanName,
        phone: cleanPhone,
        group: assignedGroup,
        players: cleanPlayers,
        ref: cleanRef,
      },
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setWhatsappSuccessUrl('');
    setWhatsappFallbackUrl('');

    const validation = validatePayload();
    if ('error' in validation && validation.error) {
      setErrorMsg(validation.error);
      return;
    }
    if (!validation.data) return;

    const payload = validation.data;
    const waUrl = buildWhatsAppRegistrationUrl({
      name: payload.name,
      phone: payload.phone,
      preferredGroup: payload.group,
      players: payload.players,
      ref: payload.ref,
    });
    setSubmitting(true);

    try {
      let activeUser = user;
      if (!activeUser) {
        activeUser = await onSignIn();
      }
      if (!activeUser) {
        throw new Error('AUTH_REQUIRED');
      }

      await onRegisterTeam(payload);

      setSuccessMsg(
        `تم إرسال طلب تسجيل «${payload.name}» بنجاح، وهو الآن في انتظار موافقة المدير للظهور في جدول البطولة (المجموعة ${payload.group}).`
      );
      setWhatsappSuccessUrl(waUrl);
      setTeamName('');
      setPhone('');
      setPreferredGroup('AUTO');
      setPlayers(Array(MIN_PLAYERS).fill(''));
      setInstaPayRef('');
      onGroupRegistered(payload.group);
    } catch {
      setWhatsappFallbackUrl(waUrl);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="register" className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <h2 className="text-3xl font-black text-center mb-6 text-tx">
        سجّل فرقتك في{' '}
        <span className="text-gold" dir="ltr">
          RISK UP
        </span>
      </h2>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="bg-card border border-line rounded-2xl p-5 sm:p-8 space-y-6"
      >

        {errorMsg && (
          <div
            role="alert"
            className="border border-bad bg-bad/10 p-3.5 rounded-xl text-sm text-bad font-bold"
          >
            {errorMsg}
          </div>
        )}

        <div className="grid sm:grid-cols-3 gap-4">
          <label className="text-sm font-bold text-tx block">
            اسم الفرقة *
            <input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              maxLength={TEAM_NAME_MAX_LENGTH}
              placeholder="مثال: صقور المعادي"
              className="mt-1.5 w-full bg-surf border border-line text-tx rounded-xl px-3.5 py-2.5 text-sm focus:outline-2 focus:outline-gold"
            />
          </label>

          <label className="text-sm font-bold text-tx block">
            تليفون الكابتن *
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              type="tel"
              dir="ltr"
              maxLength={11}
              inputMode="numeric"
              placeholder="01012345678"
              className="mt-1.5 w-full bg-surf border border-line text-tx rounded-xl px-3.5 py-2.5 text-sm text-right tabular-nums focus:outline-2 focus:outline-gold"
            />
          </label>

          <label className="text-sm font-bold text-tx block">
            المجموعة
            <select
              value={preferredGroup}
              onChange={(e) => setPreferredGroup(e.target.value as 'AUTO' | GroupId)}
              className="mt-1.5 w-full bg-surf border border-line text-tx rounded-xl px-3.5 py-2.5 text-sm focus:outline-2 focus:outline-gold"
            >
              <option value="AUTO">توزيع تلقائي</option>
              {GROUPS.map((g) => (
                <option key={g} value={g}>
                  المجموعة {g}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <h3 className="font-black text-tx">
              اللاعبون *{' '}
              <span className="text-xs text-mu font-normal">
                (5 أساسيين، حتى 8 لاعبين)
              </span>
            </h3>
            <button
              type="button"
              onClick={handleAddPlayer}
              className="inline-flex items-center gap-1.5 border border-line bg-surf text-tx font-bold rounded-xl px-3 py-1.5 text-xs hover:border-gold transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>لاعب احتياطي</span>
            </button>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            {players.map((player, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  value={player}
                  onChange={(e) => handlePlayerChange(idx, e.target.value)}
                  maxLength={PLAYER_NAME_MAX_LENGTH}
                  placeholder={
                    idx < MIN_PLAYERS
                      ? `لاعب أساسي ${idx + 1}`
                      : `احتياطي ${idx - MIN_PLAYERS + 1}`
                  }
                  className="w-full bg-surf border border-line text-tx rounded-xl px-3.5 py-2.5 text-sm focus:outline-2 focus:outline-gold"
                />
                {idx >= MIN_PLAYERS && (
                  <button
                    type="button"
                    onClick={() => handleRemovePlayer(idx)}
                    aria-label="حذف اللاعب"
                    className="border border-line bg-surf text-mu hover:text-bad hover:border-bad rounded-xl p-2.5 shrink-0 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-surf border border-line/70 rounded-xl p-4 space-y-3">
          <p className="text-sm text-tx font-semibold">
            حوّل رسوم الاشتراك على InstaPay ثم اكتب رقم العملية (اختياري، يسهّل التأكيد):
          </p>
          <div className="flex items-center gap-3" dir="ltr">
            <b className="text-gold text-lg tracking-wide select-all tabular-nums">
              {INSTAPAY_NUMBER}
            </b>
            <button
              type="button"
              onClick={handleCopyInstaPay}
              className="inline-flex items-center gap-1.5 border border-line bg-card text-tx font-bold rounded-lg px-3 py-1.5 text-xs hover:border-gold transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-gold" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'تم النسخ' : 'نسخ'}</span>
            </button>
          </div>
          <input
            value={instaPayRef}
            onChange={(e) => setInstaPayRef(e.target.value)}
            maxLength={INSTAPAY_REF_MAX_LENGTH}
            placeholder="رقم عملية InstaPay (اختياري)"
            dir="ltr"
            className="w-full bg-card border border-line text-tx rounded-xl px-3.5 py-2.5 text-sm text-right focus:outline-2 focus:outline-gold"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-gold text-on font-black rounded-xl py-3.5 text-base hover:opacity-90 disabled:opacity-50 transition-opacity cursor-pointer"
        >
          {submitting ? 'جارٍ تأكيد الحجز...' : 'تأكيد الحجز'}
        </button>

        {successMsg && (
          <div className="bg-surf border border-gold rounded-xl p-4 text-sm font-bold text-tx space-y-3">
            <p>{successMsg}</p>
            <a
              href={whatsappSuccessUrl || `https://wa.me/${ORGANIZER_WHATSAPP}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-gold text-on font-black rounded-xl px-4 py-2 text-xs hover:opacity-90 transition-opacity"
            >
              <MessageCircle className="w-4 h-4" />
              <span>إرسال بيانات التسجيل على واتساب (01224656839)</span>
            </a>
          </div>
        )}

        {whatsappFallbackUrl && (
          <div className="bg-surf border border-line rounded-xl p-4 space-y-3">
            <p className="text-sm font-bold text-tx">
              لم يكتمل الحفظ التلقائي — يمكنك إرسال بيانات فرقتك للمنظم مباشرة على واتساب (01224656839):
            </p>
            <a
              href={whatsappFallbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-gold text-on font-black rounded-xl px-5 py-2.5 text-sm hover:opacity-90 transition-opacity"
            >
              <MessageCircle className="w-4 h-4" />
              <span>ابعت الطلب للمنظم على واتساب</span>
            </a>
          </div>
        )}
      </form>
    </section>
  );
}
