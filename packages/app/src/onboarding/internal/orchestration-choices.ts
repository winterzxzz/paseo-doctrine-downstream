export type OrchestrationChoice = "tools" | "skills" | "cli";
export type OrchestrationChoices = Record<OrchestrationChoice, boolean>;
/** What the host and this computer have now; null while it is still being read. */
export type OrchestrationCurrent = Record<OrchestrationChoice, boolean | null>;
/** Switches the user flipped in this step. */
export type OrchestrationOverrides = Partial<OrchestrationChoices>;

const CHOICES: readonly OrchestrationChoice[] = ["tools", "skills", "cli"];

/**
 * Each switch shows what the user picked, else what is set up now. A state still being read shows
 * off: setup never offers to grant agents more than the Human already gave them.
 */
export function resolveOrchestrationChoices(
  overrides: OrchestrationOverrides,
  current: OrchestrationCurrent,
): OrchestrationChoices {
  return {
    tools: overrides.tools ?? current.tools ?? false,
    skills: overrides.skills ?? current.skills ?? false,
    cli: overrides.cli ?? current.cli ?? false,
  };
}

/**
 * The writes Continue makes: only switches the user flipped, and only when they differ from what
 * is set up now. A choice against a state still being read is written, since it was picked.
 */
export function pendingOrchestrationWrites(
  overrides: OrchestrationOverrides,
  current: OrchestrationCurrent,
): OrchestrationOverrides {
  const writes: OrchestrationOverrides = {};
  for (const choice of CHOICES) {
    const picked = overrides[choice];
    if (picked !== undefined && picked !== current[choice]) writes[choice] = picked;
  }
  return writes;
}
