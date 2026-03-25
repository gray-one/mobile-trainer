import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../firebase";
import type { Workout } from "../types/workout";

type RunnerPhase = "exercise" | "rest" | "completed";

type StepPosition = {
  setIndex: number;
  round: number;
  exerciseIndex: number;
};

type RestState = {
  secondsLeft: number;
  totalSeconds: number;
  target: StepPosition;
  reason: "between-rounds" | "after-set";
};

function formatSeconds(value: number) {
  const mins = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const secs = (value % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

function getRoundsCount(workout: Workout, setIndex: number) {
  return Math.max(1, workout.sets[setIndex]?.rounds ?? 1);
}

function getTotalExerciseSteps(workout: Workout) {
  return workout.sets.reduce((sum, workoutSet) => {
    const rounds = Math.max(1, workoutSet.rounds ?? 1);
    return sum + rounds * workoutSet.exercises.length;
  }, 0);
}

function getNextExercisePosition(
  workout: Workout,
  current: StepPosition
): StepPosition | null {
  const currentSet = workout.sets[current.setIndex];
  if (!currentSet) return null;

  if (current.exerciseIndex + 1 < currentSet.exercises.length) {
    return {
      setIndex: current.setIndex,
      round: current.round,
      exerciseIndex: current.exerciseIndex + 1,
    };
  }

  const roundsCount = getRoundsCount(workout, current.setIndex);
  if (current.round < roundsCount) {
    return {
      setIndex: current.setIndex,
      round: current.round + 1,
      exerciseIndex: 0,
    };
  }

  if (current.setIndex + 1 < workout.sets.length) {
    return {
      setIndex: current.setIndex + 1,
      round: 1,
      exerciseIndex: 0,
    };
  }

  return null;
}

function getRestBeforeNext(
  workout: Workout,
  current: StepPosition,
  next: StepPosition | null
) {
  if (!next) return null;
  const currentSet = workout.sets[current.setIndex];
  if (!currentSet) return null;

  const lastExerciseInRound =
    current.exerciseIndex === currentSet.exercises.length - 1;
  const isNextRound =
    next.setIndex === current.setIndex && next.round === current.round + 1;
  const isNextSet = next.setIndex === current.setIndex + 1;

  if (
    lastExerciseInRound &&
    isNextRound &&
    currentSet.restBetweenRoundsSeconds > 0
  ) {
    return {
      seconds: currentSet.restBetweenRoundsSeconds,
      reason: "Przerwa między rundami",
    };
  }

  if (lastExerciseInRound && isNextSet && currentSet.restAfterSetSeconds > 0) {
    return {
      seconds: currentSet.restAfterSetSeconds,
      reason: "Przerwa po secie",
    };
  }

  return null;
}

export default function WorkoutRunnerPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [phase, setPhase] = useState<RunnerPhase>("exercise");
  const [currentPos, setCurrentPos] = useState<StepPosition>({
    setIndex: 0,
    round: 1,
    exerciseIndex: 0,
  });
  const [restState, setRestState] = useState<RestState | null>(null);
  const [completedExercises, setCompletedExercises] = useState(0);
  const [completionPersisted, setCompletionPersisted] = useState(false);
  const [completionPersistError, setCompletionPersistError] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!user || !id) {
      setError("Brak dostępu do treningu.");
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadWorkout = async () => {
      setLoading(true);
      setError(null);
      try {
        const ref = doc(db, "users", user.uid, "workouts", id);
        const snap = await getDoc(ref);

        if (!snap.exists()) {
          if (!cancelled) {
            setError("Nie znaleziono treningu.");
            setLoading(false);
          }
          return;
        }

        const data = snap.data() as Omit<Workout, "id">;
        const loadedWorkout: Workout = {
          id: snap.id,
          ...data,
        };

        if (
          !loadedWorkout.sets ||
          loadedWorkout.sets.length === 0 ||
          loadedWorkout.sets.every((item) => item.exercises.length === 0)
        ) {
          if (!cancelled) {
            setError("Ten trening nie zawiera ćwiczeń do wykonania.");
            setLoading(false);
          }
          return;
        }

        if (!cancelled) {
          setWorkout(loadedWorkout);
          setCurrentPos({ setIndex: 0, round: 1, exerciseIndex: 0 });
          setCompletedExercises(0);
          setRestState(null);
          setPhase("exercise");
          setCompletionPersisted(false);
          setCompletionPersistError(null);
          setLoading(false);
        }
      } catch (loadError: any) {
        if (!cancelled) {
          if (loadError?.code === "permission-denied") {
            setError("Brak uprawnień do odczytu treningu.");
          } else {
            setError(loadError?.message || "Nie udało się pobrać treningu.");
          }
          setLoading(false);
        }
      }
    };

    loadWorkout();

    return () => {
      cancelled = true;
    };
  }, [user, id]);

  useEffect(() => {
    if (phase !== "rest" || !restState) return;

    const interval = setInterval(() => {
      setRestState((prev) => {
        if (!prev) return prev;
        if (prev.secondsLeft <= 1) {
          return { ...prev, secondsLeft: 0 };
        }
        return { ...prev, secondsLeft: prev.secondsLeft - 1 };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [phase, restState]);

  useEffect(() => {
    if (phase !== "rest" || !restState || restState.secondsLeft > 0) return;
    setCurrentPos(restState.target);
    setRestState(null);
    setPhase("exercise");
  }, [phase, restState]);

  const totalExercises = useMemo(
    () => (workout ? getTotalExerciseSteps(workout) : 0),
    [workout]
  );

  const progress = useMemo(() => {
    if (!totalExercises) return 0;
    if (phase === "completed") return 100;
    return Math.round((completedExercises / totalExercises) * 100);
  }, [completedExercises, totalExercises, phase]);

  const currentSet = workout?.sets[currentPos.setIndex];
  const currentExercise = currentSet?.exercises[currentPos.exerciseIndex];
  const roundsCount = workout
    ? getRoundsCount(workout, currentPos.setIndex)
    : 1;
  const nextPosition =
    workout && phase === "exercise"
      ? getNextExercisePosition(workout, currentPos)
      : null;
  const nextSet = nextPosition ? workout?.sets[nextPosition.setIndex] : null;
  const nextExercise = nextSet?.exercises[nextPosition?.exerciseIndex ?? 0];
  const restBeforeNext =
    workout && phase === "exercise"
      ? getRestBeforeNext(workout, currentPos, nextPosition)
      : null;

  const restNextExercise =
    restState &&
    workout?.sets[restState.target.setIndex]?.exercises[
      restState.target.exerciseIndex
    ];

  const finishWorkout = () => {
    setPhase("completed");
    setRestState(null);
    setCompletedExercises(totalExercises);
  };

  useEffect(() => {
    if (phase !== "completed" || !workout || !user || completionPersisted) {
      return;
    }

    let cancelled = false;

    const persistCompletion = async () => {
      try {
        const ref = doc(db, "users", user.uid, "workouts", workout.id);
        await updateDoc(ref, {
          status: "completed",
          completedAt: serverTimestamp(),
        });
        if (!cancelled) {
          setCompletionPersisted(true);
          setCompletionPersistError(null);
        }
      } catch {
        if (!cancelled) {
          setCompletionPersistError(
            "Nie udało się zapisać statusu ukończenia treningu."
          );
        }
      }
    };

    void persistCompletion();

    return () => {
      cancelled = true;
    };
  }, [phase, workout, user, completionPersisted]);

  const handleDone = () => {
    if (!workout || !currentSet || !currentExercise) return;

    const next = getNextExercisePosition(workout, currentPos);
    setCompletedExercises((prev) => Math.min(prev + 1, totalExercises));

    if (!next) {
      finishWorkout();
      return;
    }

    const lastExerciseInRound =
      currentPos.exerciseIndex === currentSet.exercises.length - 1;
    const isNextRound =
      next.setIndex === currentPos.setIndex &&
      next.round === currentPos.round + 1;
    const isNextSet = next.setIndex === currentPos.setIndex + 1;

    if (
      lastExerciseInRound &&
      isNextRound &&
      currentSet.restBetweenRoundsSeconds > 0
    ) {
      setRestState({
        secondsLeft: currentSet.restBetweenRoundsSeconds,
        totalSeconds: currentSet.restBetweenRoundsSeconds,
        target: next,
        reason: "between-rounds",
      });
      setPhase("rest");
      return;
    }

    if (
      lastExerciseInRound &&
      isNextSet &&
      currentSet.restAfterSetSeconds > 0
    ) {
      setRestState({
        secondsLeft: currentSet.restAfterSetSeconds,
        totalSeconds: currentSet.restAfterSetSeconds,
        target: next,
        reason: "after-set",
      });
      setPhase("rest");
      return;
    }

    setCurrentPos(next);
    setPhase("exercise");
  };

  const skipRest = () => {
    if (!restState) return;
    setCurrentPos(restState.target);
    setRestState(null);
    setPhase("exercise");
  };

  return (
    <Box>
      <Navbar />
      <Box sx={{ p: 2, pb: 6 }}>
        {loading ? (
          <Stack alignItems="center" sx={{ mt: 6 }} spacing={2}>
            <CircularProgress />
            <Typography color="text.secondary">
              Ładowanie treningu...
            </Typography>
          </Stack>
        ) : error ? (
          <Stack spacing={2}>
            <Alert severity="error">{error}</Alert>
            <Button variant="contained" onClick={() => navigate("/")}>
              Wróć do listy
            </Button>
          </Stack>
        ) : !workout ? (
          <Alert severity="error">Brak danych treningu.</Alert>
        ) : phase === "completed" ? (
          <Paper sx={{ p: 3, textAlign: "center" }} elevation={2}>
            <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
              Trening ukończony! 🎉
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Wykonałeś {totalExercises} ćwiczeń w treningu „{workout.name}”.
            </Typography>
            {completionPersistError ? (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {completionPersistError}
              </Alert>
            ) : null}
            <Button variant="contained" onClick={() => navigate("/")}>
              Powrót do listy
            </Button>
          </Paper>
        ) : (
          <Stack
            spacing={2.5}
            sx={
              phase === "exercise"
                ? {
                    minHeight: {
                      xs: "calc(100dvh - 56px - 16px)",
                      sm: "calc(100dvh - 64px - 16px)",
                    },
                  }
                : undefined
            }
          >
            <Typography variant="h6" fontWeight={700}>
              {workout.name}
            </Typography>

            <Box>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 0.75 }}
              >
                Postęp: {completedExercises} / {totalExercises}
              </Typography>
              <LinearProgress variant="determinate" value={progress} />
            </Box>

            {phase === "exercise" && currentSet && currentExercise ? (
              <>
                <Paper
                  sx={{
                    p: 2.5,
                    position: "relative",
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                  }}
                  elevation={2}
                >
                  <IconButton
                    aria-label="Zakończ trening"
                    color="error"
                    onClick={finishWorkout}
                    size="small"
                    sx={{ position: "absolute", top: 8, right: 8 }}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                  <Typography variant="overline" color="text.secondary">
                    Set {currentPos.setIndex + 1}/{workout.sets.length} • Seria{" "}
                    {currentPos.round}/{roundsCount}
                  </Typography>
                  <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
                    {currentExercise.name}
                  </Typography>
                  <Typography color="text.secondary" sx={{ mb: 2 }}>
                    {currentExercise.description}
                  </Typography>

                  <Stack direction="row" spacing={1.5} sx={{ mb: 2.5 }}>
                    <Typography variant="body1">
                      <strong>Powtórzenia:</strong> {currentExercise.reps}
                    </Typography>
                    {currentExercise.equipment ? (
                      <Typography variant="body1">
                        <strong>Sprzęt:</strong> {currentExercise.equipment}
                      </Typography>
                    ) : null}
                  </Stack>

                  <Paper variant="outlined" sx={{ p: 1.5 }}>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 0.5 }}
                    >
                      Następne ćwiczenie
                    </Typography>
                    {nextPosition && nextExercise ? (
                      <>
                        <Typography fontWeight={700}>
                          {nextExercise.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Powtórzenia: {nextExercise.reps}
                        </Typography>
                        {nextExercise.equipment ? (
                          <Typography variant="body2" color="text.secondary">
                            Sprzęt: {nextExercise.equipment}
                          </Typography>
                        ) : null}
                        {restBeforeNext ? (
                          <Typography variant="body2" color="text.secondary">
                            Przed następnym krokiem: {restBeforeNext.reason} (
                            {restBeforeNext.seconds}s)
                          </Typography>
                        ) : null}
                      </>
                    ) : (
                      <Typography variant="body2" color="text.secondary">
                        To ostatnie ćwiczenie w treningu.
                      </Typography>
                    )}
                  </Paper>
                </Paper>

                <Box
                  sx={{
                    position: "sticky",
                    bottom: 8,
                    zIndex: 2,
                    mt: "auto",
                  }}
                >
                  <Button
                    variant="contained"
                    onClick={handleDone}
                    fullWidth
                    size="large"
                    sx={{ minHeight: 56 }}
                  >
                    Następne ćwiczenie
                  </Button>
                </Box>
              </>
            ) : phase === "rest" && restState ? (
              <Paper sx={{ p: 2.5, position: "relative" }} elevation={2}>
                <IconButton
                  aria-label="Zakończ trening"
                  color="error"
                  onClick={finishWorkout}
                  size="small"
                  sx={{ position: "absolute", top: 8, right: 8 }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
                <Typography variant="overline" color="text.secondary">
                  {restState.reason === "between-rounds"
                    ? "Przerwa między rundami"
                    : "Przerwa po secie"}
                </Typography>
                <Typography variant="h3" fontWeight={700} sx={{ my: 1 }}>
                  {formatSeconds(restState.secondsLeft)}
                </Typography>
                <Typography color="text.secondary" sx={{ mb: 2 }}>
                  Następne: {restNextExercise?.name ?? "kolejne ćwiczenie"} (set{" "}
                  {restState.target.setIndex + 1}, seria{" "}
                  {restState.target.round})
                </Typography>
                <Stack direction="row" spacing={1.5}>
                  <Button variant="contained" onClick={skipRest}>
                    Pomiń przerwę
                  </Button>
                </Stack>
              </Paper>
            ) : (
              <Alert severity="error">
                Nie udało się wyświetlić aktualnego kroku.
              </Alert>
            )}
          </Stack>
        )}
      </Box>
    </Box>
  );
}
