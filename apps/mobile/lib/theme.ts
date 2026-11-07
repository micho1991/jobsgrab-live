// Same tokens as the web app (apps/web/src/app/globals.css).
export const colors = {
  ink: "#0E2A47", inkPressed: "#163A60", deep: "#0A1F36", steel: "#5D7A99", steelLight: "#A9BCD0",
  mist: "#F4F6F9", line: "#DCE2EA", body: "#26364A", muted: "#5E6B7C", white: "#FFFFFF",
  ok: "#1F7A4D", okBg: "#E8F4EE", bad: "#B42318", badBg: "#FDECEA", infoBg: "#EAF0F7",
};

export const statusTone: Record<string, { bg: string; fg: string }> = {
  slate: { bg: "#F1F5F9", fg: "#334155" }, blue: { bg: "#DBEAFE", fg: "#1E3A8A" },
  indigo: { bg: "#E0E7FF", fg: "#312E81" }, violet: { bg: "#EDE9FE", fg: "#4C1D95" },
  amber: { bg: "#FEF3C7", fg: "#78350F" }, teal: { bg: "#CCFBF1", fg: "#134E4A" },
  green: { bg: "#E8F4EE", fg: "#1F7A4D" }, red: { bg: "#FDECEA", fg: "#B42318" },
};

export const radius = { control: 8, panel: 14 };
export const space = (n: number) => n * 4;
