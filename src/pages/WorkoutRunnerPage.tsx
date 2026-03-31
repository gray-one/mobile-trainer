import { useEffect, useMemo, useState, useCallback } from "react";
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
import RepeatIcon from "@mui/icons-material/Repeat";
import BuildIcon from "@mui/icons-material/Build";
import TimerDisplay from "../components/TimerDisplay";
import SkipNextIcon from "@mui/icons-material/SkipNext";
import BarChartIcon from "@mui/icons-material/BarChart";
import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import { playBeep } from "../utils/audio";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../firebase";
import type { Workout } from "../types/workout";

type RunnerPhase = "preview" | "exercise" | "rest" | "completed";

type StepPosition = {
  setIndex: number;
  round: number;
  exerciseIndex: number;
};

type RestReason = "between-rounds" | "after-set";

type RestState = {
  secondsLeft: number;
  totalSeconds: number;
  target: StepPosition;
  reason: RestReason;
};

type RestInfo = {
  seconds: number;
  reason: RestReason;
  label: string;
};

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
  current: StepPosition,
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
  next: StepPosition | null,
): RestInfo | null {
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
      reason: "between-rounds",
      label: "Przerwa między rundami",
    };
  }

  if (lastExerciseInRound && isNextSet && currentSet.restAfterSetSeconds > 0) {
    return {
      seconds: currentSet.restAfterSetSeconds,
      reason: "after-set",
      label: "Przerwa po secie",
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

  const [phase, setPhase] = useState<RunnerPhase>("preview");
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
          setPhase("preview");
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

  const currentExerciseDuration =
    currentExercise?.duration ?? currentExercise?.durationSeconds ?? null;

  useEffect(() => {
    if (phase !== "rest" || !restState || restState.secondsLeft > 0) return;
    playBeep(660, 0.2);
    setCurrentPos(restState.target);
    setRestState(null);
    setPhase("exercise");
  }, [phase, restState]);

  const restNextExercise =
    restState &&
    workout?.sets[restState.target.setIndex]?.exercises[
      restState.target.exerciseIndex
    ];

  const totalExercises = useMemo(
    () => (workout ? getTotalExerciseSteps(workout) : 0),
    [workout],
  );

  const progress = useMemo(() => {
    if (!totalExercises) return 0;
    if (phase === "completed") return 100;
    return Math.round((completedExercises / totalExercises) * 100);
  }, [completedExercises, totalExercises, phase]);

  const finishWorkout = useCallback(() => {
    setPhase("completed");
    setRestState(null);
    setCompletedExercises(totalExercises);
  }, [totalExercises]);

  const cancelWorkout = () => {
    setRestState(null);
    // nie ustawiamy completed, aby status w Firestore pozostał bez zmian
    navigate("/");
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
            "Nie udało się zapisać statusu ukończenia treningu.",
          );
        }
      }
    };

    void persistCompletion();

    return () => {
      cancelled = true;
    };
  }, [phase, workout, user, completionPersisted]);

  const handleDone = useCallback(() => {
    if (!workout || !currentSet || !currentExercise) return;

    const next = getNextExercisePosition(workout, currentPos);
    setCompletedExercises((prev) => Math.min(prev + 1, totalExercises));

    if (!next) {
      finishWorkout();
      return;
    }

    const restInfo = getRestBeforeNext(workout, currentPos, next);

    if (restInfo) {
      setRestState({
        secondsLeft: restInfo.seconds,
        totalSeconds: restInfo.seconds,
        target: next,
        reason: restInfo.reason,
      });
      setPhase("rest");
      return;
    }

    setCurrentPos(next);
    setPhase("exercise");
  }, [
    workout,
    currentSet,
    currentExercise,
    currentPos,
    totalExercises,
    finishWorkout,
  ]);

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
        ) : phase === "preview" ? (
          <Paper sx={{ p: 3 }} elevation={2}>
            <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
              Podgląd treningu
            </Typography>
            <Typography variant="h6" sx={{ mb: 1 }}>
              {workout.name}
            </Typography>
            <Typography sx={{ mb: 1 }}>{workout.description}</Typography>
            <Typography color="text.secondary" sx={{ mb: 2 }}>
              Zaplanowane:{" "}
              {new Date(workout.scheduledAt).toLocaleString("pl-PL")}
            </Typography>

            {workout.sets.map((set, setIndex) => (
              <Paper key={setIndex} variant="outlined" sx={{ p: 2, mb: 1 }}>
                <Typography
                  variant="subtitle2"
                  fontWeight={700}
                  sx={{ mb: 0.5 }}
                >
                  Set {set.setNumber} • {set.type} • powórzenia: {set.rounds}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ mb: 0.5 }}
                >
                  Przerwa między rundami: {set.restBetweenRoundsSeconds}s, po
                  secie: {set.restAfterSetSeconds}s
                </Typography>
                <Box sx={{ pl: 2 }}>
                  {set.exercises.map((exercise, exerciseIndex) => (
                    <Box key={exerciseIndex} sx={{ mb: 0.5 }}>
                      <Typography sx={{ fontWeight: 600 }}>
                        {exercise.name}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ mb: 0.25 }}
                      >
                        {(exercise.duration ?? exercise.durationSeconds) ? (
                          <>
                            Czas:{" "}
                            {exercise.duration ?? exercise.durationSeconds}s
                          </>
                        ) : exercise.reps != null ? (
                          <>Powtórzenia: {exercise.reps}</>
                        ) : (
                          <>Brak powtórzeń ani czasu</>
                        )}
                        {exercise.equipment
                          ? ` • sprzęt: ${exercise.equipment}`
                          : ""}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{ opacity: 0.6 }}
                      >
                        {exercise.description}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </Paper>
            ))}

            <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
              <Button variant="contained" onClick={() => setPhase("exercise")}>
                Rozpocznij
              </Button>
              <Button variant="outlined" onClick={() => navigate("/")}>
                Powrót
              </Button>
            </Stack>
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
                sx={{
                  mb: 0.75,
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                }}
              >
                <BarChartIcon fontSize="inherit" />
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
                    aria-label="Anuluj trening"
                    color="error"
                    onClick={cancelWorkout}
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

                  {currentExerciseDuration != null ? (
                    <TimerDisplay
                      key={`${currentPos.setIndex}-${currentPos.round}-${currentPos.exerciseIndex}`}
                      seconds={currentExerciseDuration}
                      onFinish={() => {
                        playBeep(880, 0.2);
                        handleDone();
                      }}
                    />
                  ) : null}

                  <Stack
                    direction="row"
                    spacing={2}
                    sx={{ mb: 2.5, flexWrap: "wrap" }}
                  >
                    <Box
                      sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                    >
                      <RepeatIcon fontSize="small" color="primary" />
                      <Typography variant="body1">
                        {(currentExercise.duration ??
                        currentExercise.durationSeconds) ? (
                          <>
                            <strong>Czas:</strong>{" "}
                            {currentExercise.duration ??
                              currentExercise.durationSeconds}
                            s
                          </>
                        ) : currentExercise.reps != null ? (
                          <>
                            <strong>Powtórzenia:</strong> {currentExercise.reps}
                          </>
                        ) : (
                          <>Brak danych (powtórzenia/czas)</>
                        )}
                      </Typography>
                    </Box>
                    {currentExercise.equipment ? (
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                      >
                        <BuildIcon fontSize="small" color="action" />
                        <Typography variant="body1">
                          <strong>Sprzęt:</strong> {currentExercise.equipment}
                        </Typography>
                      </Box>
                    ) : null}
                  </Stack>

                  <Paper variant="outlined" sx={{ p: 1.5 }}>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        mb: 0.5,
                      }}
                    >
                      <SkipNextIcon fontSize="small" color="action" />
                      <Typography variant="body2" color="text.secondary">
                        Następne ćwiczenie
                      </Typography>
                    </Box>
                    {nextPosition && nextExercise ? (
                      <>
                        <Typography fontWeight={700}>
                          {nextExercise.name}
                        </Typography>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                          }}
                        >
                          <RepeatIcon sx={{ fontSize: 13 }} color="action" />
                          <Typography variant="body2" color="text.secondary">
                            {(nextExercise.duration ??
                            nextExercise.durationSeconds) ? (
                              <>
                                Czas:{" "}
                                {nextExercise.duration ??
                                  nextExercise.durationSeconds}
                                s
                              </>
                            ) : nextExercise.reps != null ? (
                              <>Powtórzenia: {nextExercise.reps}</>
                            ) : (
                              <>Brak danych powt./czas</>
                            )}
                          </Typography>
                        </Box>
                        {nextExercise.equipment ? (
                          <Typography variant="body2" color="text.secondary">
                            Sprzęt: {nextExercise.equipment}
                          </Typography>
                        ) : null}
                        {restBeforeNext ? (
                          <Typography variant="body2" color="text.secondary">
                            Przed następnym krokiem: {restBeforeNext.label} (
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
                  aria-label="Anuluj trening"
                  color="error"
                  onClick={cancelWorkout}
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
                <TimerDisplay
                  key={`rest-${restState.target.setIndex}-${restState.target.round}-${restState.target.exerciseIndex}`}
                  seconds={restState.secondsLeft}
                  size={40}
                  onFinish={() => {
                    playBeep(660, 0.2);
                    setCurrentPos(restState.target);
                    setRestState(null);
                    setPhase("exercise");
                  }}
                />
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    mb: 2,
                  }}
                >
                  <SkipNextIcon fontSize="small" color="action" />
                  <Typography color="text.secondary">
                    Następne: {restNextExercise?.name ?? "kolejne ćwiczenie"}{" "}
                    (set {restState.target.setIndex + 1}, seria{" "}
                    {restState.target.round})
                  </Typography>
                </Box>
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
