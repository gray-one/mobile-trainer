import { useEffect, useRef, useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import TimerIcon from "@mui/icons-material/Timer";

type TimerDisplayProps = {
  seconds: number;
  autoStart?: boolean;
  onStart?: () => void;
  onFinish?: () => void;
  label?: string;
  size?: number;
};

function formatSeconds(value: number) {
  const mins = Math.floor(value / 60)
    .toString()
    .padStart(2, "0");
  const secs = (value % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
}

export default function TimerDisplay({
  seconds,
  autoStart = true,
  onStart,
  onFinish,
  label,
  size = 28,
}: TimerDisplayProps) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(autoStart);
  const finishedRef = useRef(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    setRemaining(seconds);
    finishedRef.current = false;
    setRunning(autoStart);
  }, [seconds, autoStart]);

  // Acquire wake lock when timer starts
  useEffect(() => {
    if (!running) return;

    let cancelled = false;

    const acquireWakeLock = async () => {
      try {
        if (navigator.wakeLock) {
          const sentinel = await navigator.wakeLock.request("screen");
          if (!cancelled) {
            wakeLockRef.current = sentinel;
          }
        }
      } catch (err) {
        console.warn("Wake Lock API not available or failed:", err);
      }
    };

    void acquireWakeLock();

    return () => {
      cancelled = true;
    };
  }, [running]);

  // Call onStart when timer starts (for both autoStart and manual start)
  useEffect(() => {
    if (running && onStart) {
      onStart();
    }
  }, [running, onStart]);

  // Timer interval
  useEffect(() => {
    if (!running) return;

    const interval = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (!finishedRef.current && onFinish) {
            finishedRef.current = true;
            onFinish();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [running, onFinish]);

  useEffect(() => {
    if (!running && remaining === 0 && !finishedRef.current) {
      finishedRef.current = true;
      onFinish?.();
    }
  }, [running, remaining, onFinish]);

  // Release wake lock when timer finishes or component unmounts
  useEffect(() => {
    return () => {
      if (wakeLockRef.current) {
        void wakeLockRef.current.release().catch(() => {
          // Ignore errors on release
        });
        wakeLockRef.current = null;
      }
    };
  }, []);

  // Re-acquire wake lock if page becomes visible again
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!running) return;

      if (document.hidden) {
        // Page is hidden, we can try to keep the lock
        // (system may release it)
      } else {
        // Page is visible again, re-acquire wake lock if lost
        if (!wakeLockRef.current && navigator.wakeLock) {
          try {
            wakeLockRef.current = await navigator.wakeLock.request("screen");
          } catch (err) {
            console.warn("Failed to re-acquire wake lock:", err);
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [running]);

  const onStartClick = () => {
    if (!running) {
      setRunning(true);
      onStart?.();
    }
  };

  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <TimerIcon color="primary" sx={{ fontSize: size }} />
        <Typography variant={size >= 40 ? "h3" : "h4"} fontWeight={700}>
          {formatSeconds(remaining)}
        </Typography>
        {label ? (
          <Typography variant="body2" color="text.secondary">
            {label}
          </Typography>
        ) : null}
      </Box>
      {!running ? (
        <Box sx={{ mt: 2, width: "100%" }}>
          <Button
            variant="contained"
            size="large"
            onClick={onStartClick}
            fullWidth
            sx={{ minHeight: 56 }}
          >
            Start
          </Button>
        </Box>
      ) : null}
    </Box>
  );
}
