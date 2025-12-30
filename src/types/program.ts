import { ProgramEditorRole } from "./enums";
import { UUID } from "./generic";

export type ProgramRow = {
  id: UUID;

  name: string;
  owned_by: UUID;
  description: string;
  num_weeks: number;
};

export type ProgramMembershipRow = {
  program_id: UUID;
  user_id: UUID;
  editor_role: ProgramEditorRole;
};
