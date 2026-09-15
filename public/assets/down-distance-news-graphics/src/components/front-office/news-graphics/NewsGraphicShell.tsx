import React from "react";

type Props = {
  background: string;
  primary?: string;
  secondary?: string;
  className?: string;
  children: React.ReactNode;
};

export function NewsGraphicShell({
  background,
  primary = "#d71920",
  secondary = "#f2c400",
  className = "",
  children
}: Props) {
  return (
    <section
      className={`dd-news-graphic ${className}`}
      style={{
        ["--bg-image" as any]: `url(${background})`,
        ["--team-primary" as any]: primary,
        ["--team-secondary" as any]: secondary
      }}
    >
      {children}
    </section>
  );
}
