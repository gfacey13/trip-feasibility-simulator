import { useEffect, useRef, useState } from 'react';
import { supabase } from './supabaseClient';
import { createAccountTripStorage } from './accountTripStorage';

const accountTrips = createAccountTripStorage(supabase);

export function useSavedTrip(user) {
  const userId = user?.id ?? null;
  const [account, setAccount] = useState(null);
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);

  useEffect(() => {
    generation.current += 1;
    if (!userId) return;
    let active = true;
    accountTrips.loadAll(userId).then((trips) => {
      if (active) setAccount({ user, userId, trips, error: '' });
    }).catch(() => {
      if (active) setAccount({ user, userId, trips: [], error: 'Unable to load your saved trip. Please retry.' });
    });
    return () => { active = false; };
  }, [user, userId, retry]);

  // Never display another account's trip during a session change.
  const current = account?.user === user ? account : null;
  const loading = Boolean(userId && !current);

  async function checkAccount() {
    if (!supabase || !userId) throw new Error('Please log in to manage your saved trip.');
    if (loading || current?.error) throw new Error('Wait for your saved trip to load.');
    const started = generation.current;
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== userId || started !== generation.current) {
      throw new Error('Your account changed. Please try again.');
    }
    return started;
  }

  async function saveTrip(trip) {
    const started = await checkAccount();
    const saved = await accountTrips.save(userId, trip, trip.persistedId);
    if (started === generation.current) {
      setAccount((previous) => ({ user, userId, trips: [saved, ...previous.trips.filter((item) => item.persistedId !== saved.persistedId)], error: '' }));
      return saved;
    }
  }

  async function deleteTrip(persistedId = current?.trips[0]?.persistedId) {
    const started = await checkAccount();
    if (!current.trips.some((item) => item.persistedId === persistedId)) throw new Error('Saved trip not found.');
    await accountTrips.remove(userId, persistedId);
    if (started === generation.current) {
      setAccount((previous) => ({ user, userId, trips: previous.trips.filter((item) => item.persistedId !== persistedId), error: '' }));
    }
  }

  return {
    savedScenario: userId ? current?.trips[0] ?? null : null,
    savedTrips: userId ? current?.trips ?? [] : [],
    loading,
    error: current?.error ?? '',
    retryLoad: () => { setAccount(null); setRetry((value) => value + 1); },
    saveTrip,
    deleteTrip,
  };
}
