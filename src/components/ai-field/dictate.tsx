"use client";

// Textarea with a microphone: Web Speech API (SpeechRecognition / webkitSpeechRecognition, th-TH).
// Chrome/Edge (desktop + Android) and Safari 14.1+ have it; Firefox does not → typing only.

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { cx } from "@/components/ui";
import { areaCls, I, useHydrated } from "@/components/ops/bits";
import { appendTranscript, normalizeSpeech } from "@/lib/ai-field/speech";

type RecResult = { isFinal: boolean; 0: { transcript: string } };
type RecEvent = { resultIndex: number; results: ArrayLike<RecResult> };
type Rec = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: RecEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};
type RecCtor = new () => Rec;

const recCtor = (): RecCtor | undefined => {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecCtor; webkitSpeechRecognition?: RecCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};

const SPEECH_ERR: Record<string, string> = {
  "not-allowed": "เบราว์เซอร์ไม่อนุญาตให้ใช้ไมโครโฟน · เปิดสิทธิ์ไมโครโฟนของเว็บนี้ หรือพิมพ์แทน",
  "service-not-allowed": "เบราว์เซอร์นี้ไม่ให้ใช้การถอดเสียง · พิมพ์แทนได้",
  "no-speech": "ไม่ได้ยินเสียง ลองพูดใกล้ไมโครโฟนอีกครั้ง",
  "audio-capture": "ไม่พบไมโครโฟน",
  network: "การถอดเสียงต้องใช้อินเทอร์เน็ต (เบราว์เซอร์ส่งเสียงไปถอดความที่ผู้ให้บริการ)",
  "language-not-supported": "เบราว์เซอร์นี้ยังไม่รองรับการถอดเสียงภาษาไทย · พิมพ์แทนได้",
};

export function DictateBox({ value, onChange, placeholder, phone, rows = 4, label }: { value: string; onChange: (v: string) => void; placeholder?: string; phone?: boolean; rows?: number; label: string }) {
  const hydrated = useHydrated();
  const supported = hydrated && !!recCtor();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [err, setErr] = useState("");
  const rec = useRef<Rec | null>(null);
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  useEffect(() => () => rec.current?.abort(), []);

  const start = () => {
    const C = recCtor();
    if (!C) return;
    setErr("");
    const r = new C();
    r.lang = "th-TH";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) {
          const next = appendTranscript(valueRef.current, res[0].transcript);
          valueRef.current = next;
          onChange(next);
        } else live += res[0].transcript;
      }
      setInterim(normalizeSpeech(live));
    };
    r.onerror = (e) => setErr(SPEECH_ERR[e.error] ?? (e.error === "aborted" ? "" : `ถอดเสียงไม่ได้ (${e.error})`));
    r.onend = () => {
      setListening(false);
      setInterim("");
      rec.current = null;
    };
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setErr("เริ่มถอดเสียงไม่ได้ ลองอีกครั้ง");
    }
  };
  const stop = () => rec.current?.stop();

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <textarea
          aria-label={label}
          value={value}
          rows={rows}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cx(
            phone ? "min-h-[120px] w-full rounded-[12px] border border-line-strong bg-card px-3 py-2.5 text-[16px] text-ink outline-none placeholder:text-ink-3 focus:border-ink-3" : cx(areaCls, "w-full"),
            supported && (phone ? "pr-16" : "pr-12"),
          )}
        />
        {supported && (
          <button
            type="button"
            onClick={listening ? stop : start}
            aria-pressed={listening}
            aria-label={listening ? "หยุดฟัง" : "พูดแทนการพิมพ์"}
            title={listening ? "หยุดฟัง" : "พูดแทนการพิมพ์ (ภาษาไทย)"}
            className={cx(
              "absolute right-2 top-2 inline-flex items-center justify-center rounded-full border transition-colors duration-150",
              phone ? "size-12" : "size-8",
              listening ? "border-neg bg-neg-soft text-neg" : "border-line-strong bg-card text-ink-2 hover:bg-raised",
            )}
          >
            {listening ? <Square {...I} /> : <Mic size={phone ? 20 : 16} strokeWidth={1.5} />}
          </button>
        )}
      </div>
      {listening && (
        <p className={cx("flex items-center gap-2 text-ink-2", phone ? "text-[14px]" : "text-[12px]")}>
          <span aria-hidden className="size-2 animate-pulse rounded-full bg-neg" />
          กำลังฟัง… {interim && <span className="min-w-0 flex-1 truncate text-ink-3">{interim}</span>}
        </p>
      )}
      {err && <p className={cx("text-warn", phone ? "text-[14px]" : "text-[12px]")}>{err}</p>}
      {hydrated && !supported && <p className={cx("text-ink-3", phone ? "text-[13px]" : "text-[12px]")}>เบราว์เซอร์นี้ไม่รองรับการพูดแทนพิมพ์ · พิมพ์ หรือใช้ปุ่มไมโครโฟนบนคีย์บอร์ดมือถือ</p>}
    </div>
  );
}
