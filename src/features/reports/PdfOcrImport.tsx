import { useState, useRef } from 'react';
import { C } from '../../lib/utils.js';
import { Modal } from '../../components/UI.jsx';

type ParsedReport = { activities: string; learnings: string };
type OcrResult = ParsedReport & { raw: string };

type ExistingFile = { name: string; size: number; type?: string; data: string };

type Step = 'idle' | 'scanning' | 'done' | 'error';
type Preview = 'parsed' | 'raw';

type PdfOcrImportProps = {
  existingFile?: ExistingFile | null;
  onImport: (result: OcrResult) => void;
  onClose: () => void;
};

// ── PDF-Seite → Canvas-ImageData ─────────────────────────────
async function renderPdfPage(pdfDoc: any, pageNum: number, scale = 2): Promise<HTMLCanvasElement> {
  const page     = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas   = document.createElement('canvas');
  canvas.width   = viewport.width;
  canvas.height  = viewport.height;
  const ctx      = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas;
}

// ── Erkenne Berichts-Abschnitte im OCR-Text ──────────────────
function parseOcrText(raw: string): ParsedReport {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const ACT   = /tätigkeiten|tätigkeitsbericht|betrieblich|durchgeführt|aufgaben|montag|dienstag|mittwoch|donnerstag|freitag/i;
  const LRN   = /lerninhalt|unterweisungen|berufsschule|unterricht|kenntnisse|erläuterungen|lernziel/i;

  let mode = 'act';
  const act: string[] = [], lrn: string[] = [];

  for (const line of lines) {
    if (ACT.test(line) && line.length < 70) { mode = 'act'; continue; }
    if (LRN.test(line) && line.length < 70) { mode = 'lrn'; continue; }
    (mode === 'act' ? act : lrn).push(line);
  }

  if (lrn.length === 0 && act.length > 8) {
    const mid = Math.ceil(act.length * 0.65);
    return { activities: act.slice(0, mid).join('\n'), learnings: act.slice(mid).join('\n') };
  }
  return { activities: act.join('\n'), learnings: lrn.join('\n') };
}

// ── Hauptkomponente ───────────────────────────────────────────
export function PdfOcrImport({ existingFile, onImport, onClose }: PdfOcrImportProps) {
  const [step,    setStep]    = useState<Step>('idle');   // idle | scanning | done | error
  const [msg,     setMsg]     = useState('');
  const [pct,     setPct]     = useState(0);
  const [result,  setResult]  = useState<OcrResult | null>(null);     // { activities, learnings, raw }
  const [preview, setPreview] = useState<Preview>('parsed'); // parsed | raw
  const fileRef = useRef<HTMLInputElement>(null);

  const runOcr = async (dataUrl: string) => {
    setStep('scanning'); setPct(5); setMsg('PDF wird geladen…');

    let pdfjs: any, Tesseract: any;
    try {
      [pdfjs, Tesseract] = await Promise.all([
        import('pdfjs-dist'),
        import('tesseract.js'),
      ]);
    } catch {
      setStep('error'); setMsg('Pakete konnten nicht geladen werden. Bitte Online-Verbindung prüfen.'); return;
    }

    // PDF.js Worker konfigurieren
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url,
    ).href;

    // PDF-Bytes aus Data-URL
    let pdfDoc: any;
    try {
      const b64   = dataUrl.split(',')[1];
      const bin   = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      pdfDoc = await pdfjs.getDocument({ data: bytes }).promise;
    } catch {
      setStep('error'); setMsg('PDF konnte nicht geöffnet werden. Ist die Datei lesbar?'); return;
    }

    const numPages = pdfDoc.numPages;
    let rawText = '';
    let worker: any;

    try {
      setMsg(`Sprachpaket wird geladen (Deutsch)…`); setPct(15);
      worker = await Tesseract.createWorker('deu', 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') {
            setPct(Math.round(15 + m.progress * 75));
          }
        },
      });

      for (let pg = 1; pg <= numPages; pg++) {
        setMsg(`Seite ${pg}/${numPages} wird gescannt…`);
        const canvas = await renderPdfPage(pdfDoc, pg, 2.5);
        const { data } = await worker.recognize(canvas);
        rawText += (rawText ? '\n\n' : '') + data.text;
      }
    } catch (err: any) {
      setStep('error'); setMsg(`OCR fehlgeschlagen: ${err.message}`); return;
    } finally {
      worker?.terminate?.();
    }

    setMsg('Text wird analysiert…'); setPct(95);
    const parsed = parseOcrText(rawText);
    setPct(100);
    setResult({ ...parsed, raw: rawText });
    setStep('done');
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.type?.includes('pdf')) { setStep('error'); setMsg('Nur PDF-Dateien werden unterstützt.'); return; }
    if (file.size > 15 * 1024 * 1024) { setStep('error'); setMsg('Datei zu groß (max. 15 MB).'); return; }
    const reader = new FileReader();
    reader.onload = (e) => runOcr((e.target as FileReader).result as string);
    reader.onerror = () => { setStep('error'); setMsg('Datei konnte nicht gelesen werden.'); };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0]);
  };

  return (
    <Modal title="OCR-Import — Berichtsheft einscannen" onClose={onClose} width={560}>
      {step === 'idle' && (
        <>
          <div style={{ fontSize: 12, color: C.mu, marginBottom: 16, lineHeight: 1.7 }}>
            Lade ein Foto oder einen Scan deines handschriftlichen Berichtshefts hoch.
            Der Text wird automatisch erkannt und als Vorschlag ins Formular eingefügt.
            <br />
            <span style={{ color: C.yw, fontWeight: 600 }}>Genauigkeit ca. 70–85 % bei Druckschrift, weniger bei Handschrift.</span>
          </div>

          {existingFile && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.mu, textTransform: 'uppercase', letterSpacing: .7, marginBottom: 6 }}>
                Bereits angehängte PDF
              </div>
              <button className="btn" onClick={() => runOcr(existingFile.data)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '10px 14px' }}>
                <span style={{ fontSize: 18 }}>📄</span>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.br }}>{existingFile.name}</div>
                  <div style={{ fontSize: 11, color: C.mu }}>{(existingFile.size / 1024).toFixed(0)} KB</div>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 11, color: C.ac, fontWeight: 700 }}>Scannen →</span>
              </button>
            </div>
          )}

          <div
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onClick={() => fileRef.current?.click()}
            style={{ border: `2px dashed ${C.bd2}`, borderRadius: 10, padding: '28px 20px', textAlign: 'center', cursor: 'pointer', transition: 'border-color .15s, background .15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.ac; e.currentTarget.style.background = C.acd; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.bd2; e.currentTarget.style.background = 'transparent'; }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.br }}>PDF hier ablegen oder klicken</div>
            <div style={{ fontSize: 11, color: C.mu, marginTop: 4 }}>Scan / Foto als PDF, max. 15 MB</div>
            <input ref={fileRef} type="file" accept="application/pdf" style={{ display: 'none' }} onChange={e => handleFile(e.target.files?.[0])} />
          </div>
        </>
      )}

      {step === 'scanning' && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 16, animation: 'spin 1.2s linear infinite', display: 'inline-block' }}>⚙️</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.br, marginBottom: 8 }}>{msg}</div>
          <div style={{ background: C.bd2, borderRadius: 99, height: 6, overflow: 'hidden', marginBottom: 6 }}>
            <div style={{ height: '100%', width: `${pct}%`, background: C.ac, borderRadius: 99, transition: 'width .3s' }} />
          </div>
          <div style={{ fontSize: 11, color: C.mu }}>{pct}%</div>
          {pct < 20 && (
            <div style={{ fontSize: 11, color: C.mu, marginTop: 10, lineHeight: 1.6 }}>
              Erstmaliger Download des Sprachpakets (~4 MB) — bitte kurz warten.
            </div>
          )}
        </div>
      )}

      {step === 'error' && (
        <div style={{ background: 'var(--c-crd)', border: `1px solid ${C.cr}`, borderRadius: 9, padding: '14px 16px', marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: C.cr, fontWeight: 700, marginBottom: 6 }}>✗ Fehler</div>
          <div style={{ fontSize: 12, color: C.tx }}>{msg}</div>
          <button className="btn" onClick={() => { setStep('idle'); setMsg(''); }} style={{ marginTop: 12 }}>← Zurück</button>
        </div>
      )}

      {step === 'done' && result && (
        <>
          <div style={{ background: 'var(--st-green-bg)', border: `1px solid color-mix(in srgb, ${C.gr} 25%, transparent)`, borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 12, color: C.gr, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
            ✓ OCR abgeschlossen — bitte den Vorschlag prüfen und ggf. korrigieren
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
            {(['parsed', 'raw'] as Preview[]).map(v => (
              <button key={v} onClick={() => setPreview(v)}
                style={{ padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  background: preview === v ? C.acd : C.sf2,
                  border: `1px solid ${preview === v ? C.ac : C.bd2}`,
                  color: preview === v ? C.ac : C.mu }}>
                {v === 'parsed' ? 'Erkannte Abschnitte' : 'Roher OCR-Text'}
              </button>
            ))}
          </div>

          {preview === 'parsed' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.mu, textTransform: 'uppercase', letterSpacing: .7, marginBottom: 4 }}>
                  Tätigkeiten (Vorschlag)
                </div>
                <textarea value={result.activities}
                  onChange={e => setResult(r => r && ({ ...r, activities: e.target.value }))}
                  style={{ minHeight: 100, fontFamily: C.sans, fontSize: 12, lineHeight: 1.65, resize: 'vertical' }} />
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.mu, textTransform: 'uppercase', letterSpacing: .7, marginBottom: 4 }}>
                  Lerninhalt (Vorschlag)
                </div>
                <textarea value={result.learnings}
                  onChange={e => setResult(r => r && ({ ...r, learnings: e.target.value }))}
                  style={{ minHeight: 80, fontFamily: C.sans, fontSize: 12, lineHeight: 1.65, resize: 'vertical' }} />
              </div>
            </div>
          ) : (
            <textarea readOnly value={result.raw}
              style={{ width: '100%', minHeight: 200, fontFamily: C.mono, fontSize: 11, lineHeight: 1.65, resize: 'vertical', marginBottom: 16, background: C.sf3 }} />
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="abtn" onClick={() => { onImport(result); onClose(); }} style={{ flex: 1, padding: 11 }}>
              ✓ Als Vorschlag ins Formular übernehmen
            </button>
            <button className="btn" onClick={() => { setStep('idle'); setResult(null); }} style={{ padding: '10px 14px' }}>
              ↺ Neu
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
