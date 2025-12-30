import { DistanceUnit, TrackableTag, WeightUnit } from "./enums";
import { UUID } from "./generic";

export type ProfileRow = {
  user_id: UUID;
  display_name: string;
  default_weight_unit: WeightUnit;
  default_distance_unit: DistanceUnit;
};

export type TrackedUserItemRow = {
  user_id: UUID;
  item_id: UUID;
  item_tag: TrackableTag;
};
