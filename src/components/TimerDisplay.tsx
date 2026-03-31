import { useEffect, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import TimerIcon from "@mui/icons-material/Timer";

type TimerDisplayProps = {
  seconds: number;
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
  onFinish,
  label,
  size = 28,
}: TimerDisplayProps) {
  const [remaining, setRemaining] = useState(seconds);
  const finishedRef = useRef(false);

  useEffect(() => {
    setRemaining(seconds);
    finishedRef.current = false;
  }, [seconds]);

  useEffect(() => {
    if (seconds <= 0) {
      if (!finishedRef.current && onFinish) {
        finishedRef.current = true;
        onFinish();
      }
      return;
    }

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
  }, [seconds, onFinish]);

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
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
  );
}
