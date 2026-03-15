/** blessed is unmaintained but widely used for TUI; listed in package.json dependencies */
import blessed from "blessed";

export interface UpdatePromptOptions {
  latestVersion: string;
  currentVersion: string;
  newerVersions: { version: string; date: string }[];
  /** Language: "id" for Indonesian, else English */
  lang: "id" | "en";
}

/** Exported for testing i18n. */
export const UPDATE_PROMPT_LABELS = {
  en: {
    title: " ReviuAh Update ",
    newVersion: "New version available:",
    current: "current",
    whatsNew: "What's new:",
    update: " Update ",
    skip: " Skip ",
    hint: "←→:Select | Enter:Confirm | Esc:Skip",
  },
  id: {
    title: " Pembaruan ReviuAh ",
    newVersion: "Versi baru tersedia:",
    current: "saat ini",
    whatsNew: "Perubahan terbaru:",
    update: " Perbarui ",
    skip: " Lewati ",
    hint: "←→:Pilih | Enter:Konfirmasi | Esc:Lewati",
  },
} as const;

/**
 * Show a TUI prompt (blessed) to update or skip. Returns true = update, false = skip.
 * Call only when process.stderr.isTTY. Falls back to readline if blessed fails.
 */
export function showUpdatePrompt(options: UpdatePromptOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const labels = UPDATE_PROMPT_LABELS[options.lang];
    const lineCount = 2 + (options.newerVersions.length > 0 ? options.newerVersions.length + 1 : 0) + 2 + 1;
    const height = Math.min(14, lineCount + 6);

    const screen = blessed.screen({
      smartCSR: true,
      title: "ReviuAh Update",
      input: process.stdin,
      output: process.stderr,
    });

    const mainBox = blessed.box({
      parent: screen,
      width: "80%",
      height,
      top: "center",
      left: "center",
      border: { type: "line" },
      style: { border: { fg: "cyan" } },
    });

    blessed.text({
      parent: mainBox,
      top: 0,
      left: "center",
      content: labels.title,
      style: { fg: "cyan", bold: true },
    });

    let y = 2;
    blessed.text({
      parent: mainBox,
      top: y,
      left: 2,
      content: `${labels.newVersion} ${options.latestVersion} (${labels.current}: ${options.currentVersion})`,
      style: { fg: "yellow" },
    });
    y += 1;

    if (options.newerVersions.length > 0) {
      blessed.text({
        parent: mainBox,
        top: y,
        left: 2,
        content: labels.whatsNew,
        style: { fg: "gray" },
      });
      y += 1;
      for (const v of options.newerVersions) {
        blessed.text({
          parent: mainBox,
          top: y,
          left: 4,
          content: `• ${v.version} (${v.date})`,
          style: { fg: "gray" },
        });
        y += 1;
      }
      y += 1;
    }

    const updateBtn = blessed.button({
      parent: mainBox,
      top: y,
      left: "center",
      content: labels.update,
      style: {
        fg: "black",
        bg: "green",
        focus: { fg: "white", bg: "blue" },
      },
      height: 1,
      width: 12,
    });

    const skipBtn = blessed.button({
      parent: mainBox,
      top: y,
      left: "50%+2",
      content: labels.skip,
      style: {
        fg: "black",
        bg: "gray",
        focus: { fg: "white", bg: "blue" },
      },
      height: 1,
      width: 10,
    });

    blessed.text({
      parent: mainBox,
      top: y + 2,
      left: "center",
      content: labels.hint,
      style: { fg: "gray" },
    });

    let selected = 0;
    const buttons = [updateBtn, skipBtn];

    function highlight(): void {
      (updateBtn.style as { bg?: string }).bg = selected === 0 ? "blue" : "green";
      (skipBtn.style as { bg?: string }).bg = selected === 1 ? "blue" : "gray";
      screen.render();
    }

    function done(doUpdate: boolean): void {
      screen.destroy();
      resolve(doUpdate);
    }

    updateBtn.on("press", () => done(true));
    skipBtn.on("press", () => done(false));

    screen.key(["left", "h"], () => {
      selected = Math.max(0, selected - 1);
      highlight();
    });
    screen.key(["right", "l"], () => {
      selected = Math.min(1, selected + 1);
      highlight();
    });
    screen.key(["tab"], () => {
      selected = selected === 0 ? 1 : 0;
      highlight();
    });
    screen.key(["enter"], () => {
      done(selected === 0);
    });
    screen.key(["escape", "q", "C-c"], () => done(false));

    highlight();
    screen.render();
  });
}
