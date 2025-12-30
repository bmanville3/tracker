import { ExerciseAndMuscleTag, MuscleGroup } from "./enums";
import { UUID } from "./generic";

export interface ExerciseRow {
  id: UUID;

  name: string;
  description: string;
  created_by_user: UUID | null;
  tags: ExerciseAndMuscleTag[];
}

export interface MuscleGroupRow {
  id: MuscleGroup;

  display_name: string;
  description: string;
  tags: ExerciseAndMuscleTag[];
}

export interface ExerciseMuscleRow {
  id: UUID;

  muscle_id: MuscleGroup;
  exercise_id: UUID;
  volume_factor: number;
  user_id: UUID | null;
}
