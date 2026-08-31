import React, { useState } from "react";
import { Mail, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";

const C = {
  bg: "#130D28",
  surface: "#211A42",
  line: "#352B5E",
  text: "#F5F2FC",
  muted: "#9A90C2",
  mutedSoft: "#6E6396",
  incomeA: "#7C5CFC",
  incomeB: "#4E8BFF",
};

export default function AuthScreen() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    setErrorMsg("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
    } else {
      setStatus("sent");
    }
  };

  return (
    <div
      className="w-full max-w-sm mx-auto min-h-screen flex flex-col items-center justify-center px-6"
      style={{ background: C.bg, fontFamily: "Inter, sans-serif" }}
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
        style={{ background: `linear-gradient(135deg, ${C.incomeA}, ${C.incomeB})` }}
      >
        <span className="text-2xl font-extrabold text-white" style={{ fontFamily: "Outfit, sans-serif" }}>
          DB
        </span>
      </div>
      <h1 className="text-xl font-bold mb-1" style={{ color: C.text, fontFamily: "Outfit, sans-serif" }}>
        DailyBudget
      </h1>
      <p className="text-sm text-center mb-8" style={{ color: C.mutedSoft }}>
        Connecte-toi pour synchroniser ton budget entre tes appareils.
      </p>

      {status === "sent" ? (
        <div
          className="w-full rounded-2xl p-4 text-center text-sm"
          style={{ background: C.surface, color: C.text, border: `1px solid ${C.line}` }}
        >
          Lien envoyé à <strong>{email}</strong>. Ouvre l'e-mail sur ce téléphone et appuie sur le lien pour te connecter.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="w-full">
          <div
            className="flex items-center gap-2 rounded-2xl px-4 py-3 mb-3"
            style={{ background: C.surface, border: `1px solid ${C.line}` }}
          >
            <Mail size={16} color={C.mutedSoft} />
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ton@email.com"
              className="flex-1 bg-transparent outline-none text-sm"
              style={{ color: C.text }}
              required
            />
          </div>
          {status === "error" && (
            <p className="text-xs mb-3" style={{ color: "#FF7A5C" }}>{errorMsg}</p>
          )}
          <button
            type="submit"
            disabled={status === "sending"}
            className="w-full py-3.5 rounded-2xl font-semibold text-white flex items-center justify-center gap-2"
            style={{
              background: `linear-gradient(135deg, ${C.incomeA}, ${C.incomeB})`,
              opacity: status === "sending" ? 0.7 : 1,
              fontFamily: "Outfit, sans-serif",
            }}
          >
            {status === "sending" && <Loader2 size={16} className="animate-spin" />}
            Recevoir le lien de connexion
          </button>
        </form>
      )}
    </div>
  );
}
