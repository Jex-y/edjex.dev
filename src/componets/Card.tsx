import { FC, ReactNode } from "react";
import { cx } from "class-variance-authority";

export type CardProps = {
  title?: string;
  className?: string;
  children: ReactNode;
};

export const Card = ({ title, children, className }: CardProps) => {
  return (
    <div
      className={cx(
        "shadow-sm rounded-sm bg-card border border-border flex flex-col",
        className,
      )}
    >
      {title && (
        <div className="p-4">
          <h2 className="text-lg font-semibold text-muted-foreground">
            {title}
          </h2>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
};
