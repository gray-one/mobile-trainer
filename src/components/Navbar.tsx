import { useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Box,
  Snackbar,
  Alert,
  Switch,
  Tooltip,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import { useAuth } from "../contexts/AuthContext";
import { useThemeMode } from "../contexts/ThemeModeContext";

export default function Navbar() {
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState("");

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: "background.paper",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Toolbar>
        <Typography
          variant="h6"
          sx={{ flexGrow: 1, fontWeight: 700, color: "primary.main" }}
        >
          💪 Mobile Trainer
        </Typography>

        <Tooltip title={mode === "dark" ? "Tryb jasny" : "Tryb ciemny"}>
          <Box sx={{ display: "flex", alignItems: "center", mr: 1 }}>
            <LightModeIcon fontSize="small" color="action" />
            <Switch
              checked={mode === "dark"}
              onChange={toggleMode}
              inputProps={{ "aria-label": "Przełącz motyw" }}
            />
            <DarkModeIcon fontSize="small" color="action" />
          </Box>
        </Tooltip>

        {user && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Avatar
              src={user.photoURL ?? undefined}
              alt={user.displayName ?? "User"}
              sx={{ width: 32, height: 32 }}
            />
            <IconButton
              onClick={async () => {
                const err = await logout();
                if (err) {
                  setSnackbarMsg(err);
                  setSnackbarOpen(true);
                }
              }}
              size="small"
              aria-label="Wyloguj"
              sx={{ color: "text.secondary" }}
            >
              <LogoutIcon fontSize="small" />
            </IconButton>
            <Snackbar
              open={snackbarOpen}
              autoHideDuration={6000}
              onClose={() => setSnackbarOpen(false)}
            >
              <Alert
                onClose={() => setSnackbarOpen(false)}
                severity="error"
                sx={{ width: "100%" }}
              >
                {snackbarMsg}
              </Alert>
            </Snackbar>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
}
