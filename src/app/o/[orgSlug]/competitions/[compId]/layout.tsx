"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useParams } from "next/navigation";
import { ConfigProvider } from "antd";
import { CompetitionService } from "@/domain/services/competition.service";
import { EventService } from "@/domain/services/event.service";

const DEFAULT_ACCENT = "#1c5fd4";

function accentTextColor(hexColor: string) {
  const hex = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hexColor);
  if (!hex) return "#ffffff";
  const channels = hex.slice(1).map((value) => parseInt(value, 16) / 255);
  const luminance = channels.map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4);
  const relativeLuminance = 0.2126 * luminance[0] + 0.7152 * luminance[1] + 0.0722 * luminance[2];
  return relativeLuminance > 0.45 ? "#07111f" : "#ffffff";
}

export default function CompetitionWorkspaceLayout({ children }: { children: React.ReactNode }) {
  const { compId, eventId } = useParams<{ compId: string; eventId?: string }>();
  const [accent, setAccent] = useState(DEFAULT_ACCENT);

  useEffect(() => {
    let active = true;
    const loadAccent = async () => {
      try {
        const competition = await new CompetitionService().get(compId);
        let nextAccent = competition?.themeColor || DEFAULT_ACCENT;
        if (eventId) {
          const event = await new EventService().get(eventId);
          nextAccent = event?.themeColor || nextAccent;
        }
        if (active) setAccent(nextAccent);
      } catch {
        if (active) setAccent(DEFAULT_ACCENT);
      }
    };

    const refreshAccent = () => { void loadAccent(); };
    window.addEventListener("competition-theme-updated", refreshAccent);
    void loadAccent();
    return () => {
      active = false;
      window.removeEventListener("competition-theme-updated", refreshAccent);
    };
  }, [compId, eventId]);

  return (
    <ConfigProvider theme={{ token: { colorPrimary: accent, colorInfo: accent, colorLink: accent, colorTextLightSolid: accentTextColor(accent) } }}>
      <div className="competition-theme-shell" style={{ "--competition-accent": accent, "--competition-accent-foreground": accentTextColor(accent) } as CSSProperties}>
        {children}
      </div>
    </ConfigProvider>
  );
}
