import { useState } from "react";
import { C, uid } from '../../lib/utils.js';
import { ProgressBar, Modal, Field } from '../../components/UI.jsx';
import { useAppStore } from '../../lib/store.js';
import JAVA_QUIZ from '../../data/quiz.json';

const CODING_CHALLENGES = [
  { id: 'c1', title: 'Hello World', difficulty: 'easy', category: 'Grundlagen', description: 'Schreibe ein Java-Programm, das "Hello, World!" auf der Konsole ausgibt.\n\nDie Klasse heißt bereits "HelloWorld". Füge nur die fehlende Ausgabe-Anweisung ein.', starterCode: `public class HelloWorld {\n    public static void main(String[] args) {\n        // Schreibe hier deine Ausgabe\n        \n    }\n}`, solution: `public class HelloWorld {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}`, checks: ['System.out.println', '"Hello, World!"'], hint: 'Nutze System.out.println() für die Ausgabe.' },
  { id: 'c2', title: 'Variablen & Ausgabe', difficulty: 'easy', category: 'Datentypen', description: 'Erstelle zwei Variablen:\n- "name" vom Typ String mit dem Wert "Max"\n- "alter" vom Typ int mit dem Wert 17\n\nGib dann aus: "Mein Name ist Max und ich bin 17 Jahre alt."', starterCode: `public class VariablenAufgabe {\n    public static void main(String[] args) {\n        // Erstelle die Variablen hier\n        \n        // Ausgabe\n        \n    }\n}`, solution: `public class VariablenAufgabe {\n    public static void main(String[] args) {\n        String name = "Max";\n        int alter = 17;\n        System.out.println("Mein Name ist " + name + " und ich bin " + alter + " Jahre alt.");\n    }\n}`, checks: ['String name', 'int alter', 'System.out.println'], hint: 'Strings verbindet man mit + zusammen.' },
  { id: 'c3', title: 'If-Else Entscheidung', difficulty: 'easy', category: 'Kontrollstrukturen', description: 'Die Variable "note" hat den Wert 3.\n\nSchreibe eine if-else Bedingung:\n- Wenn die Note kleiner oder gleich 2 ist → "Bestanden mit Auszeichnung"\n- Sonst → "Bestanden"', starterCode: `public class NoteCheck {\n    public static void main(String[] args) {\n        int note = 3;\n        \n        // if-else hier\n        \n    }\n}`, solution: `public class NoteCheck {\n    public static void main(String[] args) {\n        int note = 3;\n        if (note <= 2) {\n            System.out.println("Bestanden mit Auszeichnung");\n        } else {\n            System.out.println("Bestanden");\n        }\n    }\n}`, checks: ['if', 'else', '<='], hint: 'Verwende if (bedingung) { } else { }' },
  { id: 'c4', title: 'For-Schleife', difficulty: 'medium', category: 'Schleifen', description: 'Schreibe eine for-Schleife, die die Zahlen 1 bis 5 ausgibt.\n\nJede Zahl soll in einer eigenen Zeile stehen.', starterCode: `public class Schleife {\n    public static void main(String[] args) {\n        // for-Schleife hier\n        \n    }\n}`, solution: `public class Schleife {\n    public static void main(String[] args) {\n        for (int i = 1; i <= 5; i++) {\n            System.out.println(i);\n        }\n    }\n}`, checks: ['for', 'i = 1', 'i <= 5', 'i++'], hint: 'for (int i = 1; i <= 5; i++) zählt von 1 bis 5.' },
  { id: 'c5', title: 'Methode schreiben', difficulty: 'medium', category: 'Methoden', description: 'Schreibe eine Methode "addieren" die zwei int-Parameter a und b erhält und ihre Summe zurückgibt.\n\nRufe sie in main() mit 5 und 3 auf und gib das Ergebnis aus.', starterCode: `public class Methoden {\n    \n    // Methode hier\n    \n    public static void main(String[] args) {\n        // Aufruf hier\n        \n    }\n}`, solution: `public class Methoden {\n    \n    static int addieren(int a, int b) {\n        return a + b;\n    }\n    \n    public static void main(String[] args) {\n        int ergebnis = addieren(5, 3);\n        System.out.println(ergebnis);\n    }\n}`, checks: ['static', 'int addieren', 'return', 'addieren(5, 3)'], hint: 'Eine Methode mit Rückgabewert: static int methodenName(Parameter) { return wert; }' },
];

const DIFF = { easy: { l: 'Einfach', c: C.gr }, medium: { l: 'Mittel', c: C.yw }, hard: { l: 'Schwer', c: C.cr } };

const EMPTY_FORM = {
  question: '', category: '', difficulty: 'easy', type: 'single', explanation: '',
  answers: [
    { id: 'a', text: '', correct: true },
    { id: 'b', text: '', correct: false },
    { id: 'c', text: '', correct: false },
    { id: 'd', text: '', correct: false },
  ],
};

function QuizQuestion({ q, onAnswer, answered, selected }) {
  const isMultiple = q.type === 'multiple';
  const [multi, setMulti] = useState([]);

  const handleSingle = (aid) => { if (answered) return; onAnswer([aid]); };
  const handleMulti = (aid) => { if (answered) return; setMulti(m => m.includes(aid) ? m.filter(x => x !== aid) : [...m, aid]); };
  const submitMulti = () => { if (multi.length > 0) onAnswer(multi); };

  const getAnswerStyle = (a) => {
    if (!answered && !isMultiple) return { background: C.sf2, border: `1px solid ${C.bd}` };
    if (!answered && isMultiple) { const sel = multi.includes(a.id); return { background: sel ? C.acd : C.sf2, border: `1px solid ${sel ? C.ac : C.bd}` }; }
    const wasSelected = selected?.includes(a.id);
    if (a.correct) return { background: '#07130a', border: `2px solid ${C.gr}` };
    if (wasSelected && !a.correct) return { background: '#130a0b', border: `2px solid ${C.cr}` };
    return { background: C.sf2, border: `1px solid ${C.bd}`, opacity: .5 };
  };

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>
      <div style={{ marginBottom: 18 }}>
        <pre style={{ fontFamily: C.sans, fontSize: 14, fontWeight: 600, color: C.br, lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>{q.question}</pre>
        {isMultiple && !answered && (
          <div style={{ fontSize: 11, color: C.ac, marginTop: 6, background: C.acd, border: `1px solid ${C.ac}30`, borderRadius: 6, padding: '4px 10px', display: 'inline-block' }}>Mehrere Antworten möglich</div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {q.answers.map(a => (
          <button key={a.id} onClick={() => isMultiple ? handleMulti(a.id) : handleSingle(a.id)}
            style={{ ...getAnswerStyle(a), padding: '12px 16px', borderRadius: 9, cursor: answered ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left', transition: 'all .15s', width: '100%' }}>
            <div style={{ width: 20, height: 20, borderRadius: isMultiple ? 5 : '50%', border: `2px solid ${answered ? (a.correct ? C.gr : selected?.includes(a.id) ? C.cr : C.bd2) : C.bd2}`, background: answered && a.correct ? C.gr : answered && selected?.includes(a.id) && !a.correct ? C.cr : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s' }}>
              {answered && a.correct && <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>✓</span>}
              {answered && selected?.includes(a.id) && !a.correct && <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>✗</span>}
              {!answered && isMultiple && multi.includes(a.id) && <span style={{ color: C.ac, fontSize: 11, fontWeight: 800 }}>✓</span>}
            </div>
            <span style={{ fontSize: 13, fontWeight: 500, color: C.tx, fontFamily: a.text.includes('(') && a.text.includes(')') ? C.mono : C.sans, lineHeight: 1.5 }}>{a.text}</span>
          </button>
        ))}
      </div>
      {isMultiple && !answered && (
        <button className="abtn" onClick={submitMulti} disabled={multi.length === 0} style={{ marginBottom: 16, padding: '9px 20px' }}>Antwort bestätigen</button>
      )}
      {answered && q.explanation && (
        <div style={{ background: C.acd, border: `1px solid ${C.ac}30`, borderRadius: 9, padding: '12px 15px', animation: 'fadeUp .2s ease' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.ac, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 5 }}>Erklärung</div>
          <div style={{ fontSize: 13, color: C.tx, lineHeight: 1.65 }}>{q.explanation}</div>
        </div>
      )}
    </div>
  );
}

function QuizMode({ questions, onFinish }) {
  const [idx, setIdx]       = useState(0);
  const [answers, setAnswers] = useState({});
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);

  const q = questions[idx];
  const isLast = idx === questions.length - 1;
  const score = Object.entries(answers).filter(([qid, sel]) => {
    const quest = questions.find(x => x.id === parseInt(qid));
    const correctIds = quest?.answers.filter(a => a.correct).map(a => a.id) || [];
    return JSON.stringify([...sel].sort()) === JSON.stringify([...correctIds].sort());
  }).length;

  const handleAnswer = (sel) => { setSelected(sel); setAnswered(true); setAnswers(a => ({ ...a, [q.id]: sel })); };
  const next = () => {
    if (isLast) { onFinish(score, questions.length, answers); return; }
    setIdx(i => i + 1); setSelected(null); setAnswered(false);
  };
  const pct = Math.round(((idx) / questions.length) * 100);

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: C.mu }}>Frage <span style={{ fontWeight: 800, color: C.br }}>{idx + 1}</span> / {questions.length}</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="tag" style={{ background: DIFF[q.difficulty]?.c + '20', color: DIFF[q.difficulty]?.c, border: `1px solid ${DIFF[q.difficulty]?.c}40` }}>{DIFF[q.difficulty]?.l}</span>
            <span className="tag" style={{ background: C.sf2, color: C.mu, border: `1px solid ${C.bd}` }}>{q.category}</span>
          </div>
        </div>
        <ProgressBar value={pct} color={C.ac} height={4} label={`${pct}% der Fragen beantwortet`} />
        <div style={{ marginBottom: 22 }} />
        <div className="card" style={{ marginBottom: 16 }}>
          <QuizQuestion q={q} onAnswer={handleAnswer} answered={answered} selected={selected} />
        </div>
        {answered && (
          <button className="abtn" onClick={next} style={{ width: '100%', padding: 12, fontSize: 14 }}>
            {isLast ? 'Quiz abschließen →' : 'Nächste Frage →'}
          </button>
        )}
      </div>
    </div>
  );
}

function QuizResult({ score, total, onRestart, onBack }) {
  const pct = Math.round(score / total * 100);
  const grade = pct >= 87 ? { l: 'Ausgezeichnet! 🏆', c: C.gr } : pct >= 75 ? { l: 'Gut! 👍', c: C.ac } : pct >= 50 ? { l: 'Bestanden ✓', c: C.yw } : { l: 'Üben erforderlich 📚', c: C.cr };
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '0 24px' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 64, marginBottom: 16, lineHeight: 1 }}>{pct >= 75 ? '🎉' : pct >= 50 ? '💪' : '📚'}</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: C.br, marginBottom: 6 }}>{grade.l}</h2>
        <div style={{ fontSize: 48, fontWeight: 800, color: grade.c, fontFamily: C.mono, letterSpacing: -2, marginBottom: 4 }}>{score}/{total}</div>
        <div style={{ fontSize: 14, color: C.mu, marginBottom: 28 }}>{pct}% richtig beantwortet</div>
        <div style={{ marginBottom: 28 }}><ProgressBar value={pct} color={grade.c} height={10} label={`${pct}%`} /></div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button className="abtn" onClick={onRestart} style={{ padding: '10px 20px' }}>↺ Nochmal</button>
          <button className="btn" onClick={onBack} style={{ padding: '10px 20px' }}>← Zurück</button>
        </div>
      </div>
    </div>
  );
}

function CodingChallenge({ challenge, onBack }) {
  const [code, setCode]       = useState(challenge.starterCode);
  const [result, setResult]   = useState(null);
  const [showHint, setShowHint] = useState(false);
  const [showSol, setShowSol] = useState(false);

  const checkCode = () => {
    const passed = challenge.checks.every(chk => code.includes(chk));
    setResult({ passed, missing: challenge.checks.filter(c => !code.includes(c)) });
  };
  const reset = () => { setCode(challenge.starterCode); setResult(null); setShowSol(false); setShowHint(false); };

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }} className="anim">
      <div>
        <button className="btn" onClick={onBack} style={{ marginBottom: 16, fontSize: 11, padding: '5px 10px' }}>← Zurück</button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: C.br, margin: 0 }}>{challenge.title}</h2>
          <span className="tag" style={{ background: DIFF[challenge.difficulty]?.c + '20', color: DIFF[challenge.difficulty]?.c, border: `1px solid ${DIFF[challenge.difficulty]?.c}40` }}>{DIFF[challenge.difficulty]?.l}</span>
          <span className="tag" style={{ background: C.sf2, color: C.mu, border: `1px solid ${C.bd}` }}>{challenge.category}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div className="card" style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 10 }}>Aufgabe</div>
              <pre style={{ fontSize: 13, color: C.tx, lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: C.sans, margin: 0 }}>{challenge.description}</pre>
            </div>
            {showHint && (
              <div style={{ background: C.ywd, border: `1px solid ${C.yw}40`, borderRadius: 9, padding: '10px 14px', marginBottom: 12, animation: 'fadeUp .2s ease' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.yw, marginBottom: 4 }}>💡 Hinweis</div>
                <div style={{ fontSize: 13, color: C.tx }}>{challenge.hint}</div>
              </div>
            )}
            {showSol && (
              <div style={{ background: C.sf3, border: `1px solid ${C.ac}30`, borderRadius: 9, padding: '12px 14px', animation: 'fadeUp .2s ease' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.ac, marginBottom: 8 }}>✓ Musterlösung</div>
                <pre style={{ fontSize: 12, color: C.br, fontFamily: C.mono, lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>{challenge.solution}</pre>
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => setShowHint(s => !s)} style={{ fontSize: 11 }}>{showHint ? '🙈 Hinweis verbergen' : '💡 Hinweis anzeigen'}</button>
              <button className="btn" onClick={() => setShowSol(s => !s)} style={{ fontSize: 11, color: C.yw, borderColor: C.yw + '60' }}>{showSol ? 'Lösung verbergen' : '📖 Lösung anzeigen'}</button>
            </div>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8 }}>Java Code Editor</div>
            <textarea value={code} onChange={e => { setCode(e.target.value); setResult(null); }}
              style={{ minHeight: 280, fontFamily: C.mono, fontSize: 13, lineHeight: 1.65, background: '#0d1117', border: `1px solid ${C.bd2}`, borderRadius: 9, color: C.br, padding: 14, resize: 'vertical', width: '100%', tabSize: 4 }}
              onKeyDown={e => { if (e.key === 'Tab') { e.preventDefault(); const s = e.target.selectionStart; const v = code.substring(0, s) + '    ' + code.substring(s); setCode(v); setTimeout(() => e.target.setSelectionRange(s + 4, s + 4), 0); } }}
              spellCheck={false} />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="abtn" onClick={checkCode} style={{ flex: 1, padding: '10px' }}>▶ Code prüfen</button>
              <button className="btn" onClick={reset} style={{ padding: '10px 14px', fontSize: 12 }}>↺</button>
            </div>
            {result && (
              <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 9, background: result.passed ? '#07130a' : '#130a0b', border: `1px solid ${result.passed ? C.gr : C.cr}`, animation: 'fadeUp .2s ease' }}>
                {result.passed ? (
                  <div style={{ color: C.gr, fontWeight: 700, fontSize: 14 }}>✓ Super! Dein Code enthält alle nötigen Elemente.</div>
                ) : (
                  <div>
                    <div style={{ color: C.cr, fontWeight: 700, fontSize: 13, marginBottom: 6 }}>✗ Noch nicht ganz. Folgendes fehlt oder ist falsch:</div>
                    {result.missing.map(m => <div key={m} style={{ fontSize: 12, color: C.tx, fontFamily: C.mono, padding: '2px 0' }}>• {m}</div>)}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LearnPage({ currentUser }) {
  const { data, setData }           = useAppStore();
  const [view, setView]             = useState('home');
  const [quizQuestions, setQ]       = useState([]);
  const [quizScore, setScore]       = useState(null);
  const [quizTotal, setTotal]       = useState(null);
  const [selChallenge, setChall]    = useState(null);
  const [catFilter, setCat]         = useState('Alle');
  const [diffFilter, setDiff]       = useState('Alle');
  const [showAddQ, setShowAddQ]     = useState(false);
  const [qForm, setQForm]           = useState(EMPTY_FORM);
  const [editingQ, setEditingQ]     = useState(null);

  const customQuestions = data?.quizzes || [];
  const isAusbilder = currentUser?.role === 'ausbilder';
  const allQuestions = [...JAVA_QUIZ, ...customQuestions];
  const CATS = [...new Set(allQuestions.map(q => q.category))];

  const filteredQ = allQuestions.filter(q =>
    (catFilter === 'Alle' || q.category === catFilter) &&
    (diffFilter === 'Alle' || q.difficulty === diffFilter)
  );

  const saveCustom = (next) => setData(prev => ({ ...prev, quizzes: next }));

  const openAdd = () => { setQForm(EMPTY_FORM); setEditingQ(null); setShowAddQ(true); };
  const openEdit = (q) => {
    setQForm({
      question:    q.question,
      category:    q.category,
      difficulty:  q.difficulty,
      type:        q.type,
      explanation: q.explanation || '',
      answers: ['a', 'b', 'c', 'd'].map(id => {
        const found = q.answers.find(a => a.id === id);
        return found ?? { id, text: '', correct: false };
      }),
    });
    setEditingQ(q);
    setShowAddQ(true);
  };
  const closeModal = () => { setShowAddQ(false); setQForm(EMPTY_FORM); setEditingQ(null); };

  const addQuestion = () => {
    const filled = qForm.answers.filter(a => a.text.trim());
    if (!qForm.question.trim() || !qForm.category.trim() || filled.length < 2) return;
    if (!filled.some(a => a.correct && a.text.trim())) return;
    const answers = qForm.answers.map(a => ({ ...a, text: a.text.trim() })).filter(a => a.text);
    if (editingQ) {
      saveCustom(customQuestions.map(q => q.id === editingQ.id
        ? { ...q, question: qForm.question.trim(), category: qForm.category.trim(), difficulty: qForm.difficulty, type: qForm.type, explanation: qForm.explanation, answers }
        : q));
    } else {
      saveCustom([...customQuestions, { ...qForm, id: uid(), question: qForm.question.trim(), category: qForm.category.trim(), answers, custom: true }]);
    }
    closeModal();
  };

  const deleteCustomQ = (id) => saveCustom(customQuestions.filter(q => q.id !== id));

  const startQuiz = (questions) => {
    const shuffled = [...questions].sort(() => Math.random() - .5).slice(0, Math.min(10, questions.length));
    setQ(shuffled);
    setView('quiz');
  };

  const onFinish = (score, total) => {
    setScore(score); setTotal(total); setView('result');
    try {
      const key = `azubi_quiz_${currentUser?.id || 'anon'}`;
      const prev = JSON.parse(localStorage.getItem(key) || '[]');
      const entry = { score, total, pct: Math.round(score/total*100), date: new Date().toISOString(), questions: quizQuestions.length };
      localStorage.setItem(key, JSON.stringify([entry, ...prev].slice(0, 20)));
    } catch {}
  };

  if (view === 'quiz')   return <QuizMode questions={quizQuestions} onFinish={onFinish} />;
  if (view === 'result') return <QuizResult score={quizScore} total={quizTotal} onRestart={() => startQuiz(quizQuestions)} onBack={() => setView('home')} />;
  if (view === 'coding') return <CodingChallenge challenge={selChallenge} onBack={() => setView('home')} />;

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }} className="anim">
      <h1 style={{ fontSize: 20, fontWeight: 800, color: C.br, marginBottom: 4 }}>Lernbereich 🎓</h1>
      <p style={{ fontSize: 13, color: C.mu, marginBottom: 24 }}>Java-Grundlagen, Quiz und Programmieraufgaben</p>

      <section style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.br }}>Java Quiz</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ fontSize: 11, color: C.mu }}>{allQuestions.length} Fragen{customQuestions.length > 0 && ` (${customQuestions.length} eigene)`}</div>
            {isAusbilder && (
              <button className="abtn" onClick={openAdd} style={{ fontSize: 11, padding: '4px 10px' }}>+ Frage hinzufügen</button>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: C.mu, fontWeight: 700, marginRight: 2 }}>Kategorie:</span>
            {['Alle', ...CATS].map(c => (
              <button key={c} onClick={() => setCat(c)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: `1px solid ${catFilter === c ? C.ac : C.bd2}`, background: catFilter === c ? C.acd : C.sf2, color: catFilter === c ? C.ac : C.mu, cursor: 'pointer', transition: 'all .15s' }}>{c}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: C.mu, fontWeight: 700, marginRight: 2 }}>Schwierigkeit:</span>
            {['Alle', 'easy', 'medium', 'hard'].map(d => (
              <button key={d} onClick={() => setDiff(d)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: `1px solid ${diffFilter === d ? C.ac : C.bd2}`, background: diffFilter === d ? C.acd : C.sf2, color: diffFilter === d ? C.ac : C.mu, cursor: 'pointer', transition: 'all .15s' }}>
                {d === 'Alle' ? 'Alle' : DIFF[d]?.l}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 12, marginBottom: 14 }}>
          {[
            { l: 'Schnell-Quiz',   icon: '⚡', desc: '10 zufällige Fragen', q: allQuestions },
            { l: 'Nur Grundlagen', icon: '🟢', desc: 'Einstieg ins Thema',  q: allQuestions.filter(q => q.category === 'Grundlagen') },
            { l: 'OOP Fokus',      icon: '🔷', desc: 'Klassen & Objekte',   q: allQuestions.filter(q => q.category === 'OOP') },
            { l: 'Nur Schwere',    icon: '🔴', desc: 'Hard-Level Fragen',   q: allQuestions.filter(q => q.difficulty === 'hard') },
          ].map(card => (
            <button key={card.l} onClick={() => startQuiz(card.q)} disabled={card.q.length === 0}
              style={{ padding: '16px', borderRadius: 10, background: C.sf2, border: `1px solid ${C.bd}`, cursor: 'pointer', textAlign: 'left', transition: 'all .15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = C.ac; e.currentTarget.style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = C.bd; e.currentTarget.style.transform = 'none'; }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{card.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.br, marginBottom: 3 }}>{card.l}</div>
              <div style={{ fontSize: 11, color: C.mu }}>{card.desc}</div>
              <div style={{ fontSize: 10, color: C.ac, marginTop: 6, fontFamily: C.mono }}>{Math.min(10, card.q.length)} Fragen</div>
            </button>
          ))}
        </div>
        {filteredQ.length > 0 && (
          <button className="abtn" onClick={() => startQuiz(filteredQ)} style={{ padding: '10px 22px' }}>
            Gefiltertes Quiz starten ({Math.min(10, filteredQ.length)} Fragen)
          </button>
        )}
      </section>

      <section style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.br, marginBottom: 14 }}>Programmieraufgaben 💻</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 12 }}>
          {CODING_CHALLENGES.map(c => (
            <div key={c.id} className="card" style={{ cursor: 'pointer', transition: 'transform .15s, border-color .15s' }}
              onClick={() => { setChall(c); setView('coding'); }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = C.ac; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = C.bd; }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.br }}>{c.title}</div>
                <span className="tag" style={{ background: DIFF[c.difficulty]?.c + '20', color: DIFF[c.difficulty]?.c, border: `1px solid ${DIFF[c.difficulty]?.c}40`, flexShrink: 0 }}>{DIFF[c.difficulty]?.l}</span>
              </div>
              <div style={{ fontSize: 12, color: C.mu, lineHeight: 1.6, marginBottom: 10 }}>{c.description.split('\n')[0]}</div>
              <div style={{ fontSize: 10, color: C.ac, fontFamily: C.mono }}>{c.category}</div>
            </div>
          ))}
        </div>
      </section>

      {isAusbilder && customQuestions.length > 0 && (
        <section>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.br, marginBottom: 14 }}>Eigene Quiz-Fragen 📝</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {customQuestions.map(q => (
              <div key={q.id} className="card" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: C.br, marginBottom: 5 }}>{q.question}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <span className="tag" style={{ background: C.sf2, color: C.mu, border: `1px solid ${C.bd}` }}>{q.category}</span>
                    <span className="tag" style={{ background: DIFF[q.difficulty]?.c + '20', color: DIFF[q.difficulty]?.c, border: `1px solid ${DIFF[q.difficulty]?.c}40` }}>{DIFF[q.difficulty]?.l}</span>
                    <span className="tag" style={{ background: C.sf2, color: C.mu, border: `1px solid ${C.bd}` }}>{q.answers.filter(a => a.correct).length > 1 ? 'Mehrfach' : 'Einfach'}</span>
                  </div>
                </div>
                <button className="btn" onClick={() => openEdit(q)} style={{ padding: '3px 9px', fontSize: 12 }} title="Bearbeiten">✎</button>
                <button className="del" onClick={() => deleteCustomQ(q.id)} aria-label="Frage löschen">×</button>
              </div>
            ))}
          </div>
        </section>
      )}

      {showAddQ && (
        <Modal title={editingQ ? 'Frage bearbeiten' : 'Neue Quiz-Frage erstellen'} onClose={closeModal}>
          <Field label="Frage">
            <textarea value={qForm.question} onChange={e => setQForm(f => ({ ...f, question: e.target.value }))}
              placeholder="Fragetext eingeben..." rows={3} style={{ resize: 'vertical' }} autoFocus />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Field label="Kategorie">
              <input value={qForm.category} onChange={e => setQForm(f => ({ ...f, category: e.target.value }))}
                placeholder="z.B. OOP" list="cat-list" />
              <datalist id="cat-list">{CATS.map(c => <option key={c} value={c} />)}</datalist>
            </Field>
            <Field label="Schwierigkeit">
              <select value={qForm.difficulty} onChange={e => setQForm(f => ({ ...f, difficulty: e.target.value }))}>
                <option value="easy">Einfach</option>
                <option value="medium">Mittel</option>
                <option value="hard">Schwer</option>
              </select>
            </Field>
            <Field label="Typ">
              <select value={qForm.type} onChange={e => setQForm(f => ({ ...f, type: e.target.value }))}>
                <option value="single">Einfachauswahl</option>
                <option value="multiple">Mehrfachauswahl</option>
              </select>
            </Field>
          </div>
          <Field label="Antwortmöglichkeiten (mind. 2 ausfüllen, mind. 1 korrekt markieren)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 4 }}>
              {qForm.answers.map((ans, i) => (
                <div key={ans.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.mu, width: 14, flexShrink: 0 }}>{ans.id.toUpperCase()}</div>
                  <input value={ans.text} onChange={e => setQForm(f => ({ ...f, answers: f.answers.map((a, j) => j === i ? { ...a, text: e.target.value } : a) }))}
                    placeholder={`Antwort ${ans.id.toUpperCase()}`} style={{ flex: 1 }} />
                  <button onClick={() => setQForm(f => ({
                    ...f,
                    answers: f.answers.map((a, j) => qForm.type === 'single'
                      ? { ...a, correct: j === i }
                      : j === i ? { ...a, correct: !a.correct } : a)
                  }))} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all .15s',
                    background: ans.correct ? C.acd : C.sf2, border: `1px solid ${ans.correct ? C.ac : C.bd2}`, color: ans.correct ? C.ac : C.mu }}>
                    {ans.correct ? '✓ Korrekt' : 'Markieren'}
                  </button>
                </div>
              ))}
            </div>
          </Field>
          <Field label="Erklärung (optional)">
            <textarea value={qForm.explanation} onChange={e => setQForm(f => ({ ...f, explanation: e.target.value }))}
              placeholder="Erklärung zur richtigen Antwort..." rows={2} style={{ resize: 'vertical' }} />
          </Field>
          <button className="abtn" onClick={addQuestion} style={{ width: '100%', marginTop: 8, padding: 11 }}
            disabled={!qForm.question.trim() || !qForm.category.trim() || qForm.answers.filter(a => a.text.trim()).length < 2 || !qForm.answers.some(a => a.correct && a.text.trim())}>
            {editingQ ? 'Änderungen speichern' : 'Frage speichern'}
          </button>
        </Modal>
      )}
    </div>
  );
}
