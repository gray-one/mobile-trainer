import {
  Box,
  Button,
  Container,
  Typography,
  Snackbar,
  Alert,
} from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";
import { useAuth } from "../contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useState } from "react";

export default function LoginPage() {
  const { user, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState("");
  const [signing, setSigning] = useState(false);

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  return (
    <Container maxWidth="xs">
      <Box
        sx={{
          minHeight: "100svh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 3,
          textAlign: "center",
        }}
      >
        <Typography variant="h3" sx={{ fontWeight: 800 }}>
          💪
        </Typography>
        <Typography variant="h5" sx={{ fontWeight: 700 }}>
          Mobile Trainer
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Zaloguj się, aby zarządzać swoimi treningami
        </Typography>
        <Button
          variant="contained"
          size="large"
          startIcon={<GoogleIcon />}
          onClick={async () => {
            setSigning(true);
            const err = await signInWithGoogle();
            setSigning(false);
            if (err) {
              setSnackbarMsg(err);
              setSnackbarOpen(true);
            }
          }}
          disabled={signing}
          fullWidth
          sx={{ borderRadius: 3, textTransform: "none", py: 1.5 }}
        >
          Zaloguj się przez Google
        </Button>
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
    </Container>
  );
}
