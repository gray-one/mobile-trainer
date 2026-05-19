import { useState, useMemo } from "react";
import {
  Box,
  Button,
  TextField,
  Typography,
  Container,
  Card,
  CardContent,
  IconButton,
  Snackbar,
  Alert,
  Paper,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import useWorkouts from "../hooks/useWorkouts";
import { db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import type { Workout, WorkoutSet, Exercise } from "../types/workout";
import SetForm from "../components/SetForm";
import Navbar from "../components/Navbar";

const NEW_WORKOUTS_STORAGE_KEY = "mobile-trainer:new-workout-ids";

type WorkoutCreatorStep = "general" | "sets";

interface ExerciseHistory extends Exercise {
  usageCount?: number;
}

export default function WorkoutCreatorPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { workouts: savedWorkouts } = useWorkouts();

  const [step, setStep] = useState<WorkoutCreatorStep>("general");

  // General info
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledAtDate, setScheduledAtDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [scheduledAtTime, setScheduledAtTime] = useState("10:00");

  // Sets & exercises
  const [sets, setSets] = useState<WorkoutSet[]>([]);
  const [openSetDialog, setOpenSetDialog] = useState(false);

  // Exercise history (for autofill)
  const [exerciseHistory, setExerciseHistory] = useState<ExerciseHistory[]>([]);

  const existingExercises = useMemo(() => {
    const map = new Map<string, Exercise>();

    const addExercise = (exercise: Exercise) => {
      const key = exercise.name.trim().toLowerCase();
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, {
          name: exercise.name.trim(),
          description: exercise.description || "",
          reps: exercise.reps ?? undefined,
          duration: exercise.duration ?? undefined,
          equipment: exercise.equipment || null,
        });
      }
    };

    // exercises from already saved workouts
    savedWorkouts.forEach((workout) => {
      workout.sets?.forEach((workoutSet) => {
        workoutSet.exercises?.forEach(addExercise);
      });
    });

    // add exercises created in the current session
    sets.forEach((workoutSet) => {
      workoutSet.exercises?.forEach(addExercise);
    });

    // also preserve any history entries
    exerciseHistory.forEach(addExercise);

    return Array.from(map.values());
  }, [savedWorkouts, sets, exerciseHistory]);

  // Snackbar
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error">(
    "success",
  );

  // Computed
  const totalExercises = useMemo(
    () => sets.reduce((acc, s) => acc + s.exercises.length, 0),
    [sets],
  );

  const handleGeneralNext = () => {
    if (!name.trim()) {
      setSnackbarMsg("Nazwa treningu jest wymagana");
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
      return;
    }
    setStep("sets");
  };

  const handleAddSet = (newSet: WorkoutSet) => {
    const setWithNumber: WorkoutSet = {
      ...newSet,
      setNumber: sets.length + 1,
    };
    setSets([...sets, setWithNumber]);
    setOpenSetDialog(false);
    setSnackbarMsg("Seria dodana pomyślnie");
    setSnackbarSeverity("success");
    setSnackbarOpen(true);
  };

  const handleDeleteSet = (index: number) => {
    setSets(sets.filter((_, i) => i !== index));
  };

  const handleUpdateSetExerciseHistory = (exercises: Exercise[]) => {
    // Add exercises to history
    exercises.forEach((ex) => {
      const existing = exerciseHistory.find((e) => e.name === ex.name);
      if (existing) {
        existing.usageCount = (existing.usageCount || 0) + 1;
      } else {
        setExerciseHistory([...exerciseHistory, { ...ex, usageCount: 1 }]);
      }
    });
  };

  const handleSaveWorkout = async () => {
    if (!user || !name.trim()) {
      setSnackbarMsg("Błąd: Brakuje danych");
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
      return;
    }

    if (sets.length === 0) {
      setSnackbarMsg("Dodaj co najmniej jedną serię");
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
      return;
    }

    // Validate sets
    for (const set of sets) {
      if (set.exercises.length === 0) {
        setSnackbarMsg(`Seria ${set.setNumber} nie ma żadnych ćwiczeń`);
        setSnackbarSeverity("error");
        setSnackbarOpen(true);
        return;
      }
    }

    try {
      const scheduledAt = `${scheduledAtDate}T${scheduledAtTime}:00Z`;

      const newWorkout: Omit<Workout, "id" | "createdAt"> = {
        name,
        description,
        scheduledAt,
        sets,
      };

      const workoutsRef = collection(db, "users", user.uid, "workouts");
      const docRef = await addDoc(workoutsRef, {
        ...newWorkout,
        createdAt: serverTimestamp(),
      });

      // Mark as new in session storage
      const newIds = JSON.parse(
        sessionStorage.getItem(NEW_WORKOUTS_STORAGE_KEY) || "[]",
      );
      newIds.push(docRef.id);
      sessionStorage.setItem(NEW_WORKOUTS_STORAGE_KEY, JSON.stringify(newIds));

      setSnackbarMsg("Trening został zapisany!");
      setSnackbarSeverity("success");
      setSnackbarOpen(true);

      setTimeout(() => navigate("/"), 1500);
    } catch (error) {
      console.error("Save workout error:", error);
      setSnackbarMsg("Błąd podczas zapisywania treningu");
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
    }
  };

  return (
    <Paper
      sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
    >
      <Navbar />
      <Container maxWidth="md" sx={{ flex: 1, py: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
          <IconButton
            onClick={() =>
              step === "sets" ? setStep("general") : navigate("/")
            }
            size="small"
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flex: 1 }}>
            {step === "general"
              ? "Dane ogólne treningu"
              : "Dodawanie serii i ćwiczeń"}
          </Typography>
        </Box>

        {/* GENERAL INFO STEP */}
        {step === "general" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField
              label="Nazwa treningu"
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="np. Full Body Workout"
            />
            <TextField
              label="Opis"
              fullWidth
              multiline
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Opcjonalnie: krótki opis treningu"
            />
            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField
                label="Data"
                type="date"
                value={scheduledAtDate}
                onChange={(e) => setScheduledAtDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ flex: 1 }}
              />
              <TextField
                label="Godzina"
                type="time"
                value={scheduledAtTime}
                onChange={(e) => setScheduledAtTime(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{ flex: 1 }}
              />
            </Box>
            <Button
              variant="contained"
              size="large"
              onClick={handleGeneralNext}
              sx={{ mt: 2 }}
            >
              Dalej
            </Button>
          </Box>
        )}

        {/* SETS STEP */}
        {step === "sets" && (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="body2" color="textSecondary">
                Liczba serii: {sets.length} | Liczba ćwiczeń: {totalExercises}
              </Typography>
            </Box>

            {/* Display existing sets */}
            {sets.map((set, idx) => (
              <Card key={idx}>
                <CardContent>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "start",
                      mb: 1,
                    }}
                  >
                    <Box>
                      <Typography variant="subtitle1">
                        Seria {set.setNumber} — {set.type}
                      </Typography>
                      <Typography variant="body2" color="textSecondary">
                        {set.rounds} rund(y), {set.exercises.length} ćwiczeń
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDeleteSet(idx)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Box>
                  <Box sx={{ pl: 2 }}>
                    {set.exercises.map((ex, exIdx) => (
                      <Typography key={exIdx} variant="caption" display="block">
                        {ex.name}
                        {ex.reps && ` (${ex.reps} powtórzeń)`}
                        {ex.equipment && ` — ${ex.equipment}`}
                      </Typography>
                    ))}
                  </Box>
                </CardContent>
              </Card>
            ))}

            {/* Add set button */}
            <Button
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => setOpenSetDialog(true)}
            >
              Dodaj nową serię
            </Button>

            {/* Save button */}
            <Button
              variant="contained"
              size="large"
              onClick={handleSaveWorkout}
              sx={{ mt: 3 }}
            >
              Zapisz trening
            </Button>
          </Box>
        )}
      </Container>

      {/* SET DIALOG */}
      <SetForm
        open={openSetDialog}
        onClose={() => setOpenSetDialog(false)}
        onSave={(newSet) => {
          handleAddSet(newSet);
          handleUpdateSetExerciseHistory(newSet.exercises);
        }}
        existingExercises={existingExercises}
      />

      {/* SNACKBAR */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
          sx={{ width: "100%" }}
        >
          {snackbarMsg}
        </Alert>
      </Snackbar>
    </Paper>
  );
}
