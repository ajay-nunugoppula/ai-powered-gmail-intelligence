import { cn } from "@/lib/utils";

function Avatar({
  className,
  src,
  alt,
  fallback,
}: {
  className?: string;
  src?: string | null;
  alt: string;
  fallback: string;
}) {
  const initials = fallback.slice(0, 2).toUpperCase();

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={cn("size-8 shrink-0 rounded-full object-cover", className)}
      />
    );
  }

  return (
    <div
      aria-hidden={alt ? undefined : true}
      className={cn(
        "bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium",
        className,
      )}
    >
      {initials}
    </div>
  );
}

export { Avatar };
