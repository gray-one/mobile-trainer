import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";
import type { Workout } from "../types/workout";

export default function useWorkouts() {
  const { user, loading: authLoading } = useAuth();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const lastUidRef = useRef<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (authLoading) return;

    const uid = user?.uid ?? null;

    if (!uid) {
      // cleanup any previous subscription
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
      lastUidRef.current = null;
      setWorkouts([]);
      setError(null);
      setLoading(false);
      return;
    }

    // if already subscribed to this uid, skip to avoid extra requests
    if (lastUidRef.current === uid && unsubRef.current) {
      return;
    }

    // clean previous subscription if exists
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }

    setLoading(true);
    setError(null);
    const col = collection(db, "users", uid, "workouts");
    const q = query(col, orderBy("scheduledAt", "desc"));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const items: Workout[] = snap.docs.map((d) => ({
          ...(d.data() as any),
          id: d.id,
        }));
        setWorkouts(items);
        setLoading(false);
      },
      (error) => {
        console.error("Workout subscription error:", error.code, error.message);
        if (error.code === "permission-denied") {
          setError(
            "Brak uprawnień do odczytu treningów. Sprawdź reguły Firestore."
          );
        } else {
          setError(error.message || "Błąd podczas pobierania treningów.");
        }
        setWorkouts([]);
        setLoading(false);
      }
    );

    unsubRef.current = unsub;
    lastUidRef.current = uid;

    return () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
      lastUidRef.current = null;
    };
  }, [user?.uid, authLoading]);

  return { workouts, loading, error };
}
