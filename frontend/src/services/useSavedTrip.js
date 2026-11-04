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
    accountTrips.load(userId).then((trip) => {
      if (active) setAccount({ user, userId, trip, error: '' });
    }).catch(() => {
      if (active) setAccount({ user, userId, trip: null, error: 'Unable to load your saved trip. Please retry.' });
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
    const saved = await accountTrips.save(userId, trip, current?.trip?.persistedId);
    if (started === generation.current) {
      setAccount({ user, userId, trip: saved, error: '' });
    }
  }

  async function deleteTrip() {
    const started = await checkAccount();
    await accountTrips.remove(userId, current?.trip?.persistedId);
    if (started === generation.current) {
      setAccount({ user, userId, trip: null, error: '' });
    }
  }

  return {
    savedScenario: userId ? current?.trip ?? null : null,
    loading,
    error: current?.error ?? '',
    retryLoad: () => { setAccount(null); setRetry((value) => value + 1); },
    saveTrip,
    deleteTrip,
  };
}
