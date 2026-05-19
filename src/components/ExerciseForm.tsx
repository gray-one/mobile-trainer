import { useState } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Autocomplete,
  Typography,
  Paper,
} from "@mui/material";
import type { Exercise } from "../types/workout";

interface ExerciseFormProps {
  open: boolean;
  onClose: () => void;
  onSave: (exercise: Exercise) => void;
  existingExercises?: Exercise[];
}

export default function ExerciseForm({
  open,
  onClose,
  onSave,
  existingExercises = [],
}: ExerciseFormProps) {
  const [selectedExisting, setSelectedExisting] = useState<Exercise | null>(
    null,
  );
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [reps, setReps] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [equipment, setEquipment] = useState("");

  const handleSelectExisting = (selected: Exercise | null) => {
    setSelectedExisting(selected);
    if (selected) {
      setName(selected.name);
      setDescription(selected.description || "");
      setReps(selected.reps || null);
      setDuration(selected.duration || null);
      setEquipment(selected.equipment || "");
    }
  };

  const handleNameChange = (value: string) => {
    setName(value);
    // Auto-fill if matching existing
    const match = existingExercises.find((e) => e.name === value);
    if (match) {
      setDescription(match.description || "");
      setReps(match.reps || null);
      setDuration(match.duration || null);
      setEquipment(match.equipment || "");
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      alert("Nazwa ćwiczenia jest wymagana");
      return;
    }

    const exercise: Exercise = {
      name: name.trim(),
      description: description.trim() || "",
      reps: reps,
      duration: duration,
      equipment: equipment.trim() || null,
    };

    onSave(exercise);

    // Reset form
    setSelectedExisting(null);
    setName("");
    setDescription("");
    setReps(null);
    setDuration(null);
    setEquipment("");
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Nowe ćwiczenie</DialogTitle>
      <DialogContent
        sx={{ display: "flex", flexDirection: "column", gap: 2, py: 2 }}
      >
        <Autocomplete
          sx={{ pt: 2 }}
          PaperComponent={(props) => <Paper {...props} sx={{ bgcolor: "#fff" }} />}
          options={existingExercises}
          getOptionLabel={(option) => {
            if (typeof option === "string") return option;
            return option.name;
          }}
          value={selectedExisting}
          onChange={(_, value) => {
            if (typeof value === "object" && value !== null) {
              handleSelectExisting(value);
            }
          }}
          inputValue={name}
          onInputChange={(_, value: string) => handleNameChange(value)}
          freeSolo
          renderInput={(params) => (
            <TextField
              {...params}
              label="Nazwa ćwiczenia"
              placeholder="Wybierz z listy lub wpisz nową..."
              helperText={
                selectedExisting
                  ? "Pola poniżej są autouzupełnione z historii"
                  : "Nowe ćwiczenie"
              }
            />
          )}
        />

        <TextField
          label="Opis"
          fullWidth
          multiline
          rows={2}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="np. Klasyczne pompki do klatki"
        />

        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField
            label="Powtórzenia"
            type="number"
            inputProps={{ min: 0 }}
            value={reps ?? ""}
            onChange={(e) =>
              setReps(e.target.value ? parseInt(e.target.value) : null)
            }
            sx={{ flex: 1 }}
          />
          <TextField
            label="Czas trwania (s)"
            type="number"
            inputProps={{ min: 0 }}
            value={duration ?? ""}
            onChange={(e) =>
              setDuration(e.target.value ? parseInt(e.target.value) : null)
            }
            sx={{ flex: 1 }}
          />
        </Box>

        <TextField
          label="Sprzęt"
          fullWidth
          value={equipment}
          onChange={(e) => setEquipment(e.target.value)}
          placeholder="np. kettlebell 20kg, drążek"
        />

        <Box sx={{ p: 1, backgroundColor: "#f5f5f5", borderRadius: 1 }}>
          <Typography variant="caption" color="textSecondary">
            Podpowiedź: Jeśli wybierzesz ćwiczenie z listy, parametry będą
            autouzupełnione. Możesz je zmienić.
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Anuluj</Button>
        <Button onClick={handleSave} variant="contained">
          Dodaj ćwiczenie
        </Button>
      </DialogActions>
    </Dialog>
  );
}
