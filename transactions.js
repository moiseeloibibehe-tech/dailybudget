import { supabase } from "../lib/supabase";

export async function fetchTransactions() {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data.map((t) => ({
    id: t.id,
    type: t.type,
    category: t.category,
    amount: Number(t.amount),
    note: t.note || "",
    date: t.date,
  }));
}

export async function addTransaction(tx, userId) {
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      type: tx.type,
      category: tx.category,
      amount: tx.amount,
      note: tx.note,
      date: tx.date,
    })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    type: data.type,
    category: data.category,
    amount: Number(data.amount),
    note: data.note || "",
    date: data.date,
  };
}

export async function deleteTransaction(id) {
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) throw error;
}

export function subscribeToTransactions(userId, onChange) {
  const channel = supabase
    .channel("transactions-sync")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${userId}` },
      onChange
    )
    .subscribe();
  return () => supabase.removeChannel(channel);
}

export async function fetchMonthlyBudget(userId) {
  const { data, error } = await supabase
    .from("settings")
    .select("monthly_budget")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? Number(data.monthly_budget) : 300000;
}

export async function saveMonthlyBudget(userId, value) {
  const { error } = await supabase
    .from("settings")
    .upsert({ user_id: userId, monthly_budget: value, updated_at: new Date().toISOString() });
  if (error) throw error;
}
