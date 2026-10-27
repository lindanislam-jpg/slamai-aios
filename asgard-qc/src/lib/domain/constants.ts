/**
 * Default vocabularies. These are starting lists, not standards: categories
 * and stages can be extended in Settings, and nothing here is an acceptance
 * criterion.
 */

export const DEFAULT_PRODUCTION_STAGES = [
  "Project commencement",
  "Incoming materials",
  "Cutting & preparation",
  "Drilling & bending",
  "Fabrication",
  "Frame assembly",
  "Welding",
  "NDT & testing",
  "Dimensional inspection",
  "Surface preparation",
  "Painting & coating",
  "Final inspection",
  "Packaging & dispatch",
] as const;

export const DEFAULT_PHOTO_CATEGORIES = [
  "Project commencement",
  "Incoming materials",
  "Steel identification & heat numbers",
  "Cutting & preparation",
  "Drilling & bending",
  "Fabrication in progress",
  "Frame assembly",
  "Welding in progress",
  "Weld visual inspection",
  "Suspected weld defects",
  "NDT & testing evidence",
  "Dimensional inspection",
  "Surface preparation",
  "Painting & coating",
  "Repair & rework — before",
  "Repair & rework — after",
  "Final inspection",
  "Completed module",
  "Packaging & dispatch",
  "General quality evidence",
] as const;

export const WELD_DEFECT_CATEGORIES = [
  "Undercut",
  "Porosity",
  "Cracks",
  "Incomplete weld",
  "Incomplete fusion / penetration",
  "Weld spatter",
  "Incorrect weld profile",
  "Incorrect weld size",
  "Missing weld",
  "Distortion",
  "Other / requires review",
] as const;

export const NCR_DEFECT_CATEGORIES = [
  ...WELD_DEFECT_CATEGORIES,
  "Dimensional",
  "Material / traceability",
  "Drawing / revision",
  "Coating",
  "Missing component",
  "Workmanship",
  "Documentation",
  "Supplier",
] as const;

export const ROOT_CAUSE_CATEGORIES = [
  "Method / procedure",
  "Machine / equipment",
  "Material",
  "Man / training",
  "Measurement",
  "Environment",
  "Design / drawing",
  "Supplier",
  "Under investigation",
] as const;

export const ROOT_CAUSE_METHODS = ["5 Whys", "Fishbone (Ishikawa)", "Fault tree", "Other"] as const;

export const FABRICATION_OPERATIONS = [
  "Cutting & preparation",
  "Drilling",
  "Bending / press brake",
  "Chamfering & edge preparation",
  "Dimensional check",
  "Frame squareness & alignment",
  "Component fit-up",
  "Drawing & revision verification",
  "Surface condition",
  "Weld preparation",
  "General workmanship",
] as const;

export const NDT_METHODS = [
  "Visual (VT)",
  "Magnetic particle (MT)",
  "Dye penetrant (PT)",
  "Ultrasonic (UT)",
  "Radiographic (RT)",
  "Load / proof test",
  "Other",
] as const;

export const DOCUMENT_TYPES = [
  "Drawing",
  "Inspection & test plan",
  "Checklist",
  "WPS",
  "WPQR",
  "Welder qualification",
  "Material certificate",
  "NDT report",
  "Procedure",
  "Work instruction",
  "Calibration certificate",
  "Audit document",
  "Concession / deviation",
  "Final quality pack",
  "Other",
] as const;

export const INSPECTION_TYPE_LABELS: Record<string, string> = {
  INCOMING_MATERIAL: "Incoming material",
  FABRICATION: "Fabrication",
  DIMENSIONAL: "Dimensional",
  WELD_VISUAL: "Weld visual",
  NDT: "NDT",
  COATING: "Painting & coating",
  INTERMEDIATE: "Intermediate",
  FINAL: "Final inspection",
  OTHER: "Other",
};

export const RESULT_LABELS: Record<string, string> = {
  PENDING: "Pending",
  PASS: "Pass",
  FAIL: "Fail",
  HOLD: "Hold",
  NA: "N/A",
};

/** Turn ENUM_VALUES into "Enum values". */
export function humanize(v: string | null | undefined): string {
  if (!v) return "—";
  const s = v.replace(/_/g, " ").toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
}
