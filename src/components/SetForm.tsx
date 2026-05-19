import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Card,
  CardContent,
  IconButton,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import type { WorkoutSet, Exercise } from "../types/workout";
import ExerciseForm from "./ExerciseForm";

interface SetFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (set: WorkoutSet) => void;
  existingExercises?: Exercise[];
}

export default function SetForm({
  open,
  onClose,
  onSave,
  existingExercises = [],
}: SetFormProps) {
  const [rounds, setRounds] = useState(3);
  const [restBetweenRounds, setRestBetweenRounds] = useState(90);
  const [restAfterSet, setRestAfterSet] = useState(180);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [openExerciseForm, setOpenExerciseForm] = useState(false);

  const handleAddExercise = (exercise: Exercise) => {
    setExercises([...exercises, exercise]);
    setOpenExerciseForm(false);
  };

  const handleDeleteExercise = (index: number) => {
    setExercises(exercises.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (exercises.length === 0) {
      alert("Dodaj co najmniej jedno ćwiczenie do serii");
      return;
    }

    const newSet: WorkoutSet = {
      setNumber: 0, // Will be set by parent
      rounds,
      restBetweenRoundsSeconds: restBetweenRounds,
      restAfterSetSeconds: restAfterSet,
      exercises,
    };

    onSave(newSet);

    // Reset
    setRounds(3);
    setRestBetweenRounds(90);
    setRestAfterSet(180);
    setExercises([]);
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
        <DialogTitle>Nowa seria (set)</DialogTitle>
        <DialogContent
          sx={{ display: "flex", flexDirection: "column", gap: 2, py: 2 }}
        >
          <TextField
            label="Liczba rund"
            type="number"
            sx={{ mt: 2 }}
            inputProps={{ min: 1 }}
            value={rounds}
            onChange={(e) =>
              setRounds(Math.max(1, parseInt(e.target.value) || 1))
            }
          />

          <TextField
            label="Przerwa między rundami (sekundy)"
            type="number"
            inputProps={{ min: 0 }}
            value={restBetweenRounds}
            onChange={(e) =>
              setRestBetweenRounds(Math.max(0, parseInt(e.target.value) || 0))
            }
          />

          <TextField
            label="Przerwa po serii (sekundy)"
            type="number"
            inputProps={{ min: 0 }}
            value={restAfterSet}
            onChange={(e) =>
              setRestAfterSet(Math.max(0, parseInt(e.target.value) || 0))
            }
          />

          <Box sx={{ borderTop: "1px solid #ccc", pt: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Ćwiczenia ({exercises.length})
            </Typography>

            {exercises.map((ex, idx) => (
              <Card key={idx} sx={{ mb: 1 }}>
                <CardContent sx={{ py: 1, px: 2, "&:last-child": { pb: 1 } }}>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "start",
                    }}
                  >
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {ex.name}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        {ex.description && ex.description}
                        {ex.reps && ` | ${ex.reps} powtórzeń`}
                        {ex.equipment && ` | ${ex.equipment}`}
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDeleteExercise(idx)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </CardContent>
              </Card>
            ))}

            <Button
              variant="outlined"
              size="small"
              startIcon={<AddIcon />}
              onClick={() => setOpenExerciseForm(true)}
              fullWidth
            >
              Dodaj ćwiczenie
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Anuluj</Button>
          <Button onClick={handleSave} variant="contained">
            Dodaj serię
          </Button>
        </DialogActions>
      </Dialog>

      {/* Exercise Form Dialog */}
      <ExerciseForm
        open={openExerciseForm}
        onClose={() => setOpenExerciseForm(false)}
        onSave={handleAddExercise}
        existingExercises={existingExercises}
      />
    </>
  );
}
