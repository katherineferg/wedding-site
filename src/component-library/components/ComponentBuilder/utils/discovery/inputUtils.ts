import type { InputConfig } from "../../types";

/** True when an input is an array using a structures reference. */
export function isArrayStructureInput(inputDef: InputConfig): boolean {
  return (
    typeof inputDef === "object" &&
    inputDef !== null &&
    inputDef.type === "array" &&
    typeof inputDef.options === "object" &&
    inputDef.options !== null &&
    typeof inputDef.options.structures === "string"
  );
}
