import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Divider,
  Checkbox,
  IconButton,
  Button,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Chip,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import CloseIcon from "@mui/icons-material/Close";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import FitnessCenterIcon from "@mui/icons-material/FitnessCenter";
import Navbar from "../components/Navbar";
import ImportFab from "../components/ImportFab";
import useWorkouts from "../hooks/useWorkouts";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../firebase";
import { doc, deleteDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const NEW_WORKOUTS_STORAGE_KEY = "mobile-trainer:new-workout-ids";

function readNewWorkoutIdsFromStorage() {
  try {
    const raw = sessionStorage.getItem(NEW_WORKOUTS_STORAGE_KEY);
    if (!raw) return [] as string[];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [] as string[];
  }
}

export default function WorkoutListPage() {
  const { workouts, loading, error } = useWorkouts();
  const { user } = useAuth();
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<"success" | "error">(
    "success"
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [newWorkoutIds, setNewWorkoutIds] = useState<string[]>(() =>
    readNewWorkoutIdsFromStorage()
  );
  const navigate = useNavigate();

  useEffect(() => {
    setNewWorkoutIds(readNewWorkoutIdsFromStorage());
  }, [workouts]);

  const newWorkoutIdSet = useMemo(
    () => new Set(newWorkoutIds),
    [newWorkoutIds]
  );

  const toggleSelect = (id: string) => {
    setSelected((s) => ({ ...s, [id]: !s[id] }));
  };

  const clearSelection = () => {
    setSelected({});
    setSelectionMode(false);
  };

  const deleteSelected = async () => {
    if (!user) return;
    const ids = Object.keys(selected).filter((k) => selected[k]);
    if (!ids.length) return;
    try {
      await Promise.all(
        ids.map((id) => deleteDoc(doc(db, "users", user.uid, "workouts", id)))
      );
      setSnackbarMsg(`Usunięto ${ids.length} trening(ów)`);
      setSnackbarSeverity("success");
      setSnackbarOpen(true);
      clearSelection();
    } catch (error) {
      console.error("deleteSelected error", error);
      setSnackbarMsg("Błąd podczas usuwania");
      setSnackbarSeverity("error");
      setSnackbarOpen(true);
    }
  };

  return (
    <Box>
      <Navbar />
      <Box sx={{ p: 2 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1 }}>
            {selectionMode
              ? `${
                  Object.keys(selected).filter((k) => selected[k]).length
                } zaznaczonych`
              : "Moje treningi"}
          </Typography>
          {!selectionMode ? (
            <Button onClick={() => setSelectionMode(true)} variant="outlined">
              Zaznacz
            </Button>
          ) : (
            <>
              <IconButton
                onClick={() => {
                  const ids = Object.keys(selected).filter((k) => selected[k]);
                  if (ids.length) setConfirmOpen(true);
                }}
                color="error"
                aria-label="Usuń"
              >
                <DeleteIcon />
              </IconButton>
              <IconButton onClick={clearSelection} aria-label="Anuluj">
                <CloseIcon />
              </IconButton>
            </>
          )}
        </Box>

        {loading ? (
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            Ładowanie...
          </Typography>
        ) : error ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : workouts.length === 0 ? (
          <Typography color="text.secondary" sx={{ mt: 2 }}>
            Brak treningów. Użyj przycisku importu, aby dodać treningi z pliku
            JSON.
          </Typography>
        ) : (
          <List>
            {workouts.map((w) => {
              const isCompleted = w.status === "completed";

              return (
                <div key={w.id}>
                  <ListItem disablePadding>
                    <ListItemButton
                      sx={{ opacity: isCompleted ? 0.55 : 1 }}
                      onClick={() => {
                        if (selectionMode) toggleSelect(w.id);
                        else navigate(`/workout/${w.id}`);
                      }}
                    >
                      {selectionMode && (
                        <Checkbox
                          edge="start"
                          checked={!!selected[w.id]}
                          tabIndex={-1}
                          disableRipple
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(w.id);
                          }}
                          sx={{ mr: 2 }}
                        />
                      )}
                      <ListItemText
                        primary={
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            <FitnessCenterIcon
                              fontSize="small"
                              color="action"
                            />
                            <span>{w.name}</span>
                            {newWorkoutIdSet.has(w.id) ? (
                              <Chip
                                label="New"
                                size="small"
                                color="primary"
                                variant="outlined"
                              />
                            ) : null}
                            {isCompleted ? (
                              <Chip
                                label="Zrobione"
                                size="small"
                                color="success"
                                variant="outlined"
                              />
                            ) : null}
                          </Box>
                        }
                        secondary={
                          <Box
                            component="span"
                            sx={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 0.5,
                            }}
                          >
                            <CalendarTodayIcon
                              sx={{ fontSize: 13, verticalAlign: "middle" }}
                            />
                            {new Date(w.scheduledAt)
                              .toLocaleDateString("pl-PL", {
                                weekday: "long",
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                              })
                              .replace(/^\w/, (c) => c.toUpperCase())}
                          </Box>
                        }
                      />
                    </ListItemButton>
                  </ListItem>
                  <Divider />
                </div>
              );
            })}
          </List>
        )}
      </Box>
      <ImportFab />
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        aria-labelledby="confirm-delete-title"
      >
        <DialogTitle id="confirm-delete-title">Potwierdź usunięcie</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Czy na pewno chcesz usunąć zaznaczone treningi? Operacji nie można
            cofnąć.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1.5 }}>
          <Button
            variant="outlined"
            onClick={() => setConfirmOpen(false)}
            sx={{ flex: 1, minHeight: 48 }}
          >
            Anuluj
          </Button>
          <Button
            color="error"
            variant="contained"
            onClick={async () => {
              setConfirmOpen(false);
              await deleteSelected();
            }}
            sx={{ flex: 1, minHeight: 48 }}
          >
            Usuń
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
          sx={{ width: "100%" }}
        >
          {snackbarMsg}
        </Alert>
      </Snackbar>
    </Box>
  );
}
