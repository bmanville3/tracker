// import { Button, Screen } from "@/src/components";
// import { WorkoutView } from "@/src/components/WorkoutView";
// import { useState } from "react";
// import { Text } from "react-native";

// export default function Playground() {
//   const [newWorkout, setNewWorkout] = useState<FullDetachedWorkout | null>(
//     null,
//   );
//   const [isActive, setIsActive] = useState<boolean>(false);

//   return (
//     <Screen>
//       {!isActive && (
//         <Button title={"Open workout view"} onPress={() => setIsActive(true)} />
//       )}
//       {!isActive && newWorkout !== null && (
//         <Text>New Workout: {String(newWorkout)}</Text>
//       )}
//       <WorkoutView
//         allowEditing={true}
//         isActive={isActive}
//         onSave={(wk) => {
//           setNewWorkout(wk);
//           return true;
//         }}
//         requestClose={() => setIsActive(false)}
//         createAsTemplate={true}
//       />
//     </Screen>
//   );
// }
