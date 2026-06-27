import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Calendar from './components/Calendar';
import { extractDatesFromText, type ExtractedDate } from './logic/textParser';
import { calculateScheduleResult } from './logic/scheduler';
import { supabase, supabaseReady } from './lib/supabaseClient';
import { datesBetween, displayDate, isWeekend, weekday, weekdayIndex } from './utils/dateUtils';
import './styles.css';

type Status = 'ok' | 'night' | 'day' | 'maybe' | 'ng';
type Role = 'host' | 'staff' | 'participant';
type ConsecutivePreference = 'none' | 'avoid_2_days' | 'avoid_3_days' | 'avoid_any';
type SameDayRule = 'allow' | 'penalty' | 'ban';
type MaybeRule = 'exclude' | 'penalty';
type HostRule = 'host_required' | 'host_or_staff';
type MinMode = 'all' | 'number';
type Pref = 'weekday' | 'holiday' | 'day' | 'night' | 'avoid_holiday_day';
type View = 'top' | 'create' | 'join' | 'admin' | 'legal';

type Participant = {
  id: string;
  dbId?: string;
  name: string;
  role: Role;
  preferences: Pref[];
  consecutivePreference: ConsecutivePreference;
  comment: string;
};

type AvailabilityMap = Record<string, Record<string, Status>>;

type SessionSettings = {
  dbId?: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  requiredSlots: number;
  minParticipantsMode: MinMode;
  minParticipantsCount: number;
  hostRule: HostRule;
  maybeRule: MaybeRule;
  sameDayRule: SameDayRule;
  shareId: string;
  ownerToken: string;
};

type LocalBundle = {
  session: SessionSettings;
  participants: Participant[];
  availability: AvailabilityMap;
};

const statusOptions: { value: Status; label: string; title: string }[] = [
  { value: 'ok', label: '⭕️', title: 'いつでも可' },
  { value: 'night', label: '🌙', title: '夜なら可' },
  { value: 'day', label: '🌞', title: '昼なら可' },
  { value: 'maybe', label: '保留', title: '未定・保留' },
  { value: 'ng', label: '❌', title: '無理' },
];

const preferenceOptions: { value: Pref; label: string }[] = [
  { value: 'weekday', label: '平日を優先したい' },
  { value: 'holiday', label: '土日祝を優先したい' },
  { value: 'day', label: '昼開催を優先したい' },
  { value: 'night', label: '夜開催を優先したい' },
  { value: 'avoid_holiday_day', label: '土日祝の昼は避けたい' },
];

const prefLabel: Record<Pref, string> = Object.fromEntries(
  preferenceOptions.map((p) => [p.value, p.label])
) as Record<Pref, string>;

const roleLabel: Record<Role, string> = {
  host: '主催',
  staff: 'スタッフ',
  participant: '参加者',
};

const consecutiveLabel: Record<ConsecutivePreference, string> = {
  none: '気にしない',
  avoid_2_days: '2日連続は避けたい',
  avoid_3_days: '3日連続は避けたい',
  avoid_any: 'なるべく避けたい',
};

function cryptoRandom(length: number) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join('');
}

function normalizePath() {
  const parts = location.pathname.split('/').filter(Boolean);
  if (parts[0] === 's' && parts[1]) return { view: 'join' as View, shareId: parts[1], ownerToken: '' };
  if (parts[0] === 'admin' && parts[1]) return { view: 'admin' as View, shareId: '', ownerToken: parts[1] };
  return { view: 'top' as View, shareId: '', ownerToken: '' };
}

function localKey(shareId: string) {
  return `pita-puzzle:${shareId}`;
}

const initialSession: SessionSettings = {
  title: '7月セッション日程調整',
  description: '候補期間に参加できる日程を入力してください。',
  startDate: '2026-07-01',
  endDate: '2026-07-31',
  requiredSlots: 4,
  minParticipantsMode: 'all',
  minParticipantsCount: 3,
  hostRule: 'host_or_staff',
  maybeRule: 'penalty',
  sameDayRule: 'penalty',
  shareId: cryptoRandom(8),
  ownerToken: cryptoRandom(18),
};

function sessionToRow(session: SessionSettings) {
  return {
    share_id: session.shareId,
    owner_token: session.ownerToken,
    title: session.title,
    description: session.description,
    start_date: session.startDate,
    end_date: session.endDate,
    required_slots: session.requiredSlots,
    min_participants_mode: session.minParticipantsMode,
    min_participants_count: session.minParticipantsCount,
    host_rule: session.hostRule,
    maybe_rule: session.maybeRule,
    same_day_rule: session.sameDayRule,
  };
}

function rowToSession(row: any): SessionSettings {
  return {
    dbId: row.id,
    title: row.title || initialSession.title,
    description: row.description || '',
    startDate: row.start_date,
    endDate: row.end_date,
    requiredSlots: row.required_slots ?? 1,
    minParticipantsMode: row.min_participants_mode || 'all',
    minParticipantsCount: row.min_participants_count ?? 1,
    hostRule: row.host_rule || 'host_or_staff',
    maybeRule: row.maybe_rule || 'penalty',
    sameDayRule: row.same_day_rule || 'penalty',
    shareId: row.share_id,
    ownerToken: row.owner_token,
  };
}

function rowToParticipant(row: any): Participant {
  return {
    id: row.id,
    dbId: row.id,
    name: row.name || '',
    role: row.role || 'participant',
    preferences: Array.isArray(row.preferences) ? row.preferences : [],
    consecutivePreference: row.consecutive_preference || 'none',
    comment: row.comment || '',
  };
}

function App() {
  const routed = normalizePath();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [fontSize, setFontSize] = useState<'normal' | 'large'>('normal');
  const [view, setView] = useState<View>(routed.view);
  const [session, setSession] = useState<SessionSettings>({
    ...initialSession,
    shareId: routed.shareId || initialSession.shareId,
    ownerToken: routed.ownerToken || initialSession.ownerToken,
  });
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [availability, setAvailability] = useState<AvailabilityMap>({});
  const [draft, setDraft] = useState<Omit<Participant, 'id'>>({
    name: '',
    role: 'participant',
    preferences: [],
    consecutivePreference: 'none',
    comment: '',
  });
  const [activeName, setActiveName] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [extractedDates, setExtractedDates] = useState<ExtractedDate[]>([]);

  const dates = useMemo(
    () => datesBetween(session.startDate, session.endDate),
    [session.startDate, session.endDate]
  );
  const activeParticipant = participants.find((p) => p.name === activeName);
  const participantCount = participants.filter((p) => p.role === 'participant').length;
  const shareUrl = `${location.origin}/s/${session.shareId}`;
  const adminUrl = `${location.origin}/admin/${session.ownerToken}`;

  const scheduleResult = useMemo(
    () => calculateScheduleResult(dates, participants, availability, session),
    [dates, participants, availability, session]
  );

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice((current) => (current === message ? '' : current)), 2600);
  }

  function saveLocal(bundle?: Partial<LocalBundle>) {
    const next: LocalBundle = {
      session: bundle?.session || session,
      participants: bundle?.participants || participants,
      availability: bundle?.availability || availability,
    };
    localStorage.setItem(localKey(next.session.shareId), JSON.stringify(next));
  }

  async function loadSessionByRoute() {
    const route = normalizePath();
    if (!route.shareId && !route.ownerToken) return;
    setLoading(true);

    try {
      if (supabaseReady && supabase) {
        const column = route.shareId ? 'share_id' : 'owner_token';
        const value = route.shareId || route.ownerToken;
        const { data: sessionRow, error: sessionError } = await supabase
          .from('sessions')
          .select('*')
          .eq(column, value)
          .single();

        if (sessionError || !sessionRow) {
          showNotice('ページを読み込めませんでした。URLを確認してください。');
          return;
        }

        const loadedSession = rowToSession(sessionRow);
        const { data: participantRows, error: participantError } = await supabase
          .from('participants')
          .select('*')
          .eq('session_id', loadedSession.dbId)
          .order('created_at', { ascending: true });

        if (participantError) {
          showNotice(`参加者読み込みエラー: ${participantError.message}`);
          return;
        }

        const loadedParticipants = (participantRows || []).map(rowToParticipant);
        const ids = loadedParticipants.map((p) => p.dbId).filter(Boolean);
        let loadedAvailability: AvailabilityMap = {};

        if (ids.length) {
          const { data: availabilityRows, error: availabilityError } = await supabase
            .from('availability')
            .select('*')
            .in('participant_id', ids);

          if (availabilityError) {
            showNotice(`出欠読み込みエラー: ${availabilityError.message}`);
            return;
          }

          for (const row of availabilityRows || []) {
            const participantId = row.participant_id;
            if (!loadedAvailability[participantId]) loadedAvailability[participantId] = {};
            loadedAvailability[participantId][row.date] = row.status;
          }
        }

        setSession(loadedSession);
        setParticipants(loadedParticipants);
        setAvailability(loadedAvailability);
        setView(route.shareId ? 'join' : 'admin');
        showNotice(route.shareId ? '参加ページを読み込みました。' : '主催ページを読み込みました。');
        return;
      }

      const raw = route.shareId ? localStorage.getItem(localKey(route.shareId)) : null;
      if (raw) {
        const bundle = JSON.parse(raw) as LocalBundle;
        setSession(bundle.session);
        setParticipants(bundle.participants || []);
        setAvailability(bundle.availability || {});
        setView(route.shareId ? 'join' : 'admin');
        showNotice('ローカル保存データを読み込みました。');
      } else {
        showNotice('Supabase未設定のため、URL読み込みはこのブラウザのローカル保存のみ対応です。');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSessionByRoute();
  }, []);

  async function createPage() {
    const next: SessionSettings = {
      ...session,
      shareId: cryptoRandom(8),
      ownerToken: cryptoRandom(18),
    };
    setLoading(true);

    try {
      if (supabaseReady && supabase) {
        const { data, error } = await supabase
          .from('sessions')
          .insert(sessionToRow(next))
          .select()
          .single();

        if (error) {
          showNotice(`Supabase保存エラー: ${error.message}`);
          return;
        }

        const saved = { ...next, dbId: data.id };
        setSession(saved);
        saveLocal({ session: saved });
        history.pushState(null, '', `/s/${saved.shareId}`);
        setView('join');
        showNotice('保存しました。参加URLを共有できます。');
        return;
      }

      setSession(next);
      saveLocal({ session: next });
      history.pushState(null, '', `/s/${next.shareId}`);
      setView('join');
      showNotice('保存しました。Supabase未設定なのでローカル保存です。');
    } finally {
      setLoading(false);
    }
  }

  async function saveSessionSettings(nextSession = session) {
    setSession(nextSession);

    if (supabaseReady && supabase && nextSession.dbId) {
      const { error } = await supabase
        .from('sessions')
        .update(sessionToRow(nextSession))
        .eq('id', nextSession.dbId);

      if (error) {
        showNotice(`主催設定の保存エラー: ${error.message}`);
        return;
      }

      showNotice('主催設定を保存しました。');
    } else {
      saveLocal({ session: nextSession });
      showNotice('主催設定を保存しました。');
    }
  }

  async function joinOrEdit() {
    const name = draft.name.trim();
    if (!name) return showNotice('名前を入力してください。');
    if (!session.dbId && supabaseReady) return showNotice('先にページを生成してください。');

    const existing = participants.find((p) => p.name === name);
    let nextParticipant: Participant = existing
      ? { ...existing, ...draft, name }
      : { id: cryptoRandom(10), ...draft, name };

    if (supabaseReady && supabase && session.dbId) {
      const { data, error } = await supabase
        .from('participants')
        .upsert(
          {
            session_id: session.dbId,
            name,
            role: nextParticipant.role,
            preferences: nextParticipant.preferences,
            consecutive_preference: nextParticipant.consecutivePreference,
            comment: nextParticipant.comment,
          },
          { onConflict: 'session_id,name' }
        )
        .select()
        .single();

      if (error) {
        showNotice(`参加者保存エラー: ${error.message}`);
        return;
      }

      const dbParticipant = rowToParticipant(data);
      const oldId = existing?.id;
      nextParticipant = dbParticipant;

      if (oldId && oldId !== dbParticipant.id && availability[oldId]) {
        setAvailability((prev) => {
          const next = { ...prev, [dbParticipant.id]: prev[oldId] };
          delete next[oldId];
          return next;
        });
      }
    }

    setParticipants((prev) => {
      const next = existing
        ? prev.map((p) => (p.name === name ? nextParticipant : p))
        : [...prev, nextParticipant];
      saveLocal({ participants: next });
      return next;
    });
    setActiveName(name);
    showNotice(existing ? '同じ名前の入力を上書きしました。' : '参加者を登録しました。');
  }

  async function persistAvailability(participant: Participant, nextAvailability: Record<string, Status>) {
    if (supabaseReady && supabase && participant.dbId) {
      const rows = Object.entries(nextAvailability).map(([date, status]) => ({
        participant_id: participant.dbId,
        date,
        status,
      }));

      if (rows.length) {
        const { error } = await supabase
          .from('availability')
          .upsert(rows, { onConflict: 'participant_id,date' });

        if (error) {
          showNotice(`出欠保存エラー: ${error.message}`);
          return false;
        }
      }
    }

    return true;
  }

  async function setStatus(date: string, status: Status) {
    if (!activeParticipant) return;
    const nextForPerson = { ...(availability[activeParticipant.id] || {}), [date]: status };
    const nextAll = { ...availability, [activeParticipant.id]: nextForPerson };
    setAvailability(nextAll);
    saveLocal({ availability: nextAll });

    if (supabaseReady && supabase && activeParticipant.dbId) {
      await supabase
        .from('availability')
        .upsert(
          { participant_id: activeParticipant.dbId, date, status },
          { onConflict: 'participant_id,date' }
        );
    }
  }

  async function saveActiveSchedule() {
    if (!activeParticipant) return showNotice('先に参加者を選択してください。');
    const ok = await persistAvailability(activeParticipant, availability[activeParticipant.id] || {});
    if (ok) {
      saveLocal();
      showNotice('日程を保存しました。');
    }
  }

  async function bulk(mode: string) {
    if (!activeParticipant) return;
    const next: Record<string, Status> = { ...(availability[activeParticipant.id] || {}) };
    for (const date of dates) {
      if (mode === 'all-maybe') next[date] = 'maybe';
      if (mode === 'all-ng') next[date] = 'ng';
      if (mode === 'weekend-ok-weekday-night') next[date] = isWeekend(date) ? 'ok' : 'night';
      if (mode.startsWith('weekday-') && weekdayIndex(date) === Number(mode.split('-')[1])) next[date] = 'ng';
    }
    const nextAll = { ...availability, [activeParticipant.id]: next };
    setAvailability(nextAll);
    saveLocal({ availability: nextAll });
    await persistAvailability(activeParticipant, next);
    showNotice('一括入力を保存しました。');
  }

  function runTextExtract() {
    const extracted = extractDatesFromText(pasteText, session.startDate, session.endDate);
    setExtractedDates(extracted);
    showNotice(extracted.length ? `${extracted.length}件の日付を抽出しました。` : '対象期間内の日付を抽出できませんでした。');
  }

  async function applyExtractedNg() {
    if (!activeParticipant) return showNotice('先に参加者を選択してください。');
    const selected = extractedDates.filter((d) => d.checked).map((d) => d.date);
    if (!selected.length) return showNotice('反映する日付が選択されていません。');
    const next: Record<string, Status> = { ...(availability[activeParticipant.id] || {}) };
    for (const date of selected) next[date] = 'ng';
    const nextAll = { ...availability, [activeParticipant.id]: next };
    setAvailability(nextAll);
    saveLocal({ availability: nextAll });
    await persistAvailability(activeParticipant, next);
    showNotice(`${selected.length}件を❌にして保存しました。`);
  }

  function selectExistingParticipant(name: string) {
    setActiveName(name);
    const found = participants.find((p) => p.name === name);
    if (!found) return;
    setDraft({
      name: found.name,
      role: found.role,
      preferences: found.preferences,
      consecutivePreference: found.consecutivePreference,
      comment: found.comment,
    });
  }

  return (
    <div className={`app ${theme} font-${fontSize}`}>
      <header className="site-header">
        <button className="brand" onClick={() => { history.pushState(null, '', '/'); setView('top'); }}>日程ぴたパズル</button>
        <nav>
          <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? '🌙' : '🌞'} 表示切替</button>
          <button onClick={() => setFontSize(fontSize === 'normal' ? 'large' : 'normal')}>{fontSize === 'normal' ? '文字を大きく' : '標準サイズ'}</button>
          <button onClick={() => setView('legal')}>運営・規約</button>
        </nav>
      </header>

      {notice && <div className="toast" role="status">{notice}</div>}
      {loading && <div className="toast" role="status">読み込み中...</div>}

      {view === 'top' && (
        <main className="hero">
          <p className="eyebrow">Version 1.0.8</p>
          <h1>条件から、開催案を組み立てる。</h1>
          <p>複数人の日程を入力し、必要コマ数・参加人数・希望条件から候補案を提案します。</p>
          <div className="actions">
            <button className="primary" onClick={() => setView('create')}>新しく調整ページを作る</button>
            <button onClick={() => setView('join')}>参加URLから参加する</button>
            <button onClick={() => setView('admin')}>主催画面</button>
          </div>
          <p className="muted">{supabaseReady ? 'Supabase接続中' : 'Supabase未設定：ローカル保存で動作中'}</p>
          <AdBoxes />
        </main>
      )}

      {view === 'create' && (
        <main className="grid two">
          <section className="panel">
            <h2>ページ作成</h2>
            <label>タイトル<input value={session.title} onChange={(e) => setSession({ ...session, title: e.target.value })} /></label>
            <label>概要コメント<textarea value={session.description} onChange={(e) => setSession({ ...session, description: e.target.value })} /></label>
            <div className="date-row">
              <label>開始日<input type="date" value={session.startDate} onChange={(e) => setSession({ ...session, startDate: e.target.value })} /></label>
              <label>終了日<input type="date" value={session.endDate} onChange={(e) => setSession({ ...session, endDate: e.target.value })} /></label>
            </div>
            <button className="primary" onClick={createPage} disabled={loading}>ページを生成して保存</button>
          </section>
          <section className="panel">
            <h2>生成URL</h2>
            <p>参加URL</p>
            <code>{shareUrl}</code>
            <p>主催URL</p>
            <code>{adminUrl}</code>
          </section>
        </main>
      )}

      {view === 'join' && (
        <main className="grid two wide">
          <section className="panel">
            <h2>{session.title}</h2>
            <p>{session.description}</p>
            <div className="url-box">
              <p>参加URL</p>
              <code>{shareUrl}</code>
            </div>
            {participants.length > 0 && (
              <label>登録済みの名前から編集
                <select value={activeName} onChange={(e) => selectExistingParticipant(e.target.value)}>
                  <option value="">新規入力</option>
                  {participants.map((p) => <option key={p.id} value={p.name}>{p.name}</option>)}
                </select>
              </label>
            )}
            <h3>参加・編集</h3>
            <label>名前<input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="同じ名前なら上書き" /></label>
            <label>役割<select value={draft.role} onChange={(e) => setDraft({ ...draft, role: e.target.value as Role })}>
              <option value="host">主催</option>
              <option value="staff">スタッフ</option>
              <option value="participant">参加者</option>
            </select></label>
            <div className="check-grid">
              {preferenceOptions.map((o) => (
                <label className="check" key={o.value}>
                  <input
                    type="checkbox"
                    checked={draft.preferences.includes(o.value)}
                    onChange={(e) => setDraft({
                      ...draft,
                      preferences: e.target.checked
                        ? [...draft.preferences, o.value]
                        : draft.preferences.filter((p) => p !== o.value),
                    })}
                  />
                  {o.label}
                </label>
              ))}
            </div>
            <label>連日開催について<select value={draft.consecutivePreference} onChange={(e) => setDraft({ ...draft, consecutivePreference: e.target.value as ConsecutivePreference })}>
              <option value="none">気にしない</option>
              <option value="avoid_2_days">2日連続は避けたい</option>
              <option value="avoid_3_days">3日連続は避けたい</option>
              <option value="avoid_any">なるべく避けたい</option>
            </select></label>
            <label>補助コメント<textarea value={draft.comment} onChange={(e) => setDraft({ ...draft, comment: e.target.value })} /></label>
            <button className="primary" onClick={joinOrEdit}>参加する / 編集する</button>
          </section>

          <section className="panel span">
            <h2>予定入力</h2>
            {activeParticipant ? (
              <>
                <p><b>{activeParticipant.name}</b> さんの日程を入力中</p>
                <div className="bulk">
                  <button onClick={() => bulk('weekend-ok-weekday-night')}>土日⭕️・平日🌙</button>
                  <button onClick={() => bulk('all-maybe')}>全日保留</button>
                  <button onClick={() => bulk('all-ng')}>全日❌</button>
                  {['日', '月', '火', '水', '木', '金', '土'].map((w, i) => <button key={w} onClick={() => bulk(`weekday-${i}`)}>{w}曜❌</button>)}
                </div>
                <TextImportBox
                  text={pasteText}
                  setText={setPasteText}
                  extracted={extractedDates}
                  setExtracted={setExtractedDates}
                  onExtract={runTextExtract}
                  onApply={applyExtractedNg}
                />
                <Calendar dates={dates} value={availability[activeParticipant.id] || {}} onChange={setStatus} />
                <button className="primary" onClick={saveActiveSchedule}>日程を保存</button>
              </>
            ) : (
              <p>先に名前を入れて「参加する」を押してください。</p>
            )}
          </section>
        </main>
      )}

      {view === 'admin' && (
        <Admin
          session={session}
          setSession={setSession}
          participants={participants}
          scheduleResult={scheduleResult}
          participantCount={participantCount}
          adminUrl={adminUrl}
          shareUrl={shareUrl}
          onSave={saveSessionSettings}
        />
      )}

      {view === 'legal' && <Legal />}

      <footer>
        <button onClick={() => setView('admin')}>主催画面</button>
        <button onClick={() => setView('join')}>参加画面</button>
        <span>日程ぴたパズル Version 1.0.8</span>
      </footer>
    </div>
  );
}

function TextImportBox({
  text,
  setText,
  extracted,
  setExtracted,
  onExtract,
  onApply,
}: {
  text: string;
  setText: (v: string) => void;
  extracted: ExtractedDate[];
  setExtracted: (v: ExtractedDate[]) => void;
  onExtract: () => void;
  onApply: () => void;
}) {
  return (
    <section className="text-import">
      <h3>予定テキストから一括入力</h3>
      <p>貼り付けたテキストから日付を抽出し、選択した日を❌にします。</p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={'例：7月 1日 3日 5日\n7月 3日 ▼5日 ☆8日\n20, 21, 22 NG'} />
      <div className="actions">
        <button onClick={onExtract}>日付を抽出</button>
        <button className="primary" onClick={onApply}>選択した日を❌にする</button>
      </div>
      {extracted.length > 0 && (
        <div className="extract-results">
          {extracted.map((item) => (
            <label key={item.date} className="extract-item">
              <input type="checkbox" checked={item.checked} onChange={(e) => setExtracted(extracted.map((d) => d.date === item.date ? { ...d, checked: e.target.checked } : d))} />
              <span>{displayDate(item.date)}（{weekday(item.date)}）</span>
              <small>{item.source}</small>
            </label>
          ))}
        </div>
      )}
    </section>
  );
}

function Admin({ session, setSession, participants, scheduleResult, participantCount, adminUrl, shareUrl, onSave }: any) {
  const candidates = scheduleResult.plans || [];
  const medal = ['🥇', '🥈', '🥉'];

  function patchSession(patch: Partial<SessionSettings>) {
    setSession({ ...session, ...patch });
  }

  return (
    <main className="grid two">
      <section className="panel">
        <h2>主催設定</h2>
        <p>参加URL</p>
        <code>{shareUrl}</code>
        <p>主催URL</p>
        <code>{adminUrl}</code>
        <label>必要コマ数<input type="number" min="1" value={session.requiredSlots} onChange={(e) => patchSession({ requiredSlots: Number(e.target.value) })} /></label>
        <label>最低参加者人数<select value={session.minParticipantsMode} onChange={(e) => patchSession({ minParticipantsMode: e.target.value as MinMode })}>
          <option value="all">全員</option>
          <option value="number">指定人数</option>
        </select></label>
        {session.minParticipantsMode === 'number' && (
          <label>人数<input type="number" min="1" max={Math.max(1, participantCount)} value={session.minParticipantsCount} onChange={(e) => patchSession({ minParticipantsCount: Number(e.target.value) })} /></label>
        )}
        <label>主催条件<select value={session.hostRule} onChange={(e) => patchSession({ hostRule: e.target.value as HostRule })}>
          <option value="host_or_staff">主催不可ならスタッフ代打可</option>
          <option value="host_required">主催必須</option>
        </select></label>
        <label>保留<select value={session.maybeRule} onChange={(e) => patchSession({ maybeRule: e.target.value as MaybeRule })}>
          <option value="penalty">減点して許容</option>
          <option value="exclude">除外</option>
        </select></label>
        <label>昼夜連続開催<select value={session.sameDayRule} onChange={(e) => patchSession({ sameDayRule: e.target.value as SameDayRule })}>
          <option value="allow">許可する</option>
          <option value="penalty">できれば避ける</option>
          <option value="ban">禁止する</option>
        </select></label>
        <button className="primary" onClick={() => onSave(session)}>主催設定を保存</button>
      </section>

      <section className="panel">
        <h2>参加者一覧</h2>
        <p>参加者{participantCount}人参加可能</p>
        {participants.map((p: Participant) => (
          <article className="person" key={p.id}>
            <b>{p.name}</b><span>{roleLabel[p.role]}</span>
            <p>{p.preferences.map((pref) => prefLabel[pref]).join(' / ') || '希望条件なし'}</p>
            <p>{consecutiveLabel[p.consecutivePreference]}</p>
            <p>{p.comment || 'コメントなし'}</p>
          </article>
        ))}
      </section>

      <section className="panel span">
        <h2>開催案ランキング</h2>
        {scheduleResult.shortage > 0 && (
          <div className="warning-box">
            <b>必要コマ数に届いていません</b>
            {scheduleResult.failHints.map((hint: string) => <p key={hint}>{hint}</p>)}
          </div>
        )}
        {candidates.length ? candidates.map((plan: any, index: number) => (
          <article className="candidate" key={plan.label}>
            <h3>{medal[index] || '候補'} 第{index + 1}案{plan.complete ? '' : '（不足あり）'}</h3>
            <div className="slot-list">
              {plan.slots.map((c: any) => <p key={c.date + c.part}>{displayDate(c.date)}（{weekday(c.date)}）{c.part}</p>)}
            </div>
            <p><b>理由：</b>{plan.reasons.slice(0, 4).join(' / ') || '条件を満たす候補です'}</p>
            {plan.warnings.length > 0 && <p><b>気になる点：</b>{plan.warnings.slice(0, 4).join(' / ')}</p>}
            <textarea readOnly value={`【開催候補 第${index + 1}案】\n${plan.slots.map((c: any) => `${displayDate(c.date)}（${weekday(c.date)}）${c.part}`).join('\n')}\nよろしくお願いします。`} />
          </article>
        )) : <p>条件を満たす候補がまだありません。</p>}
      </section>
      <AdBoxes />
    </main>
  );
}

function AdBoxes() {
  return (
    <section className="ad-grid">
      <div className="adbox"><b>Amazonおすすめ枠</b><p>TRPG向けマイク、ダイス、ルールブックなどを置く場所。</p></div>
      <div className="adbox"><b>Google広告枠</b><p>AdSenseコードを公開後に差し替える場所。</p></div>
    </section>
  );
}

function Legal() {
  return (
    <main className="panel legal">
      <h2>運営・規約ページ</h2>
      <h3>プライバシーポリシー</h3>
      <p>当サイトではサービス提供、アクセス解析、広告配信のためCookie等を利用する場合があります。</p>
      <p>当サイトはGoogle AdSenseおよびAmazonアソシエイトの利用を予定しています。当サイト経由で商品購入等が行われた場合、運営者が紹介料を受け取る場合があります。</p>
      <h3>利用規約</h3>
      <p>本サービスは日程調整を補助するもので、データ保存や候補計算の完全性を保証しません。保存期間は原則3か月です。</p>
      <h3>お問い合わせ</h3>
      <p>公開前に連絡先メール、X、BOOTHなどへ差し替えてください。</p>
      <h3>運営者情報</h3>
      <p>公開前に運営者名またはハンドルネームを記載してください。</p>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
