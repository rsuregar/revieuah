import blessed from "blessed";
import { spawn } from "node:child_process";
import type { UserConfig } from "../config/user-config.js";
import { getUserConfigPath, writeUserConfig } from "../config/user-config.js";
import type { ProviderTemplateItem } from "../providers/openai.js";
import { getProviderTemplates } from "../providers/openai.js";

export class SetupWizard {
  private screen!: blessed.Widgets.Screen;
  private mainBox!: blessed.Widgets.BoxElement;
  private providerLabel!: blessed.Widgets.TextElement;
  private baseUrlField!: blessed.Widgets.TextboxElement;
  private apiKeyField!: blessed.Widgets.TextboxElement;
  private modelField!: blessed.Widgets.TextboxElement;
  private submitButton!: blessed.Widgets.ButtonElement;
  private cancelButton!: blessed.Widgets.ButtonElement;
  private resolveForm?: (value: boolean) => void;

  private templates: ProviderTemplateItem[];
  private selectedTemplateIndex: number;
  private currentField = 0; // 0=provider, 1=baseurl, 2=apikey, 3=model, 4=save, 5=cancel
  private existing: UserConfig | null;

  constructor(existing: UserConfig | null) {
    this.existing = existing;
    this.templates = getProviderTemplates();
    const defaultName = (existing?.provider ?? "agentrouter").toLowerCase();
    const idx = this.templates.findIndex(
      (t) => t.name.toLowerCase() === defaultName,
    );
    this.selectedTemplateIndex = idx >= 0 ? idx : 0;
    this.build();
  }

  private build(): void {
    this.screen = blessed.screen({
      smartCSR: true,
      title: "ReviuAh Setup",
    });

    this.mainBox = blessed.box({
      parent: this.screen,
      width: "80%",
      height: 16,
      top: "center",
      left: "center",
      border: { type: "line" },
      style: { border: { fg: "cyan" } },
    }) as blessed.Widgets.BoxElement;

    blessed.text({
      parent: this.mainBox,
      top: 0,
      left: "center",
      content: " ⚙ ReviuAh Configuration ",
      style: { fg: "cyan", bold: true },
    });

    this.createUI();
    this.setupKeys();
    this.updateHighlight();
  }

  private getTemplate(): ProviderTemplateItem {
    return this.templates[this.selectedTemplateIndex]!;
  }

  private createUI(): void {
    const template = this.getTemplate();
    const isCustom = template.name === "Custom";
    const config = this.existing ?? {};
    const providerUrl = config.providerUrl ?? template.url;
    const model = config.model ?? template.defaultModel;
    const apiKey = config.apiKey ?? "";

    blessed.text({
      parent: this.mainBox,
      top: 2,
      left: 2,
      content: "Provider:",
      style: { fg: "white" },
    });

    this.providerLabel = blessed.text({
      parent: this.mainBox,
      top: 2,
      left: 14,
      content: `◀ ${template.name} ▶`,
      style: { fg: "cyan", bold: true },
    }) as blessed.Widgets.TextElement;

    blessed.text({
      parent: this.mainBox,
      top: 4,
      left: 2,
      content: "Base URL:",
      style: { fg: "white" },
    });

    this.baseUrlField = blessed.textbox({
      parent: this.mainBox,
      top: 4,
      left: 14,
      right: 3,
      height: 1,
      style: {
        fg: isCustom ? "white" : "gray",
        bg: "black",
        focus: { fg: "white", bg: "blue" },
      },
      inputOnFocus: false,
      value: providerUrl,
    }) as blessed.Widgets.TextboxElement;

    blessed.text({
      parent: this.mainBox,
      top: 6,
      left: 2,
      content: "API Key:",
      style: { fg: "white" },
    });

    this.apiKeyField = blessed.textbox({
      parent: this.mainBox,
      top: 6,
      left: 14,
      right: 3,
      height: 1,
      style: {
        fg: "white",
        bg: "black",
        focus: { fg: "white", bg: "blue" },
      },
      inputOnFocus: false,
      value: apiKey,
    }) as blessed.Widgets.TextboxElement;

    blessed.text({
      parent: this.mainBox,
      top: 8,
      left: 2,
      content: "Model:",
      style: { fg: "white" },
    });

    this.modelField = blessed.textbox({
      parent: this.mainBox,
      top: 8,
      left: 14,
      right: 3,
      height: 1,
      style: {
        fg: "white",
        bg: "black",
        focus: { fg: "white", bg: "blue" },
      },
      inputOnFocus: false,
      value: model,
    }) as blessed.Widgets.TextboxElement;

    this.submitButton = blessed.button({
      parent: this.mainBox,
      top: 11,
      left: "center",
      content: " Save ",
      style: {
        fg: "black",
        bg: "green",
        focus: { fg: "white", bg: "blue" },
      },
      height: 1,
      width: 8,
    }) as blessed.Widgets.ButtonElement;

    this.cancelButton = blessed.button({
      parent: this.mainBox,
      top: 11,
      left: "50%+6",
      content: " Cancel ",
      style: {
        fg: "black",
        bg: "red",
        focus: { fg: "white", bg: "blue" },
      },
      height: 1,
      width: 10,
    }) as blessed.Widgets.ButtonElement;

    blessed.text({
      parent: this.mainBox,
      top: 13,
      left: "center",
      content:
        "↑↓:Navigate | ←→:Provider | Enter:Edit | Esc:Cancel | v:Open in editor",
      style: { fg: "gray" },
    });
  }

  private isEditing(): boolean {
    const focused = this.screen.focused;
    return (
      focused === this.baseUrlField ||
      focused === this.apiKeyField ||
      focused === this.modelField
    );
  }

  private setupKeys(): void {
    this.screen.key(["escape", "C-c"], () => this.handleCancel());

    this.screen.key(["v"], () => {
      if (!this.isEditing()) this.openInEditor();
    });

    this.screen.key(["up", "k"], () => {
      if (!this.isEditing()) this.navigate(-1);
    });

    this.screen.key(["down", "j", "tab"], () => {
      if (!this.isEditing()) this.navigate(1);
    });

    this.screen.key(["left", "h"], () => {
      if (!this.isEditing() && this.currentField === 0) this.changeProvider(-1);
    });

    this.screen.key(["right", "l"], () => {
      if (!this.isEditing() && this.currentField === 0) this.changeProvider(1);
    });

    this.screen.key(["enter"], () => {
      if (!this.isEditing()) this.handleEnter();
    });
  }

  private navigate(delta: number): void {
    const next = this.currentField + delta;
    if (next >= 0 && next <= 5) {
      this.currentField = next;
      this.updateHighlight();
    }
  }

  private changeProvider(delta: number): void {
    this.selectedTemplateIndex += delta;
    if (this.selectedTemplateIndex < 0) {
      this.selectedTemplateIndex = this.templates.length - 1;
    } else if (this.selectedTemplateIndex >= this.templates.length) {
      this.selectedTemplateIndex = 0;
    }
    const t = this.templates[this.selectedTemplateIndex]!;
    this.providerLabel.setContent(`◀ ${t.name} ▶`);
    this.baseUrlField.setValue(t.url);
    (this.baseUrlField.style as { fg?: string }).fg =
      t.name === "Custom" ? "white" : "gray";
    this.modelField.setValue(t.defaultModel);
    this.screen.render();
  }

  private updateHighlight(): void {
    (this.providerLabel.style as { fg?: string; bold?: boolean }).fg = "white";
    (this.providerLabel.style as { bold?: boolean }).bold = false;
    (this.baseUrlField.style as { bg?: string }).bg = "black";
    (this.apiKeyField.style as { bg?: string }).bg = "black";
    (this.modelField.style as { bg?: string }).bg = "black";
    (this.submitButton.style as { bg?: string }).bg = "green";
    (this.cancelButton.style as { bg?: string }).bg = "red";

    const fields = [
      () => {
        (this.providerLabel.style as { fg?: string }).fg = "cyan";
        (this.providerLabel.style as { bold?: boolean }).bold = true;
      },
      () => {
        (this.baseUrlField.style as { bg?: string }).bg = "blue";
      },
      () => {
        (this.apiKeyField.style as { bg?: string }).bg = "blue";
      },
      () => {
        (this.modelField.style as { bg?: string }).bg = "blue";
      },
      () => {
        (this.submitButton.style as { bg?: string }).bg = "blue";
      },
      () => {
        (this.cancelButton.style as { bg?: string }).bg = "blue";
      },
    ];
    fields[this.currentField]?.();
    this.screen.render();
  }

  private handleEnter(): void {
    if (this.currentField === 0) return;
    if (this.currentField === 1) {
      if (this.getTemplate().name === "Custom") this.editField(this.baseUrlField);
      return;
    }
    if (this.currentField === 2) {
      this.editField(this.apiKeyField);
      return;
    }
    if (this.currentField === 3) {
      this.editField(this.modelField);
      return;
    }
    if (this.currentField === 4) this.handleSubmit();
    if (this.currentField === 5) this.handleCancel();
  }

  private editField(field: blessed.Widgets.TextboxElement): void {
    field.focus();
    field.readInput(() => {
      this.mainBox.focus();
      this.updateHighlight();
    });
  }

  private async handleSubmit(): Promise<void> {
    const t = this.getTemplate();
    const providerUrl =
      t.name === "Custom"
        ? (this.baseUrlField.value ?? "").trim()
        : t.url;
    const apiKey = (this.apiKeyField.value ?? "").trim();
    const model = (this.modelField.value ?? t.defaultModel).trim() || t.defaultModel;

    if (!apiKey && t.requiresApiKey) {
      this.apiKeyField.focus();
      this.apiKeyField.readInput(() => {
        this.mainBox.focus();
        this.updateHighlight();
      });
      return;
    }

    await writeUserConfig({
      apiKey: apiKey || undefined,
      provider: t.name.toLowerCase(),
      providerUrl: providerUrl || t.url,
      model: model || t.defaultModel,
    });

    this.screen.destroy();
    if (this.resolveForm) this.resolveForm(true);
  }

  private handleCancel(): void {
    this.screen.destroy();
    if (this.resolveForm) this.resolveForm(false);
  }

  private openInEditor(): void {
    const configPath = getUserConfigPath();
    this.screen.destroy();
    const editor = process.env.EDITOR || process.env.VISUAL || "vim";
    const child = spawn(editor, [configPath], { stdio: "inherit" });
    child.on("exit", () => {
      if (this.resolveForm) this.resolveForm(true);
    });
  }

  run(): Promise<boolean> {
    return new Promise((resolve) => {
      this.resolveForm = resolve;
      this.screen.render();
    });
  }
}
