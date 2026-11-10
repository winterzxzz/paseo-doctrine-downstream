import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  areSkillsInstalled,
  hasSelectedSkills,
  useAgentSkills,
  type AgentSkillsController,
} from "@/agent-skills";
import { useToast } from "@/contexts/toast-context";
import { useCliInstall } from "@/desktop/hooks/use-install-status";
import { useDaemonConfig } from "@/hooks/use-daemon-config";
import {
  pendingOrchestrationWrites,
  resolveOrchestrationChoices,
  type OrchestrationChoice,
  type OrchestrationChoices as Choices,
  type OrchestrationCurrent,
  type OrchestrationOverrides,
} from "./orchestration-choices";

export type { OrchestrationChoice } from "./orchestration-choices";

export interface OrchestrationSetupController {
  choices: Choices;
  setChoice: (choice: OrchestrationChoice, on: boolean) => void;
  /** Only the choices this host and app can act on: skills need host support, the CLI the desktop app. */
  offered: Choices;
  /** The skills row's picker and Update act on the host directly, through this. */
  skills: AgentSkillsController;
  isApplying: boolean;
  /**
   * Brings the host in line with the choices; resolves true only when every one took. Each failure
   * is shown to the user.
   */
  apply: () => Promise<boolean>;
}

/**
 * The Orchestration step's choices. Each switch starts from what the host and this computer have
 * now, and nothing is touched until Continue applies the switches the user flipped, the way checked
 * projects are added.
 */
export function useOrchestrationSetup(serverId: string): OrchestrationSetupController {
  const { t } = useTranslation();
  const toast = useToast();
  const skills = useAgentSkills(serverId);
  const cli = useCliInstall();
  const { config, patchConfig } = useDaemonConfig(serverId);
  const [chosen, setChosen] = useState<OrchestrationOverrides>({});
  // With nothing picked there is nothing to install, so skills read as off, as they do in Settings.
  const skillsSelected = skills.status === null || hasSelectedSkills(skills.status);
  const overrides = useMemo<OrchestrationOverrides>(
    () =>
      chosen.skills === undefined ? chosen : { ...chosen, skills: chosen.skills && skillsSelected },
    [chosen, skillsSelected],
  );
  const [isApplying, setIsApplying] = useState(false);
  const offered: Choices = {
    tools: true,
    skills: skills.connected && skills.supported,
    cli: cli.available,
  };

  const setChoice = useCallback((choice: OrchestrationChoice, on: boolean) => {
    setChosen((current) => ({ ...current, [choice]: on }));
  }, []);

  // What the host and this computer have now, or null while it is still being read.
  const current = useMemo<OrchestrationCurrent>(
    () => ({
      tools: config ? config.mcp.injectIntoAgents === true : null,
      skills: skills.status ? areSkillsInstalled(skills.status) : null,
      cli: cli.status ? cli.status.installed : null,
    }),
    [config, skills.status, cli.status],
  );
  const choices = useMemo<Choices>(() => {
    const resolved = resolveOrchestrationChoices(overrides, current);
    return { ...resolved, skills: resolved.skills && skillsSelected };
  }, [overrides, current, skillsSelected]);
  const { reconcile, uninstall } = skills;
  const { setInstalled: setCliInstalled } = cli;
  const offersSkills = offered.skills;
  const offersCli = offered.cli;

  const setTools = useCallback(
    (on: boolean) =>
      patchConfig({ mcp: { injectIntoAgents: on } })
        .then(Boolean, () => false)
        .then((done) => {
          if (!done) toast.error(t("settings.host.orchestration.enableTools.updateFailed"));
          return done;
        }),
    [patchConfig, t, toast],
  );
  const setSkillsInstalled = useCallback(
    (on: boolean) => (on ? reconcile() : uninstall()),
    [reconcile, uninstall],
  );

  const apply = useCallback(async () => {
    setIsApplying(true);
    try {
      const writes = pendingOrchestrationWrites(overrides, current);
      const results = await Promise.all([
        writes.tools === undefined ? true : setTools(writes.tools),
        !offersSkills || writes.skills === undefined ? true : setSkillsInstalled(writes.skills),
        !offersCli || writes.cli === undefined ? true : setCliInstalled(writes.cli),
      ]);
      return results.every(Boolean);
    } finally {
      setIsApplying(false);
    }
  }, [overrides, current, setTools, offersSkills, setSkillsInstalled, offersCli, setCliInstalled]);

  return { choices, setChoice, offered, skills, isApplying, apply };
}
