import { useState, useEffect, useRef } from "react";
import { C, uid } from './utils.js';
import { ProgressBar, EmptyState, Modal } from './Components.jsx';

// ── Java Quiz-Daten ───────────────────────────────────────────
const JAVA_QUIZ = [
  // ── Grundlagen ──
  {
    id: 1, category: 'Grundlagen', difficulty: 'easy',
    question: 'Wie lautet die korrekte Syntax für ein Hello-World-Programm in Java?',
    type: 'single',
    answers: [
      { id: 'a', text: 'System.out.println("Hello World");', correct: true },
      { id: 'b', text: 'print("Hello World");', correct: false },
      { id: 'c', text: 'Console.WriteLine("Hello World");', correct: false },
      { id: 'd', text: 'echo "Hello World";', correct: false },
    ],
    explanation: 'In Java gibt man Text mit System.out.println() auf der Konsole aus. System ist die Klasse, out ist der Ausgabestream, println() die Methode.',
  },
  {
    id: 2, category: 'Grundlagen', difficulty: 'easy',
    question: 'Was ist die Hauptmethode (Einstiegspunkt) in einem Java-Programm?',
    type: 'single',
    answers: [
      { id: 'a', text: 'public static void main(String[] args)', correct: true },
      { id: 'b', text: 'public void start()', correct: false },
      { id: 'c', text: 'static int main()', correct: false },
      { id: 'd', text: 'void run(String args)', correct: false },
    ],
    explanation: 'Die main-Methode ist der Startpunkt jedes Java-Programms. Sie muss public, static und void sein und ein String-Array als Parameter haben.',
  },
  {
    id: 3, category: 'Grundlagen', difficulty: 'easy',
    question: 'Welches Schlüsselwort wird verwendet, um eine Klasse in Java zu definieren?',
    type: 'single',
    answers: [
      { id: 'a', text: 'class', correct: true },
      { id: 'b', text: 'object', correct: false },
      { id: 'c', text: 'define', correct: false },
      { id: 'd', text: 'struct', correct: false },
    ],
    explanation: 'Mit dem Schlüsselwort "class" wird eine Klasse in Java definiert. Z.B.: public class MeineKlasse { }',
  },
  {
    id: 4, category: 'Grundlagen', difficulty: 'easy',
    question: 'Mit welchem Symbol werden Anweisungen in Java abgeschlossen?',
    type: 'single',
    answers: [
      { id: 'a', text: ';  (Semikolon)', correct: true },
      { id: 'b', text: '.  (Punkt)', correct: false },
      { id: 'c', text: ':  (Doppelpunkt)', correct: false },
      { id: 'd', text: 'Zeilenumbruch', correct: false },
    ],
    explanation: 'In Java muss jede Anweisung mit einem Semikolon (;) abgeschlossen werden.',
  },
  {
    id: 5, category: 'Datentypen', difficulty: 'easy',
    question: 'Welcher Datentyp wird für ganze Zahlen in Java verwendet?',
    type: 'single',
    answers: [
      { id: 'a', text: 'int', correct: true },
      { id: 'b', text: 'float', correct: false },
      { id: 'c', text: 'char', correct: false },
      { id: 'd', text: 'bool', correct: false },
    ],
    explanation: '"int" steht für Integer (ganze Zahl). In Java gibt es auch byte, short, long für andere Ganzzahl-Bereiche.',
  },
  {
    id: 6, category: 'Datentypen', difficulty: 'easy',
    question: 'Was ist der Unterschied zwischen int und double in Java?',
    type: 'single',
    answers: [
      { id: 'a', text: 'int speichert ganze Zahlen, double speichert Dezimalzahlen', correct: true },
      { id: 'b', text: 'int ist größer als double', correct: false },
      { id: 'c', text: 'double kann nur positive Zahlen speichern', correct: false },
      { id: 'd', text: 'Es gibt keinen Unterschied', correct: false },
    ],
    explanation: 'int nimmt Ganzzahlen (z.B. 5, -3, 100), double nimmt Fließkommazahlen (z.B. 3.14, -0.5).',
  },
  {
    id: 7, category: 'Datentypen', difficulty: 'easy',
    question: 'Wie deklariert man eine Variable vom Typ String in Java?',
    type: 'single',
    answers: [
      { id: 'a', text: 'String name = "Max";', correct: true },
      { id: 'b', text: 'string name = "Max";', correct: false },
      { id: 'c', text: 'TEXT name = "Max";', correct: false },
      { id: 'd', text: 'var name : String = "Max";', correct: false },
    ],
    explanation: 'In Java beginnt String mit einem Großbuchstaben, da es eine Klasse ist, kein primitiver Typ.',
  },
  {
    id: 8, category: 'Operatoren', difficulty: 'easy',
    question: 'Was gibt folgender Code aus?\n\nint x = 10;\nint y = 3;\nSystem.out.println(x % y);',
    type: 'single',
    answers: [
      { id: 'a', text: '1', correct: true },
      { id: 'b', text: '3', correct: false },
      { id: 'c', text: '3.33', correct: false },
      { id: 'd', text: '0', correct: false },
    ],
    explanation: '% ist der Modulo-Operator. 10 % 3 = 1, weil 10 / 3 = 3 Rest 1.',
  },
  {
    id: 9, category: 'Kontrollstrukturen', difficulty: 'medium',
    question: 'Was gibt folgender Code aus?\n\nfor (int i = 0; i < 3; i++) {\n  System.out.print(i + " ");\n}',
    type: 'single',
    answers: [
      { id: 'a', text: '0 1 2', correct: true },
      { id: 'b', text: '1 2 3', correct: false },
      { id: 'c', text: '0 1 2 3', correct: false },
      { id: 'd', text: '1 2', correct: false },
    ],
    explanation: 'Die Schleife beginnt bei i=0, läuft solange i < 3. Also 0, 1, 2. print() macht keinen Zeilenumbruch.',
  },
  {
    id: 10, category: 'Kontrollstrukturen', difficulty: 'medium',
    question: 'Welche Schleife wird MINDESTENS einmal ausgeführt, auch wenn die Bedingung falsch ist?',
    type: 'single',
    answers: [
      { id: 'a', text: 'do-while', correct: true },
      { id: 'b', text: 'while', correct: false },
      { id: 'c', text: 'for', correct: false },
      { id: 'd', text: 'foreach', correct: false },
    ],
    explanation: 'Bei do-while wird der Code-Block zuerst ausgeführt, dann die Bedingung geprüft. Daher läuft sie immer mindestens einmal.',
  },
  {
    id: 11, category: 'OOP', difficulty: 'medium',
    question: 'Was bedeutet das Schlüsselwort "this" in Java?',
    type: 'single',
    answers: [
      { id: 'a', text: 'Referenz auf das aktuelle Objekt', correct: true },
      { id: 'b', text: 'Referenz auf die Klasse', correct: false },
      { id: 'c', text: 'Ein neues Objekt erstellen', correct: false },
      { id: 'd', text: 'Das übergeordnete Objekt', correct: false },
    ],
    explanation: '"this" verweist auf die aktuelle Instanz der Klasse. Nützlich um Attribute von lokalen Variablen zu unterscheiden.',
  },
  {
    id: 12, category: 'OOP', difficulty: 'medium',
    question: 'Was ist ein Konstruktor in Java?',
    type: 'single',
    answers: [
      { id: 'a', text: 'Eine spezielle Methode zum Erstellen von Objekten', correct: true },
      { id: 'b', text: 'Eine Methode zum Löschen von Objekten', correct: false },
      { id: 'c', text: 'Eine statische Klasse', correct: false },
      { id: 'd', text: 'Ein Interface', correct: false },
    ],
    explanation: 'Ein Konstruktor hat denselben Namen wie die Klasse und keinen Rückgabetyp. Er wird mit "new" aufgerufen.',
  },
  {
    id: 13, category: 'OOP', difficulty: 'medium',
    question: 'Welche der folgenden Aussagen zu "extends" ist korrekt?',
    type: 'single',
    answers: [
      { id: 'a', text: 'Eine Klasse erbt von einer anderen Klasse', correct: true },
      { id: 'b', text: 'Eine Klasse implementiert ein Interface', correct: false },
      { id: 'c', text: 'Eine Methode wird überschrieben', correct: false },
      { id: 'd', text: 'Eine Variable wird erweitert', correct: false },
    ],
    explanation: '"extends" wird für Vererbung genutzt. "implements" ist für Interfaces. In Java kann eine Klasse nur von einer anderen Klasse erben.',
  },
  {
    id: 14, category: 'Arrays', difficulty: 'medium',
    question: 'Wie erstellt man ein int-Array mit 5 Elementen in Java?',
    type: 'single',
    answers: [
      { id: 'a', text: 'int[] arr = new int[5];', correct: true },
      { id: 'b', text: 'int arr[5];', correct: false },
      { id: 'c', text: 'array int arr = 5;', correct: false },
      { id: 'd', text: 'int arr = new int(5);', correct: false },
    ],
    explanation: 'In Java wird ein Array mit dem Typ, eckigen Klammern und new erstellt. Der Index geht von 0 bis 4 bei 5 Elementen.',
  },
  {
    id: 15, category: 'Arrays', difficulty: 'medium',
    question: 'Was ist der Index des ersten Elements eines Arrays in Java?',
    type: 'single',
    answers: [
      { id: 'a', text: '0', correct: true },
      { id: 'b', text: '1', correct: false },
      { id: 'c', text: '-1', correct: false },
      { id: 'd', text: 'Abhängig von der Größe', correct: false },
    ],
    explanation: 'Arrays in Java sind nullbasiert. Das erste Element hat immer Index 0, das letzte Index (Länge - 1).',
  },
  {
    id: 16, category: 'Methoden', difficulty: 'medium',
    question: 'Was bedeutet "void" als Rückgabetyp einer Methode?',
    type: 'single',
    answers: [
      { id: 'a', text: 'Die Methode gibt keinen Wert zurück', correct: true },
      { id: 'b', text: 'Die Methode gibt null zurück', correct: false },
      { id: 'c', text: 'Die Methode gibt einen leeren String zurück', correct: false },
      { id: 'd', text: 'Die Methode gibt 0 zurück', correct: false },
    ],
    explanation: '"void" bedeutet, die Methode hat keinen Rückgabewert. Methoden mit void brauchen kein "return".',
  },
  {
    id: 17, category: 'Exceptions', difficulty: 'hard',
    question: 'Was passiert bei einer NullPointerException?',
    type: 'single',
    answers: [
      { id: 'a', text: 'Auf ein Objekt wird zugegriffen, das null ist', correct: true },
      { id: 'b', text: 'Eine Zahl wird durch null geteilt', correct: false },
      { id: 'c', text: 'Ein Array hat zu viele Elemente', correct: false },
      { id: 'd', text: 'Eine Variable hat keinen Namen', correct: false },
    ],
    explanation: 'NullPointerException tritt auf, wenn man Methoden oder Attribute eines Objekts aufruft, das nicht initialisiert wurde (null ist).',
  },
  {
    id: 18, category: 'Exceptions', difficulty: 'hard',
    question: 'Welche Blöcke gehören zu einer Try-Catch-Struktur?',
    type: 'multiple',
    answers: [
      { id: 'a', text: 'try', correct: true },
      { id: 'b', text: 'catch', correct: true },
      { id: 'c', text: 'finally', correct: true },
      { id: 'd', text: 'handle', correct: false },
    ],
    explanation: 'try enthält den risikoreichen Code, catch fängt Fehler ab, finally wird immer ausgeführt (optional). "handle" existiert nicht.',
  },
  {
    id: 19, category: 'OOP', difficulty: 'hard',
    question: 'Was sind die vier Säulen der objektorientierten Programmierung?',
    type: 'multiple',
    answers: [
      { id: 'a', text: 'Kapselung (Encapsulation)', correct: true },
      { id: 'b', text: 'Vererbung (Inheritance)', correct: true },
      { id: 'c', text: 'Polymorphismus', correct: true },
      { id: 'd', text: 'Abstraktion', correct: true },
    ],
    explanation: 'Die vier OOP-Prinzipien: Kapselung (Daten verbergen), Vererbung (Klassen erweitern), Polymorphismus (gleiche Schnittstelle, verschiedene Implementierungen), Abstraktion (Komplexität verbergen).',
  },
  {
    id: 20, category: 'Grundlagen', difficulty: 'easy',
    question: 'Was ist ein Java-Paket (Package)?',
    type: 'single',
    answers: [
      { id: 'a', text: 'Eine Gruppe von verwandten Klassen und Interfaces', correct: true },
      { id: 'b', text: 'Eine Datei mit Java-Code', correct: false },
      { id: 'c', text: 'Ein Komprimierungsformat', correct: false },
      { id: 'd', text: 'Eine Art von Methode', correct: false },
    ],
    explanation: 'Pakete organisieren Java-Klassen in Namensräume. Z.B. java.util enthält Hilfsklassen, java.io für Ein-/Ausgabe.',
  },
];

// Coding-Aufgaben
const CODING_CHALLENGES = [
  {
    id: 'c1', title: 'Hello World', difficulty: 'easy', category: 'Grundlagen',
    description: 'Schreibe ein Java-Programm, das "Hello, World!" auf der Konsole ausgibt.\n\nDie Klasse heißt bereits "HelloWorld". Füge nur die fehlende Ausgabe-Anweisung ein.',
    starterCode: `public class HelloWorld {
    public static void main(String[] args) {
        // Schreibe hier deine Ausgabe
        
    }
}`,
    solution: `public class HelloWorld {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
    }
}`,
    checks: ['System.out.println', '"Hello, World!"'],
    hint: 'Nutze System.out.println() für die Ausgabe.',
  },
  {
    id: 'c2', title: 'Variablen & Ausgabe', difficulty: 'easy', category: 'Datentypen',
    description: 'Erstelle zwei Variablen:\n- "name" vom Typ String mit dem Wert "Max"\n- "alter" vom Typ int mit dem Wert 17\n\nGib dann aus: "Mein Name ist Max und ich bin 17 Jahre alt."',
    starterCode: `public class VariablenAufgabe {
    public static void main(String[] args) {
        // Erstelle die Variablen hier
        
        // Ausgabe
        
    }
}`,
    solution: `public class VariablenAufgabe {
    public static void main(String[] args) {
        String name = "Max";
        int alter = 17;
        System.out.println("Mein Name ist " + name + " und ich bin " + alter + " Jahre alt.");
    }
}`,
    checks: ['String name', 'int alter', 'System.out.println'],
    hint: 'Strings verbindet man mit + zusammen.',
  },
  {
    id: 'c3', title: 'If-Else Entscheidung', difficulty: 'easy', category: 'Kontrollstrukturen',
    description: 'Die Variable "note" hat den Wert 3.\n\nSchreibe eine if-else Bedingung:\n- Wenn die Note kleiner oder gleich 2 ist → "Bestanden mit Auszeichnung"\n- Sonst → "Bestanden"',
    starterCode: `public class NoteCheck {
    public static void main(String[] args) {
        int note = 3;
        
        // if-else hier
        
    }
}`,
    solution: `public class NoteCheck {
    public static void main(String[] args) {
        int note = 3;
        if (note <= 2) {
            System.out.println("Bestanden mit Auszeichnung");
        } else {
            System.out.println("Bestanden");
        }
    }
}`,
    checks: ['if', 'else', '<='],
    hint: 'Verwende if (bedingung) { } else { }',
  },
  {
    id: 'c4', title: 'For-Schleife', difficulty: 'medium', category: 'Schleifen',
    description: 'Schreibe eine for-Schleife, die die Zahlen 1 bis 5 ausgibt.\n\nJede Zahl soll in einer eigenen Zeile stehen.',
    starterCode: `public class Schleife {
    public static void main(String[] args) {
        // for-Schleife hier
        
    }
}`,
    solution: `public class Schleife {
    public static void main(String[] args) {
        for (int i = 1; i <= 5; i++) {
            System.out.println(i);
        }
    }
}`,
    checks: ['for', 'i = 1', 'i <= 5', 'i++'],
    hint: 'for (int i = 1; i <= 5; i++) zählt von 1 bis 5.',
  },
  {
    id: 'c5', title: 'Methode schreiben', difficulty: 'medium', category: 'Methoden',
    description: 'Schreibe eine Methode "addieren" die zwei int-Parameter a und b erhält und ihre Summe zurückgibt.\n\nRufe sie in main() mit 5 und 3 auf und gib das Ergebnis aus.',
    starterCode: `public class Methoden {
    
    // Methode hier
    
    public static void main(String[] args) {
        // Aufruf hier
        
    }
}`,
    solution: `public class Methoden {
    
    static int addieren(int a, int b) {
        return a + b;
    }
    
    public static void main(String[] args) {
        int ergebnis = addieren(5, 3);
        System.out.println(ergebnis);
    }
}`,
    checks: ['static', 'int addieren', 'return', 'addieren(5, 3)'],
    hint: 'Eine Methode mit Rückgabewert: static int methodenName(Parameter) { return wert; }',
  },
];

const DIFF = { easy: { l: 'Einfach', c: C.gr }, medium: { l: 'Mittel', c: C.yw }, hard: { l: 'Schwer', c: C.cr } };
const CATS = [...new Set(JAVA_QUIZ.map(q => q.category))];

// ── Quiz-Frage Komponente ─────────────────────────────────────
function QuizQuestion({ q, onAnswer, answered, selected }) {
  const isMultiple = q.type === 'multiple';
  const [multi, setMulti] = useState([]);

  const handleSingle = (aid) => {
    if (answered) return;
    onAnswer([aid]);
  };
  const handleMulti = (aid) => {
    if (answered) return;
    setMulti(m => m.includes(aid) ? m.filter(x => x !== aid) : [...m, aid]);
  };
  const submitMulti = () => { if (multi.length > 0) onAnswer(multi); };

  const getAnswerStyle = (a) => {
    if (!answered && !isMultiple) return { background: C.sf2, border: `1px solid ${C.bd}` };
    if (!answered && isMultiple) {
      const sel = multi.includes(a.id);
      return { background: sel ? C.acd : C.sf2, border: `1px solid ${sel ? C.ac : C.bd}` };
    }
    const wasSelected = selected?.includes(a.id);
    if (a.correct) return { background: '#07130a', border: `2px solid ${C.gr}` };
    if (wasSelected && !a.correct) return { background: '#130a0b', border: `2px solid ${C.cr}` };
    return { background: C.sf2, border: `1px solid ${C.bd}`, opacity: .5 };
  };

  return (
    <div style={{ animation: 'fadeUp .2s ease' }}>
      {/* Frage */}
      <div style={{ marginBottom: 18 }}>
        <pre style={{ fontFamily: C.sans, fontSize: 14, fontWeight: 600, color: C.br, lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0 }}>
          {q.question}
        </pre>
        {isMultiple && !answered && (
          <div style={{ fontSize: 11, color: C.ac, marginTop: 6, background: C.acd, border: `1px solid ${C.ac}30`, borderRadius: 6, padding: '4px 10px', display: 'inline-block' }}>
            Mehrere Antworten möglich
          </div>
        )}
      </div>

      {/* Antworten */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
        {q.answers.map(a => (
          <button key={a.id} onClick={() => isMultiple ? handleMulti(a.id) : handleSingle(a.id)}
            style={{ ...getAnswerStyle(a), padding: '12px 16px', borderRadius: 9, cursor: answered ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left', transition: 'all .15s', width: '100%' }}>
            {/* Kreis / Checkbox */}
            <div style={{ width: 20, height: 20, borderRadius: isMultiple ? 5 : '50%', border: `2px solid ${answered ? (a.correct ? C.gr : selected?.includes(a.id) ? C.cr : C.bd2) : C.bd2}`, background: answered && a.correct ? C.gr : answered && selected?.includes(a.id) && !a.correct ? C.cr : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all .15s' }}>
              {answered && a.correct && <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>✓</span>}
              {answered && selected?.includes(a.id) && !a.correct && <span style={{ color: '#fff', fontSize: 11, fontWeight: 800 }}>✗</span>}
              {!answered && isMultiple && multi.includes(a.id) && <span style={{ color: C.ac, fontSize: 11, fontWeight: 800 }}>✓</span>}
            </div>
            <span style={{ fontSize: 13, fontWeight: 500, color: C.tx, fontFamily: a.text.includes('(') && a.text.includes(')') ? C.mono : C.sans, lineHeight: 1.5 }}>{a.text}</span>
          </button>
        ))}
      </div>

      {/* Mehrfach: Bestätigen */}
      {isMultiple && !answered && (
        <button className="abtn" onClick={submitMulti} disabled={multi.length === 0} style={{ marginBottom: 16, padding: '9px 20px' }}>
          Antwort bestätigen
        </button>
      )}

      {/* Erklärung */}
      {answered && q.explanation && (
        <div style={{ background: C.acd, border: `1px solid ${C.ac}30`, borderRadius: 9, padding: '12px 15px', animation: 'fadeUp .2s ease' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: C.ac, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 5 }}>Erklärung</div>
          <div style={{ fontSize: 13, color: C.tx, lineHeight: 1.65 }}>{q.explanation}</div>
        </div>
      )}
    </div>
  );
}

// ── Quiz-Modus ────────────────────────────────────────────────
function QuizMode({ questions, onFinish }) {
  const [idx, setIdx]       = useState(0);
  const [answers, setAnswers] = useState({});
  const [selected, setSelected] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);

  const q = questions[idx];
  const isLast = idx === questions.length - 1;
  const score = Object.entries(answers).filter(([qid, sel]) => {
    const quest = questions.find(x => x.id === parseInt(qid));
    const correctIds = quest?.answers.filter(a => a.correct).map(a => a.id) || [];
    return JSON.stringify([...sel].sort()) === JSON.stringify([...correctIds].sort());
  }).length;

  const handleAnswer = (sel) => {
    setSelected(sel);
    setAnswered(true);
    setAnswers(a => ({ ...a, [q.id]: sel }));
  };

  const next = () => {
    if (isLast) { onFinish(score, questions.length, answers); return; }
    setIdx(i => i + 1);
    setSelected(null);
    setAnswered(false);
  };

  const pct = Math.round(((idx) / questions.length) * 100);

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
      <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: C.mu }}>
          Frage <span style={{ fontWeight: 800, color: C.br }}>{idx + 1}</span> / {questions.length}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="tag" style={{ background: DIFF[q.difficulty]?.c + '20', color: DIFF[q.difficulty]?.c, border: `1px solid ${DIFF[q.difficulty]?.c}40` }}>
            {DIFF[q.difficulty]?.l}
          </span>
          <span className="tag" style={{ background: C.sf2, color: C.mu, border: `1px solid ${C.bd}` }}>
            {q.category}
          </span>
        </div>
      </div>

      <ProgressBar value={pct} color={C.ac} height={4} label={`${pct}% der Fragen beantwortet`} />
      <div style={{ marginBottom: 22 }} />

      {/* Frage */}
      <div className="card" style={{ marginBottom: 16 }}>
        <QuizQuestion q={q} onAnswer={handleAnswer} answered={answered} selected={selected} />
      </div>

      {/* Weiter-Button */}
      {answered && (
        <button className="abtn" onClick={next} style={{ width: '100%', padding: 12, fontSize: 14 }}>
          {isLast ? 'Quiz abschließen →' : 'Nächste Frage →'}
        </button>
      )}
      </div>
    </div>
  );
}

// ── Quiz-Ergebnis ─────────────────────────────────────────────
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
      <div style={{ marginBottom: 28 }}>
        <ProgressBar value={pct} color={grade.c} height={10} label={`${pct}%`} />
      </div>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
        <button className="abtn" onClick={onRestart} style={{ padding: '10px 20px' }}>↺ Nochmal</button>
        <button className="btn" onClick={onBack} style={{ padding: '10px 20px' }}>← Zurück</button>
      </div>
      </div>
    </div>
  );
}

// ── Coding-Challenge Komponente ───────────────────────────────
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
        <span className="tag" style={{ background: DIFF[challenge.difficulty]?.c + '20', color: DIFF[challenge.difficulty]?.c, border: `1px solid ${DIFF[challenge.difficulty]?.c}40` }}>
          {DIFF[challenge.difficulty]?.l}
        </span>
        <span className="tag" style={{ background: C.sf2, color: C.mu, border: `1px solid ${C.bd}` }}>{challenge.category}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Linke Seite: Aufgabe */}
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
            <button className="btn" onClick={() => setShowHint(s => !s)} style={{ fontSize: 11 }}>
              {showHint ? '🙈 Hinweis verbergen' : '💡 Hinweis anzeigen'}
            </button>
            <button className="btn" onClick={() => setShowSol(s => !s)} style={{ fontSize: 11, color: C.yw, borderColor: C.yw + '60' }}>
              {showSol ? 'Lösung verbergen' : '📖 Lösung anzeigen'}
            </button>
          </div>
        </div>

        {/* Rechte Seite: Editor */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: C.mu, textTransform: 'uppercase', letterSpacing: .8, marginBottom: 8 }}>Java Code Editor</div>
          <textarea
            value={code}
            onChange={e => { setCode(e.target.value); setResult(null); }}
            style={{ minHeight: 280, fontFamily: C.mono, fontSize: 13, lineHeight: 1.65, background: '#0d1117', border: `1px solid ${C.bd2}`, borderRadius: 9, color: C.br, padding: 14, resize: 'vertical', width: '100%', tabSize: 4 }}
            onKeyDown={e => {
              if (e.key === 'Tab') { e.preventDefault(); const s = e.target.selectionStart; const v = code.substring(0, s) + '    ' + code.substring(s); setCode(v); setTimeout(() => e.target.setSelectionRange(s + 4, s + 4), 0); }
            }}
            spellCheck={false}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <button className="abtn" onClick={checkCode} style={{ flex: 1, padding: '10px' }}>▶ Code prüfen</button>
            <button className="btn" onClick={reset} style={{ padding: '10px 14px', fontSize: 12 }}>↺</button>
          </div>

          {/* Ergebnis */}
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

// ── Hauptseite Lernbereich ────────────────────────────────────
export default function LearnPage({ currentUser }) {
  const [view, setView]         = useState('home');
  const [quizQuestions, setQ]   = useState([]);
  const [quizScore, setScore]   = useState(null);
  const [quizTotal, setTotal]   = useState(null);
  const [selChallenge, setChall]= useState(null);
  const [catFilter, setCat]     = useState('Alle');
  const [diffFilter, setDiff]   = useState('Alle');

  const filteredQ = JAVA_QUIZ.filter(q =>
    (catFilter === 'Alle' || q.category === catFilter) &&
    (diffFilter === 'Alle' || q.difficulty === diffFilter)
  );

  const startQuiz = (questions) => {
    const shuffled = [...questions].sort(() => Math.random() - .5).slice(0, Math.min(10, questions.length));
    setQ(shuffled);
    setView('quiz');
  };

  // Quiz-Ergebnis speichern
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

      {/* ── Quiz-Bereich ── */}
      <section style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.br }}>Java Quiz</div>
          <div style={{ fontSize: 11, color: C.mu }}>{JAVA_QUIZ.length} Fragen insgesamt</div>
        </div>

        {/* Filter */}
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

        {/* Quick-Start Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 12, marginBottom: 14 }}>
          {[
            { l: 'Schnell-Quiz',     icon: '⚡', desc: '10 zufällige Fragen', q: JAVA_QUIZ },
            { l: 'Nur Grundlagen',   icon: '🟢', desc: 'Einstieg ins Thema',  q: JAVA_QUIZ.filter(q => q.category === 'Grundlagen') },
            { l: 'OOP Fokus',        icon: '🔷', desc: 'Klassen & Objekte',   q: JAVA_QUIZ.filter(q => q.category === 'OOP') },
            { l: 'Nur Schwere',      icon: '🔴', desc: 'Hard-Level Fragen',   q: JAVA_QUIZ.filter(q => q.difficulty === 'hard') },
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

      {/* ── Programmieraufgaben ── */}
      <section>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.br, marginBottom: 14 }}>Programmieraufgaben 💻</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px,1fr))', gap: 12 }}>
          {CODING_CHALLENGES.map(c => (
            <div key={c.id} className="card" style={{ cursor: 'pointer', transition: 'transform .15s, border-color .15s' }}
              onClick={() => { setChall(c); setView('coding'); }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = C.ac; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = C.bd; }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: C.br }}>{c.title}</div>
                <span className="tag" style={{ background: DIFF[c.difficulty]?.c + '20', color: DIFF[c.difficulty]?.c, border: `1px solid ${DIFF[c.difficulty]?.c}40`, flexShrink: 0 }}>
                  {DIFF[c.difficulty]?.l}
                </span>
              </div>
              <div style={{ fontSize: 12, color: C.mu, lineHeight: 1.6, marginBottom: 10 }}>{c.description.split('\n')[0]}</div>
              <div style={{ fontSize: 10, color: C.ac, fontFamily: C.mono }}>{c.category}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
