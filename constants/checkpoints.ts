/**
 * Default checkpoint definitions for Palitana Yatra
 * 3 checkpoints for the pilgrimage route
 */

import { Checkpoint } from "@/types";

export const DEFAULT_CHECKPOINTS: Checkpoint[] = [
  { id: 1, number: 1, description: "Gheti", day: 1 },
  { id: 2, number: 2, description: "Khodiyar", day: 1 },
  { id: 3, number: 3, description: "Aamli", day: 1 },
];

export const TOTAL_CHECKPOINTS = 3;
