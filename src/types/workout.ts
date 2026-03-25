export interface Exercise {
  name: string;
  description: string;
  reps: number;
  equipment: string | null;
}

export interface WorkoutSet {
  setNumber: number;
  type: "circuit" | "standard";
  rounds: number;
  restBetweenRoundsSeconds: number;
  restAfterSetSeconds: number;
  exercises: Exercise[];
}

export interface Workout {
  id: string;
  name: string;
  description: string;
  scheduledAt: string; // ISO
  createdAt: number; // timestamp ms
  status?: "completed";
  completedAt?: unknown;
  sets: WorkoutSet[];
}

// Shape of the imported JSON file
export interface WorkoutPlan {
  plan: {
    name: string;
    createdAt: string;
    workouts: Omit<Workout, "createdAt">[];
  };
}
