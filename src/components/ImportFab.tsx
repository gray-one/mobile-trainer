import React, { useRef, useState } from "react";
import {
  Fab,
  Box,
  Stack,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
} from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import type { WorkoutPlan } from "../types/workout";

const NEW_WORKOUTS_STORAGE_KEY = "mobile-trainer:new-workout-ids";

const TEMPLATE_JSON = `{
    "workouts": [
      {
        "name": "Full Body Beginner",
        "description": "Prosty trening całego ciała",
        "scheduledAt": "2026-03-26T18:00:00Z",
        "sets": [
          {
            "setNumber": 1,
            "type": "circuit",
            "rounds": 3,

            "restBetweenRoundsSeconds": 90,
            "restAfterSetSeconds": 180,

            "exercises": [
              {
                "name": "Pompki",
                "description": "Klasyczne pompki",
                "reps": 12,
                "equipment": null
              },
              {
                "name": "Podciąganie",
                "description": "Nachwytem",
                "reps": 6,
                "equipment": "drążek"
              }
            ]
          }
        ]
      },
      {
        "name": "Lower Body",
        "description": "Trening nóg",

        "scheduledAt": "2026-03-28T17:00:00Z",

        "sets": [
          {
            "setNumber": 1,
            "type": "standard",
            "rounds": 4,

            "restBetweenRoundsSeconds": 120,
            "restAfterSetSeconds": 180,

            "exercises": [
              {
                "name": "Przysiady",
                "description": "Z kettlebell",
                "reps": 10,
                "equipment": "kettlebell 20kg"
              }
            ]
          }
        ]
      }
    ]
}`;

function saveImportedWorkoutIds(ids: string[]) {
  if (!ids.length) return;

  try {
    const raw = sessionStorage.getItem(NEW_WORKOUTS_STORAGE_KEY);
    const existing = raw ? (JSON.parse(raw) as string[]) : [];
    const merged = Array.from(new Set([...(existing || []), ...ids]));
    sessionStorage.setItem(NEW_WORKOUTS_STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // no-op: local UI hint should not break import flow
  }
}

export default function ImportFab() {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");

  const onChoose = () => inputRef.current?.click();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [pasteValue, setPasteValue] = useState("");

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_JSON], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = "template.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
  };

  const copyTemplate = async () => {
    try {
      await navigator.clipboard.writeText(TEMPLATE_JSON);
      setMsg("Zawartość szablonu skopiowana do schowka");
      setOpen(true);
    } catch {
      setMsg("Nie udało się skopiować do schowka");
      setOpen(true);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    try {
      const txt = await f.text();
      const parsed = JSON.parse(txt) as WorkoutPlan;
      // validate structure
      const validationErrors = validateWorkoutPlan(parsed);
      if (validationErrors.length) {
        throw new Error(
          `Nieprawidłowy format pliku. Błędy walidacji:\n${validationErrors.join(
            "\n",
          )}`,
        );
      }
      if (!user) throw new Error("Nie jesteś zalogowany");

      const workouts = parsed.workouts ?? parsed.plan?.workouts;
      if (!workouts || !Array.isArray(workouts)) {
        throw new Error("Nieprawidłowy format pliku. Brak workouts.");
      }

      const uid = user.uid;
      const colRef = collection(db, "users", uid, "workouts");
      const batchPromises = workouts.map((workout) =>
        addDoc(colRef, { ...workout, createdAt: serverTimestamp() }),
      );

      const refs = await Promise.all(batchPromises);
      saveImportedWorkoutIds(refs.map((ref) => ref.id));
      setMsg("Import zakończony pomyślnie");
      setOpen(true);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Błąd podczas importu";
      setMsg(message);
      setOpen(true);
    } finally {
      // reset file input
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  function validateWorkoutPlan(parsed: WorkoutPlan) {
    const errs: string[] = [];
    const workouts = parsed.workouts ?? parsed.plan?.workouts;
    if (!workouts || !Array.isArray(workouts)) {
      errs.push("Brak pola `workouts` lub `plan.workouts` (nie jest tablicą).");
      return errs;
    }
    workouts.forEach((w, wi) => {
      const p = `workouts[${wi}]`;
      if (!w.name) errs.push(`${p}: brak pola 'name'`);
      if (!w.description) errs.push(`${p}: brak pola 'description'`);
      if (!w.scheduledAt) errs.push(`${p}: brak pola 'scheduledAt'`);
      if (!w.sets || !Array.isArray(w.sets) || w.sets.length === 0) {
        errs.push(`${p}: brak pola 'sets' lub jest puste`);
      } else {
        w.sets.forEach((s, si) => {
          const sp = `${p}.sets[${si}]`;
          if (s.setNumber == null) errs.push(`${sp}: brak pola 'setNumber'`);
          if (!s.type) errs.push(`${sp}: brak pola 'type'`);
          if (s.rounds == null) errs.push(`${sp}: brak pola 'rounds'`);
          if (s.restBetweenRoundsSeconds == null)
            errs.push(`${sp}: brak pola 'restBetweenRoundsSeconds'`);
          if (s.restAfterSetSeconds == null)
            errs.push(`${sp}: brak pola 'restAfterSetSeconds'`);
          if (
            !s.exercises ||
            !Array.isArray(s.exercises) ||
            s.exercises.length === 0
          ) {
            errs.push(`${sp}: brak pola 'exercises' lub jest puste`);
          } else {
            s.exercises.forEach((ex, ei) => {
              const ep = `${sp}.exercises[${ei}]`;
              if (!ex.name) errs.push(`${ep}: brak pola 'name'`);
              if (ex.reps == null) errs.push(`${ep}: brak pola 'reps'`);
              if (!ex.description) errs.push(`${ep}: brak pola 'description'`);
            });
          }
        });
      }
    });
    return errs;
  }

  const importFromText = async (text: string) => {
    try {
      const parsed = JSON.parse(text) as WorkoutPlan;
      const workouts = parsed.workouts ?? parsed.plan?.workouts;
      if (!workouts || !Array.isArray(workouts)) {
        throw new Error("Nieprawidłowy format pliku. Brak workouts.");
      }
      if (!user) throw new Error("Nie jesteś zalogowany");

      const uid = user.uid;
      const colRef = collection(db, "users", uid, "workouts");
      const batchPromises = workouts.map((workout) =>
        addDoc(colRef, { ...workout, createdAt: serverTimestamp() }),
      );

      const refs = await Promise.all(batchPromises);
      saveImportedWorkoutIds(refs.map((ref) => ref.id));
      setMsg("Import zakończony pomyślnie");
      setOpen(true);
      setDialogOpen(false);
      setPasteValue("");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Błąd podczas importu";
      setMsg(message);
      setOpen(true);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/json"
        hidden
        aria-label="Import JSON workout file"
        onChange={onFile}
      />
      <Box sx={{ position: "fixed", right: 16, bottom: 16 }}>
        <Fab
          color="primary"
          aria-label="Import"
          onClick={() => setDialogOpen(true)}
        >
          <UploadFileIcon />
        </Fab>
      </Box>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Importuj plan treningowy</DialogTitle>
        <DialogContent>
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Button variant="contained" onClick={onChoose}>
              Importuj treningi z pliku JSON
            </Button>
            <Button variant="outlined" onClick={downloadTemplate}>
              Pobierz szablon
            </Button>
            <Button variant="outlined" onClick={copyTemplate}>
              Skopiuj szablon
            </Button>
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            lub wklej zawartość pliku JSON poniżej:
          </Typography>
          <TextField
            value={pasteValue}
            onChange={(e) => setPasteValue(e.target.value)}
            placeholder='{"workouts": [ ... ] }'
            multiline
            rows={10}
            fullWidth
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Anuluj</Button>
          <Button
            variant="contained"
            disabled={!pasteValue.trim()}
            onClick={() => importFromText(pasteValue)}
          >
            Importuj z tekstu
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={open}
        autoHideDuration={6000}
        onClose={() => setOpen(false)}
      >
        <Alert
          onClose={() => setOpen(false)}
          severity={msg.includes("Błąd") ? "error" : "success"}
          sx={{ width: "100%" }}
        >
          {msg}
        </Alert>
      </Snackbar>
    </>
  );
}
