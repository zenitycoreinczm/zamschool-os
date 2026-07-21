"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type VoiceInputProps = {
  onTranscript: (text: string) => void;
  disabled?: boolean;
  className?: string;
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult:
    | ((event: {
        resultIndex: number;
        results: Array<{
          isFinal: boolean;
          [index: number]: { transcript: string };
        }>;
      }) => void)
    | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

function isSpeechSupported(): boolean {
  if (typeof window === "undefined") return false;
  return !!(
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition
  );
}

function buildRecognition(): SpeechRecognitionInstance | null {
  const Ctor =
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;
  if (!Ctor) return null;
  return new Ctor();
}

export function VoiceInput({ onTranscript, disabled, className }: VoiceInputProps) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const stopListeningRef = useRef<() => void>(() => {});
  const startListeningRef = useRef<() => void>(() => {});

  const onTranscriptRef = useRef(onTranscript);
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  });

  useEffect(() => {
    const rec = buildRecognition();
    if (!rec) return;

    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";

    let silenceTimer: ReturnType<typeof setTimeout> | null = null;

    rec.onresult = (event) => {
      let final = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interimText += transcript;
        }
      }
      setInterim(interimText);
      if (final) {
        onTranscriptRef.current(final + " ");
      }

      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        try { rec.stop(); } catch {}
        setListening(false);
        setInterim("");
      }, 3000);
    };

    rec.onerror = () => {
      setListening(false);
      setInterim("");
    };

    rec.onend = () => {
      setListening(false);
      setInterim("");
    };

    stopListeningRef.current = () => {
      try { rec.stop(); } catch {}
      setListening(false);
      setInterim("");
    };

    startListeningRef.current = () => {
      try { rec.start(); } catch {}
      setListening(true);
    };

    return () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      try { rec.abort(); } catch {}
    };
  }, []);

  const handleClick = useCallback(() => {
    if (listening) {
      stopListeningRef.current();
    } else {
      startListeningRef.current();
    }
  }, [listening]);

  if (!isSpeechSupported()) return null;

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        title={listening ? "Stop recording" : "Start voice input"}
        className={cn(
          "inline-flex items-center justify-center rounded-xl p-2 transition-all",
          listening
            ? "bg-red-500 text-white shadow-sm animate-pulse"
            : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        {listening ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </button>
      {listening && interim && (
        <span className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 whitespace-nowrap text-xs text-slate-400">
          {interim}
        </span>
      )}
    </div>
  );
}
