const SUPABASE_URL = "https://xixntriycpcpargxhwpf.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_f1T0xsSRTQboae6F68gd9g_IGJtp5jn";

window.Leaderboard = (() => {
  "use strict";

  function configured(){
    return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
  }

  async function fetchGlobal(){
    if (!configured()) return { ok:false, reason:"not-configured" };
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/global_stats?id=eq.1&select=total_punches,best_combo`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      if (!res.ok) return { ok:false, reason:"http-" + res.status };
      const rows = await res.json();
      if (!rows.length) return { ok:false, reason:"no-row" };
      return { ok:true, total: rows[0].total_punches, best: rows[0].best_combo };
    } catch (e) {
      return { ok:false, reason:"network" };
    }
  }

  async function reportProgress(addPunches, combo){
    if (!configured()) return { ok:false, reason:"not-configured" };
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/add_punch_stats`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ add_punches: addPunches|0, new_combo: combo|0 })
      });
      if (!res.ok) return { ok:false, reason:"http-" + res.status };
      return { ok:true };
    } catch (e) {
      return { ok:false, reason:"network" };
    }
  }

  function kstDateStr(offsetDays){
    const now = new Date(Date.now() + (offsetDays||0)*86400000);
    return new Intl.DateTimeFormat("en-CA", { timeZone:"Asia/Seoul" }).format(now);
  }

  async function fetchChallengeTop(limit, dateStr){
    limit = limit || 10;
    if (!configured()) return { ok:false, reason:"not-configured" };
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/challenge_scores?select=name,punches&play_date=eq.${dateStr}&order=punches.desc&limit=${limit}`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      if (!res.ok) return { ok:false, reason:"http-" + res.status };
      const rows = await res.json();
      return { ok:true, rows };
    } catch (e) {
      return { ok:false, reason:"network" };
    }
  }

  async function submitChallengeScore(name, punches){
    if (!configured()) return { ok:false, reason:"not-configured" };
    const cleanName = String(name || "").trim().slice(0, 12) || "Anonymous";
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/submit_challenge_score`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ p_name: cleanName, p_punches: punches|0 })
      });
      if (!res.ok) return { ok:false, reason:"http-" + res.status };
      return { ok:true };
    } catch (e) {
      return { ok:false, reason:"network" };
    }
  }

  async function renameChallengeScore(oldName, newName){
    if (!configured()) return { ok:false, reason:"not-configured" };
    const cleanOld = String(oldName || "").trim().slice(0, 12);
    const cleanNew = String(newName || "").trim().slice(0, 12);
    if (!cleanOld || !cleanNew) return { ok:false, reason:"invalid-name" };
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/rename_challenge_score`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ p_old_name: cleanOld, p_new_name: cleanNew })
      });
      if (!res.ok) return { ok:false, reason:"http-" + res.status };
      return { ok:true };
    } catch (e) {
      return { ok:false, reason:"network" };
    }
  }

  return { configured, fetchGlobal, reportProgress, fetchChallengeTop, submitChallengeScore, renameChallengeScore, kstDateStr };
})();
