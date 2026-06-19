import Image from "next/image";

export function BrandLogo({ className = "h-20 w-20" }: { className?: string }) {
  return (
    <span className={`relative block shrink-0 overflow-hidden rounded-full shadow-soft ${className}`}>
      <Image
        src="/paper-curio-logo.png"
        alt="The Paper Curio"
        fill
        priority
        sizes="(max-width: 640px) 96px, 160px"
        className="object-cover object-center"
      />
    </span>
  );
}
