// A practical “full gym-relevant” muscle list with scientific name + common gym name + tags.
export type MuscleTag =
  | "chest"
  | "upper_back"
  | "lower_back"
  | "lats"
  | "traps"
  | "front_delt"
  | "side_delt"
  | "rear_delt"
  | "bicep"
  | "tricep"
  | "forearm"
  | "abs"
  | "quad"
  | "hamstring"
  | "neck"
  | "upper"
  | "lower"
  | "torso"
  | "arm"
  | "shoulder"
  | "back"
  | "core"
  | "hip"
  | "thigh"
  | "leg"
  | "glute"
  | "calf"
  | "anterior"
  | "posterior"
  | "medial"
  | "lateral"
  | "deep"
  | "push"
  | "pull"
  | "stabilizer"
  | "knee_extensor"
  | "knee_flexor"
  | "hip_extensor"
  | "hip_flexor"
  | "hip_abductor"
  | "hip_adductor"
  | "plantar_flexor"
  | "dorsi_flexor"
  | "scapular"
  | "rotator_cuff"
  | "spinal_erector"
  | "breathing";

export interface MuscleEntry {
  id: string;
  scientificName: string;
  gymName: string;
  tags: MuscleTag[];
}

export const MUSCLES: MuscleEntry[] = [
  // -------------------- CHEST --------------------
  {
    id: "pectoralis_major_clavicular",
    scientificName: "Pectoralis major (clavicular head)",
    gymName: "Upper chest",
    tags: ["upper", "torso", "chest", "anterior", "push"],
  },
  {
    id: "pectoralis_major_sternal",
    scientificName: "Pectoralis major (sternocostal head)",
    gymName: "Mid/lower chest",
    tags: ["upper", "torso", "chest", "anterior", "push"],
  },
  {
    id: "pectoralis_minor",
    scientificName: "Pectoralis minor",
    gymName: "Pec minor",
    tags: ["upper", "torso", "chest", "anterior", "deep", "scapular", "stabilizer"],
  },
  {
    id: "serratus_anterior",
    scientificName: "Serratus anterior",
    gymName: "Serratus",
    tags: ["upper", "torso", "chest", "anterior", "scapular", "stabilizer"],
  },

  // -------------------- BACK (LATS / TRAPS / RHOMBOIDS) --------------------
  {
    id: "latissimus_dorsi",
    scientificName: "Latissimus dorsi",
    gymName: "Lats",
    tags: ["upper", "torso", "back", "posterior", "pull", "lats"],
  },
  {
    id: "trapezius_upper",
    scientificName: "Trapezius (upper fibers)",
    gymName: "Upper traps",
    tags: ["upper", "torso", "back", "posterior", "scapular", "pull", "traps"],
  },
  {
    id: "trapezius_middle",
    scientificName: "Trapezius (middle fibers)",
    gymName: "Mid traps",
    tags: ["upper", "torso", "back", "posterior", "scapular", "pull", "traps"],
  },
  {
    id: "trapezius_lower",
    scientificName: "Trapezius (lower fibers)",
    gymName: "Lower traps",
    tags: ["upper", "torso", "back", "posterior", "scapular", "pull", "traps"],
  },
  {
    id: "rhomboid_major",
    scientificName: "Rhomboid major",
    gymName: "Rhomboids",
    tags: ["upper", "torso", "back", "posterior", "scapular", "pull", "deep", "upper_back"],
  },
  {
    id: "rhomboid_minor",
    scientificName: "Rhomboid minor",
    gymName: "Rhomboids (minor)",
    tags: ["upper", "torso", "back", "posterior", "scapular", "pull", "deep", "upper_back"],
  },
  {
    id: "levator_scapulae",
    scientificName: "Levator scapulae",
    gymName: "Levator scapulae",
    tags: ["upper", "neck", "back", "posterior", "scapular", "stabilizer", "traps"],
  },

  // -------------------- SHOULDERS --------------------
  {
    id: "deltoid_anterior",
    scientificName: "Deltoid (anterior fibers)",
    gymName: "Front delts",
    tags: ["upper", "shoulder", "anterior", "push", "front_delt"],
  },
  {
    id: "deltoid_lateral",
    scientificName: "Deltoid (middle fibers)",
    gymName: "Side delts",
    tags: ["upper", "shoulder", "lateral", "push", "side_delt"],
  },
  {
    id: "deltoid_posterior",
    scientificName: "Deltoid (posterior fibers)",
    gymName: "Rear delts",
    tags: ["upper", "shoulder", "posterior", "pull", "back", "rear_delt"],
  },

  // Rotator cuff
  {
    id: "supraspinatus",
    scientificName: "Supraspinatus",
    gymName: "Rotator cuff (supraspinatus)",
    tags: ["upper", "shoulder", "rotator_cuff", "deep", "stabilizer", "back", "upper_back"],
  },
  {
    id: "infraspinatus",
    scientificName: "Infraspinatus",
    gymName: "Rotator cuff (infraspinatus)",
    tags: ["upper", "shoulder", "rotator_cuff", "posterior", "deep", "stabilizer", "back", "upper_back"],
  },
  {
    id: "teres_minor",
    scientificName: "Teres minor",
    gymName: "Rotator cuff (teres minor)",
    tags: ["upper", "shoulder", "rotator_cuff", "posterior", "deep", "stabilizer", "back", "upper_back"],
  },
  {
    id: "subscapularis",
    scientificName: "Subscapularis",
    gymName: "Rotator cuff (subscapularis)",
    tags: ["upper", "shoulder", "rotator_cuff", "anterior", "deep", "stabilizer", "back", "upper_back"],
  },
  {
    id: "teres_major",
    scientificName: "Teres major",
    gymName: "Teres major",
    tags: ["upper", "torso", "back", "posterior", "pull", "back", "upper_back"],
  },

  // -------------------- ARMS (BICEPS / TRICEPS / BRACHIALIS) --------------------
  {
    id: "biceps_brachii_long",
    scientificName: "Biceps brachii (long head)",
    gymName: "Biceps (long head)",
    tags: ["upper", "arm", "anterior", "pull", "bicep"],
  },
  {
    id: "biceps_brachii_short",
    scientificName: "Biceps brachii (short head)",
    gymName: "Biceps (short head)",
    tags: ["upper", "arm", "anterior", "pull", "bicep"],
  },
  {
    id: "brachialis",
    scientificName: "Brachialis",
    gymName: "Brachialis",
    tags: ["upper", "arm", "anterior", "pull", "deep", "bicep"],
  },
  {
    id: "brachioradialis",
    scientificName: "Brachioradialis",
    gymName: "Brachioradialis",
    tags: ["upper", "forearm", "lateral", "pull"],
  },
  {
    id: "triceps_long",
    scientificName: "Triceps brachii (long head)",
    gymName: "Triceps (long head)",
    tags: ["upper", "arm", "posterior", "push", "tricep"],
  },
  {
    id: "triceps_lateral",
    scientificName: "Triceps brachii (lateral head)",
    gymName: "Triceps (lateral head)",
    tags: ["upper", "arm", "posterior", "push", "tricep"],
  },
  {
    id: "triceps_medial",
    scientificName: "Triceps brachii (medial head)",
    gymName: "Triceps (medial head)",
    tags: ["upper", "arm", "posterior", "push", "deep", "tricep"],
  },

  // -------------------- FOREARMS (simplified but useful) --------------------
  {
    id: "forearm_flexors",
    scientificName: "Forearm flexor group (various)",
    gymName: "Forearm flexors",
    tags: ["upper", "forearm", "anterior", "pull", "stabilizer"],
  },
  {
    id: "forearm_extensors",
    scientificName: "Forearm extensor group (various)",
    gymName: "Forearm extensors",
    tags: ["upper", "forearm", "posterior", "pull", "stabilizer"],
  },
  {
    id: "pronator_teres",
    scientificName: "Pronator teres",
    gymName: "Forearm pronators",
    tags: ["upper", "forearm", "anterior", "stabilizer"],
  },
  {
    id: "supinator",
    scientificName: "Supinator",
    gymName: "Forearm supinators",
    tags: ["upper", "forearm", "posterior", "deep", "stabilizer"],
  },

  // -------------------- NECK --------------------
  {
    id: "sternocleidomastoid",
    scientificName: "Sternocleidomastoid",
    gymName: "SCM",
    tags: ["upper", "neck", "anterior", "stabilizer"],
  },

  // -------------------- CORE / ABDOMEN --------------------
  {
    id: "rectus_abdominis",
    scientificName: "Rectus abdominis",
    gymName: "Abs",
    tags: ["torso", "core", "anterior", "push", "stabilizer", "abs"],
  },
  {
    id: "obliques_external",
    scientificName: "External oblique",
    gymName: "Obliques",
    tags: ["torso", "core", "anterior", "lateral", "stabilizer", "abs"],
  },
  {
    id: "obliques_internal",
    scientificName: "Internal oblique",
    gymName: "Obliques (internal)",
    tags: ["torso", "core", "anterior", "lateral", "deep", "stabilizer", "abs"],
  },
  {
    id: "transversus_abdominis",
    scientificName: "Transversus abdominis",
    gymName: "Deep core",
    tags: ["torso", "core", "anterior", "deep", "stabilizer", "abs"],
  },

  // -------------------- SPINE / LOWER BACK --------------------
  {
    id: "erector_spinae",
    scientificName: "Erector spinae (iliocostalis/longissimus/spinalis)",
    gymName: "Spinal erectors",
    tags: ["torso", "back", "posterior", "spinal_erector", "stabilizer"],
  },
  {
    id: "multifidus",
    scientificName: "Multifidus",
    gymName: "Deep spinal stabilizers",
    tags: ["torso", "back", "posterior", "deep", "stabilizer", "spinal_erector"],
  },
  {
    id: "quadratus_lumborum",
    scientificName: "Quadratus lumborum",
    gymName: "QL",
    tags: ["torso", "back", "posterior", "lateral", "stabilizer", "deep", "lower_back", "core"],
  },

  // -------------------- BREATHING (optional but useful) --------------------
  {
    id: "diaphragm",
    scientificName: "Diaphragm",
    gymName: "Diaphragm",
    tags: ["torso", "core", "deep", "breathing", "stabilizer"],
  },
  {
    id: "intercostals",
    scientificName: "Intercostals",
    gymName: "Intercostals",
    tags: ["torso", "core", "breathing", "stabilizer"],
  },

  // -------------------- HIPS / GLUTES --------------------
  {
    id: "gluteus_maximus",
    scientificName: "Gluteus maximus",
    gymName: "Glutes",
    tags: ["lower", "hip", "glute", "posterior", "hip_extensor", "push"],
  },
  {
    id: "gluteus_medius",
    scientificName: "Gluteus medius",
    gymName: "Glute med",
    tags: ["lower", "hip", "glute", "lateral", "hip_abductor", "stabilizer"],
  },
  {
    id: "gluteus_minimus",
    scientificName: "Gluteus minimus",
    gymName: "Glute min",
    tags: ["lower", "hip", "glute", "lateral", "hip_abductor", "deep", "stabilizer"],
  },
  {
    id: "tensor_fasciae_latae",
    scientificName: "Tensor fasciae latae",
    gymName: "TFL",
    tags: ["lower", "hip", "lateral", "hip_abductor", "stabilizer"],
  },

  // Deep hip rotators (grouped; can be expanded)
  {
    id: "deep_hip_rotators",
    scientificName: "Deep hip rotators (piriformis/obturators/gemelli/quadratus femoris)",
    gymName: "Deep hip rotators",
    tags: ["lower", "hip", "deep", "stabilizer", "posterior"],
  },

  // -------------------- HIP FLEXORS --------------------
  {
    id: "iliopsoas",
    scientificName: "Iliopsoas (psoas major + iliacus)",
    gymName: "Hip flexors",
    tags: ["lower", "hip", "anterior", "hip_flexor", "deep"],
  },
  {
    id: "sartorius",
    scientificName: "Sartorius",
    gymName: "Sartorius",
    tags: ["lower", "thigh", "anterior", "hip_flexor", "stabilizer"],
  },

  // -------------------- QUADS --------------------
  {
    id: "vastus_lateralis",
    scientificName: "Vastus lateralis",
    gymName: "Quads (outer)",
    tags: ["lower", "thigh", "anterior", "lateral", "knee_extensor", "push", "quad"],
  },
  {
    id: "vastus_medialis",
    scientificName: "Vastus medialis",
    gymName: "Quads (inner / teardrop)",
    tags: ["lower", "thigh", "anterior", "medial", "knee_extensor", "push", "quad"],
  },
  {
    id: "vastus_intermedius",
    scientificName: "Vastus intermedius",
    gymName: "Quads (deep)",
    tags: ["lower", "thigh", "anterior", "knee_extensor", "deep", "push", "quad"],
  },
  {
    id: "rectus_femoris",
    scientificName: "Rectus femoris",
    gymName: "Quads (rectus femoris)",
    tags: ["lower", "thigh", "anterior", "knee_extensor", "hip_flexor", "push", "quad"],
  },

  // -------------------- HAMSTRINGS --------------------
  {
    id: "biceps_femoris_long",
    scientificName: "Biceps femoris (long head)",
    gymName: "Hamstrings (biceps femoris long)",
    tags: ["lower", "thigh", "posterior", "lateral", "knee_flexor", "hip_extensor", "pull", "hamstring"],
  },
  {
    id: "biceps_femoris_short",
    scientificName: "Biceps femoris (short head)",
    gymName: "Hamstrings (biceps femoris short)",
    tags: ["lower", "thigh", "posterior", "lateral", "knee_flexor", "pull", "hamstring"],
  },
  {
    id: "semitendinosus",
    scientificName: "Semitendinosus",
    gymName: "Hamstrings (semitendinosus)",
    tags: ["lower", "thigh", "posterior", "medial", "knee_flexor", "hip_extensor", "pull", "hamstring"],
  },
  {
    id: "semimembranosus",
    scientificName: "Semimembranosus",
    gymName: "Hamstrings (semimembranosus)",
    tags: ["lower", "thigh", "posterior", "medial", "knee_flexor", "hip_extensor", "pull", "hamstring"],
  },

  // -------------------- ADDUCTORS --------------------
  {
    id: "adductor_magnus",
    scientificName: "Adductor magnus",
    gymName: "Adductors (magnus)",
    tags: ["lower", "hip", "thigh", "medial", "hip_adductor", "stabilizer"],
  },
  {
    id: "adductor_longus",
    scientificName: "Adductor longus",
    gymName: "Adductors (longus)",
    tags: ["lower", "hip", "thigh", "medial", "hip_adductor", "stabilizer"],
  },
  {
    id: "adductor_brevis",
    scientificName: "Adductor brevis",
    gymName: "Adductors (brevis)",
    tags: ["lower", "hip", "thigh", "medial", "hip_adductor", "deep", "stabilizer"],
  },
  {
    id: "gracilis",
    scientificName: "Gracilis",
    gymName: "Gracilis",
    tags: ["lower", "thigh", "medial", "hip_adductor", "knee_flexor", "stabilizer"],
  },

  // -------------------- CALVES / LOWER LEG --------------------
  {
    id: "gastrocnemius_medial",
    scientificName: "Gastrocnemius (medial head)",
    gymName: "Calves (gastroc medial)",
    tags: ["lower", "leg", "calf", "posterior", "medial", "plantar_flexor"],
  },
  {
    id: "gastrocnemius_lateral",
    scientificName: "Gastrocnemius (lateral head)",
    gymName: "Calves (gastroc lateral)",
    tags: ["lower", "leg", "calf", "posterior", "lateral", "plantar_flexor"],
  },
  {
    id: "soleus",
    scientificName: "Soleus",
    gymName: "Soleus",
    tags: ["lower", "leg", "calf", "posterior", "plantar_flexor", "deep"],
  },
  {
    id: "tibialis_anterior",
    scientificName: "Tibialis anterior",
    gymName: "Tibialis anterior",
    tags: ["lower", "leg", "anterior", "dorsi_flexor"],
  },
  {
    id: "peroneals",
    scientificName: "Fibularis (peroneal) muscles (longus/brevis)",
    gymName: "Peroneals",
    tags: ["lower", "leg", "lateral", "stabilizer"],
  },
];
