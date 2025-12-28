import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface LetterGradeProps {
  score: number;
  previousScore?: number;
  size?: "sm" | "md" | "lg";
  showTrend?: boolean;
  className?: string;
}

const getGrade = (score: number): { letter: string; modifier: string } => {
  if (score >= 93) return { letter: "A", modifier: "" };
  if (score >= 90) return { letter: "A", modifier: "-" };
  if (score >= 87) return { letter: "B", modifier: "+" };
  if (score >= 83) return { letter: "B", modifier: "" };
  if (score >= 80) return { letter: "B", modifier: "-" };
  if (score >= 77) return { letter: "C", modifier: "+" };
  if (score >= 73) return { letter: "C", modifier: "" };
  if (score >= 70) return { letter: "C", modifier: "-" };
  if (score >= 67) return { letter: "D", modifier: "+" };
  if (score >= 63) return { letter: "D", modifier: "" };
  if (score >= 60) return { letter: "D", modifier: "-" };
  return { letter: "F", modifier: "" };
};

const getGradeColor = (letter: string) => {
  switch (letter) {
    case "A": return {
      bg: "from-emerald-500 to-teal-400",
      text: "text-emerald-400",
      glow: "shadow-emerald-500/30",
      ring: "ring-emerald-500/30"
    };
    case "B": return {
      bg: "from-green-400 to-emerald-400",
      text: "text-green-400",
      glow: "shadow-green-500/30",
      ring: "ring-green-500/30"
    };
    case "C": return {
      bg: "from-yellow-400 to-amber-400",
      text: "text-yellow-400",
      glow: "shadow-yellow-500/30",
      ring: "ring-yellow-500/30"
    };
    case "D": return {
      bg: "from-orange-500 to-amber-500",
      text: "text-orange-400",
      glow: "shadow-orange-500/30",
      ring: "ring-orange-500/30"
    };
    default: return {
      bg: "from-red-500 to-rose-500",
      text: "text-red-400",
      glow: "shadow-red-500/30",
      ring: "ring-red-500/30"
    };
  }
};

const sizeClasses = {
  sm: {
    container: "w-16 h-16",
    letter: "text-2xl",
    modifier: "text-sm",
    score: "text-xs",
  },
  md: {
    container: "w-24 h-24",
    letter: "text-4xl",
    modifier: "text-lg",
    score: "text-sm",
  },
  lg: {
    container: "w-32 h-32",
    letter: "text-5xl",
    modifier: "text-xl",
    score: "text-base",
  },
};

export function LetterGrade({
  score,
  previousScore,
  size = "md",
  showTrend = true,
  className,
}: LetterGradeProps) {
  const { letter, modifier } = getGrade(score);
  const colors = getGradeColor(letter);
  const sizes = sizeClasses[size];

  const trend = previousScore !== undefined ? score - previousScore : 0;
  const TrendIcon = trend > 0 ? TrendingUp : trend < 0 ? TrendingDown : Minus;

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      {/* Grade Circle */}
      <div
        className={cn(
          "relative rounded-2xl flex items-center justify-center",
          "bg-gradient-to-br ring-2",
          colors.bg,
          colors.ring,
          sizes.container
        )}
        style={{
          boxShadow: `0 0 40px hsl(var(--grade-${letter.toLowerCase()}) / 0.3)`,
        }}
      >
        {/* Inner glow effect */}
        <div className="absolute inset-1 rounded-xl bg-background/20 backdrop-blur-sm" />

        {/* Letter */}
        <div className="relative flex items-start">
          <span className={cn("font-display font-black", sizes.letter)}>
            {letter}
          </span>
          {modifier && (
            <span className={cn("font-display font-bold mt-1", sizes.modifier)}>
              {modifier}
            </span>
          )}
        </div>
      </div>

      {/* Score and Trend */}
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-baseline gap-1">
          <span className={cn("font-mono font-bold tabular-nums", colors.text, sizes.score)}>
            {score}
          </span>
          <span className="text-muted-foreground text-xs">/100</span>
        </div>

        {showTrend && previousScore !== undefined && (
          <div
            className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
              trend > 0 && "bg-emerald-500/10 text-emerald-400",
              trend < 0 && "bg-red-500/10 text-red-400",
              trend === 0 && "bg-secondary text-muted-foreground"
            )}
          >
            <TrendIcon className="w-3 h-3" />
            <span className="font-mono tabular-nums">
              {trend > 0 ? "+" : ""}
              {trend} pts
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default LetterGrade;
